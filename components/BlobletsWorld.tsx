"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BattleFlowProvider, type BattleFlowBindings } from '@/components/challenge-modal/BattleFlowProvider'
import { BlobletsHUD } from './bloblets-world/BlobletsHUD'
import type { RewardsModalConfig } from '@/components/rewards-modal/types'
import { resolvePublicEconomyConfig } from '@/src/config/economy'
import { appConfig } from '@/src/config/app'
import { BlobletsCanvas, type WorldCanvasHandle } from './bloblets-world/BlobletsCanvas'
import { WorldProvider, type WorldController } from './bloblets-world/WorldContext'
import type { HighlightedTarget } from './bloblets-world/opponentSelectors'
import {
  buildHubTabMeta,
  buildLoadoutCards,
  getLoadoutLabels,
  splitLoadoutCards,
  type LoadoutCard,
} from './bloblets-world/loadoutSelectors'
import { useLoadoutAndBattleState } from './bloblets-world/hooks/useLoadoutAndBattleState'
import { useNavHintAndPointer } from './bloblets-world/hooks/useNavHintAndPointer'
import { useGameplayRealtime } from '@/src/client/realtime/gameplay'
import type { HolderMetaEntry, HubTab, DockPanelId } from './bloblets-world/types'
import { useChallengePanel } from './bloblets-world/useChallengePanel'
import { LifeHubProvider } from './life-hub/LifeHubProvider'
import type { OpponentSearchResult } from './hud/OpponentSearchPanel'
import { useRewardsHudTelemetry } from './bloblets-world/hooks/useRewardsHudTelemetry'
import { useHudModalController } from './bloblets-world/hooks/useHudModalController'
import { type LandmarkOverlayDetail } from './bloblets-world/LandmarkRenameOverlay'
import { type BlobletOverlayDetail } from './bloblets-world/BlobletRenameOverlay'
import { useLifeHubService } from './life-hub/useLifeHubService'
import {
  CLIENT_EVENT,
  type PersonaPricingPayload,
  type PersonaFocusLandmarkPayload,
  type PersonaFocusBlobletPayload,
  type StakeDebugPayload,
} from '@/src/client/events/clientEventMap'
import { emitClientEvent, subscribeClientEvent } from '@/src/client/events/useClientEventBus'
import { useSound } from '@/src/hooks/useSound'
import type { LootedAlertDetail } from '@/components/LootedAlertOverlay'

// Bloblets World — React + Canvas2D (v10.6 adapted)
// - 4 size tiers (~7x spread), reference-style clustering pockets
// - Async slot generation (skeleton→fill), strict no-overlap, depth-sorted draw
// - ≤5s smooth entry with per-sprite glide + soft collisions; pan/zoom; DPR cap

const HUB_TABS: HubTab[] = ['life', 'persona', 'loadout', 'opponents', 'rewards']
const LIFE_HUB_MODAL_TABS: HubTab[] = HUB_TABS.filter(
  (tab) => tab !== 'persona' && tab !== 'opponents',
)
const MODAL_QUERY_VALUE_MAP: Record<string, HubTab> = {
  persona: 'persona',
  'my-assets': 'persona',
  myassets: 'persona',
  life: 'life',
  loadout: 'loadout',
  opponents: 'opponents',
  rewards: 'rewards',
}
const MODAL_QUERY_WRITE_MAP: Partial<Record<HubTab, string>> = {
  persona: 'my-assets',
}

const HUB_TAB_CONFIG: Record<HubTab, { icon: string; label: string }> = {
  life: { icon: '❤️', label: 'Life' },
  persona: { icon: '🎭', label: 'My Assets' },
  loadout: { icon: '⚔️', label: 'Loadout' },
  opponents: { icon: '🎯', label: 'Opponents' },
  rewards: { icon: '💎', label: 'Rewards' },
}

const SCOUTED_LIMIT = 3

const formatTimeLabel = (iso: string | null | undefined) => {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ---- Spatial grid --------------------------------------------------------
// ---- Reference pockets (weight field) -----------------------------------
// ---- React component -----------------------------------------------------
type BlobletsWorldProps = {
  rewardsConfig?: RewardsModalConfig
  logoSrc?: string
}


export default function BlobletsWorld(props: BlobletsWorldProps = {}) {
  const { rewardsConfig, logoSrc } = props
  const canvasRef = useRef<WorldCanvasHandle>(null)
  const [myAddress, setMyAddressState] = useState('')
  const [myAddressDisplay, setMyAddressDisplay] = useState('')
  const myAddressCanonical = (myAddress || '').trim()
  const myAddressDisplaySafe = myAddressDisplay || myAddressCanonical
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null)
  const [opponentSearchQuery, setOpponentSearchQuery] = useState('')
  const [opponentSearchIndex, setOpponentSearchIndex] = useState(-1)

  const [holderMeta, setHolderMeta] = useState<Record<string, HolderMetaEntry>>({})
  const [highlightedTargets, setHighlightedTargets] = useState<HighlightedTarget[]>([])
  const [selectedOpponentMeta, setSelectedOpponentMeta] = useState<any>(null)
  const [opponentCooldowns, setOpponentCooldowns] = useState<Record<string, number>>({})

  const [myLandmarkCount, setMyLandmarkCount] = useState(0)
  const [lootedAlert, setLootedAlert] = useState<LootedAlertDetail | null>(null)
  const { play } = useSound()

  // Start ambience on first interaction
  useEffect(() => {
    const startAmbience = () => {
      play('bg_ambience', 0.3)
      document.removeEventListener('click', startAmbience)
      document.removeEventListener('keydown', startAmbience)
    }
    document.addEventListener('click', startAmbience)
    document.addEventListener('keydown', startAmbience)
    return () => {
      document.removeEventListener('click', startAmbience)
      document.removeEventListener('keydown', startAmbience)
    }
  }, [play])

  const registerOpponentCooldown = useCallback((address: string, untilIso?: string | null) => {
    const key = String(address || '').trim()
    if (!key) return
    const untilTs = untilIso ? Date.parse(untilIso) : NaN
    setOpponentCooldowns((prev) => {
      if (!Number.isFinite(untilTs) || untilTs <= Date.now()) {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      }
      if (prev[key] === untilTs) return prev
      return { ...prev, [key]: untilTs }
    })
  }, [])

  const getOpponentCooldown = useCallback(
    (address: string | null | undefined) => {
      const key = String(address || '').trim()
      if (!key) return null
      const until = opponentCooldowns[key]
      if (typeof until !== 'number' || !Number.isFinite(until)) return null
      return until > Date.now() ? until : null
    },
    [opponentCooldowns],
  )
  useEffect(() => {
    if (appConfig.isProduction) return
    const unsubscribe = subscribeClientEvent(CLIENT_EVENT.STAKE_DEBUG, (detail: StakeDebugPayload) => {
      // eslint-disable-next-line no-console
      console.group('[stake-debug]')
      // eslint-disable-next-line no-console
      console.log('address:', detail.address)
      // eslint-disable-next-line no-console
      console.log('balance:', detail.balance)
      // eslint-disable-next-line no-console
      console.log('minStake:', detail.minStake)
      // eslint-disable-next-line no-console
      console.log('stakeReady:', detail.stakeReady)
      // eslint-disable-next-line no-console
      console.log('timestamp:', detail.timestamp ? new Date(detail.timestamp).toISOString() : null)
      // eslint-disable-next-line no-console
      console.groupEnd()
    })
    return () => {
      try {
        unsubscribe()
      } catch {
        // ignore cleanup failures
      }
    }
  }, [])
  const [pvpConfig, setPvpConfig] = useState<{ minStake: number } | null>(null)
  const gameplay = useGameplayRealtime()
  useEffect(() => {
    const event = gameplay.lastEvent
    if (!event || event.topic !== 'ledger') return
    const address = String(event.payload?.address || '').trim()
    if (!address) return
    const balanceAfter =
      event.payload?.balanceAfterRaw != null ? Number(event.payload.balanceAfterRaw) : null
    const delta =
      event.payload?.deltaRaw != null ? Number(event.payload.deltaRaw) : null
    setHolderMeta((prev) => {
      const current = prev[address]
      const currentBalance =
        current && typeof current.balance === 'number' && Number.isFinite(current.balance)
          ? current.balance
          : null
      const nextBalance =
        balanceAfter != null && Number.isFinite(balanceAfter)
          ? balanceAfter
          : currentBalance != null && delta != null && Number.isFinite(delta)
            ? currentBalance + delta
            : null
      if (nextBalance == null) return prev
      if (current && current.balance === nextBalance) return prev
      return {
        ...prev,
        [address]: {
          balance: nextBalance,
          name: current?.name ?? null,
          addressCased: current?.addressCased ?? null,
          aliveUrl: current?.aliveUrl ?? null,
          deadUrl: current?.deadUrl ?? null,
        },
      }
    })
  }, [gameplay.lastEvent, setHolderMeta])
  const {
    itemCatalog,
    loadoutState,
    battleFeed,
    applyLoadouts,
    updateLoadout,
    applyBattles,
    prependBattle,
    refreshViewerLoadout,
  } = useLoadoutAndBattleState({ gameplay, viewerAddress: myAddressCanonical || null, setLootedAlert })
  const {
    showNavHint,
    pointerType: navPointerType,
    handleNavHintDismiss,
    updatePointerType,
  } = useNavHintAndPointer()

  const lifeHubService = useLifeHubService({
    walletAddress: myAddress || null,
    walletAddressCanonical: myAddressCanonical || null,
    gameplay,
    rewardsConfig,
    formatTimeLabel,
  })

  const {
    lifeHubValue,
    toasts,
    rewardBalance,
    rewardsSnapshot,
    rewardsLoading,
    rewardsError,
    rewardsUpdatedAt,
    refreshRewards,
    openTopUpModal,
    closeTopUpModal,
    topUpModalOpen,
    rewardsWindowHandlers,
    telemetry,
  } = lifeHubService
  const energizeHudStatus = lifeHubValue.hudStatus

  useEffect(() => {
    let active = true
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/pvp/config', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('failed')
        const json = await res.json().catch(() => null)
        if (!active) return
        const parsed = Number(json?.minStake)
        setPvpConfig({ minStake: Number.isFinite(parsed) ? parsed : 0 })
      } catch {
        if (active) {
          setPvpConfig((prev) => prev ?? { minStake: 0 })
        }
      }
    }
    fetchConfig().catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const challengePanel = useChallengePanel({
    holderMeta,
    battleFeed,
    myAddress,
    itemCatalog,
    refreshRewards,
    minStake: pvpConfig?.minStake ?? null,
    registerPairCooldown: registerOpponentCooldown,
    getPairCooldown: getOpponentCooldown,
  })

  const {
    challengeModalOpen,
    challengePresetTarget,
    openChallengeModal,
    closeChallengeModal,
    handleChallengeSubmit,
    recentOpponents,
    challengeWindowHandlers,
    arenaPanel,
    resolveChallengeAvatar,
    getStakeInfo,
    minStake,
    getPairCooldown: panelGetPairCooldown,
  } = challengePanel

  const hudController = useHudModalController<HubTab, DockPanelId>({
    personaTab: 'persona',
    lifeHubTabs: LIFE_HUB_MODAL_TABS,
    challengeModalOpen,
    queryConfig: {
      param: 'modal',
      valueToTab: MODAL_QUERY_VALUE_MAP,
      tabToValue: MODAL_QUERY_WRITE_MAP,
    },
  })

  const {
    activeHubTab,
    activeDockPanel,
    personaModalVisible,
    lifeHubModalVisible,
    gearManagerOpen,
    toggleHubTab,
    openHubTab,
    closeHub,
    toggleDockPanel,
    closeDockPanel,
    openGearManager,
    closeGearManager,
  } = hudController

  const minStakeThreshold = useMemo(() => {
    const value = typeof minStake === 'number' && minStake > 0 ? minStake : null
    return value
  }, [minStake])

  useEffect(() => {
    if (!myAddressCanonical) {
      setMyLandmarkCount(0)
      return
    }
    const st = canvasRef.current?.getState()
    if (!st || !Array.isArray(st.sprites)) {
      // Don't set to 0 if just not ready? Or safe to set 0?
      // setMyLandmarkCount(0) 
      return
    }
    const count = st.sprites.reduce((acc: number, sprite: any) => {
      if (
        sprite &&
        sprite.entityType === 'landmark' &&
        typeof sprite.ownerAddress === 'string' &&
        sprite.ownerAddress === myAddressCanonical
      ) {
        return acc + 1
      }
      return acc
    }, 0)
    setMyLandmarkCount(count)
  }, [holderMeta, myAddressCanonical])

  useEffect(() => {
    const handleSpritesUpdated = () => {
      if (!myAddressCanonical) {
        setMyLandmarkCount(0)
        return
      }
      const st = canvasRef.current?.getState()
      if (!st || !Array.isArray(st.sprites)) return
      const count = st.sprites.reduce((acc: number, sprite: any) => {
        if (
          sprite &&
          sprite.entityType === 'landmark' &&
          typeof sprite.ownerAddress === 'string' &&
          sprite.ownerAddress === myAddressCanonical
        ) {
          return acc + 1
        }
        return acc
      }, 0)
      setMyLandmarkCount(count)
    }
    handleSpritesUpdated()
    const unsubscribe = subscribeClientEvent(CLIENT_EVENT.SPRITES_UPDATED, handleSpritesUpdated)
    return () => {
      try {
        unsubscribe()
      } catch {
        // ignore cleanup failures
      }
    }
  }, [myAddressCanonical])

  const personaEconomy = useMemo(() => resolvePublicEconomyConfig(), [])
  const [landmarkPricing, setLandmarkPricing] = useState(() => ({
    base: personaEconomy.pricing.landmarkBaseRp,
    step: personaEconomy.pricing.landmarkStepRp,
    premiumPct: Math.max(0, Number(personaEconomy.pricing.landmarkPremiumPct ?? 0)),
  }))

  useEffect(() => {
    if (!myAddressCanonical) return
    let cancelled = false
    const fetchPricing = async () => {
      try {
        const resp = await fetch('/api/assets/my', { credentials: 'same-origin' })
        if (!resp.ok) return
        const json = await resp.json().catch(() => null)
        if (!json || cancelled) return
        const base = Number.isFinite(Number(json.base))
          ? Number(json.base)
          : personaEconomy.pricing.landmarkBaseRp
        const step = Number.isFinite(Number(json.step))
          ? Number(json.step)
          : personaEconomy.pricing.landmarkStepRp
        const premiumPct = Number.isFinite(Number(json.premiumPct))
          ? Math.max(0, Number(json.premiumPct))
          : Math.max(0, Number(personaEconomy.pricing.landmarkPremiumPct ?? 0))
        setLandmarkPricing({ base, step, premiumPct })
      } catch {}
    }
    fetchPricing()
    return () => {
      cancelled = true
    }
  }, [myAddressCanonical, personaEconomy.pricing.landmarkBaseRp, personaEconomy.pricing.landmarkPremiumPct, personaEconomy.pricing.landmarkStepRp])
  const [personaOverlay, setPersonaOverlay] = useState<LandmarkOverlayDetail | null>(null)
  const [personaOverlayAnchor, setPersonaOverlayAnchor] = useState<{ left: number; top: number } | null>(null)
  const [blobletOverlay, setBlobletOverlay] = useState<BlobletOverlayDetail | null>(null)
  const [blobletOverlayAnchor, setBlobletOverlayAnchor] = useState<{ left: number; top: number } | null>(null)

  const handlePersonaPricing = useCallback((detail?: PersonaPricingPayload) => {
    setLandmarkPricing((prev) => {
      const base = Number.isFinite(Number(detail?.base)) ? Number(detail?.base) : prev.base
      const step = Number.isFinite(Number(detail?.step)) ? Number(detail?.step) : prev.step
      const premiumPct = Number.isFinite(Number(detail?.premiumPct))
        ? Math.max(0, Number(detail?.premiumPct))
        : prev.premiumPct
      if (prev.base === base && prev.step === step && prev.premiumPct === premiumPct) return prev
      return { base, step, premiumPct }
    })
  }, [])

  const handlePersonaLandmarkFocus = useCallback((detail?: PersonaFocusLandmarkPayload | null) => {
    if (!detail) return
    const ownerAddress = detail.ownerAddress ? String(detail.ownerAddress).trim() : null
    const addressCanonical =
      typeof detail.addressCanonical === 'string' && detail.addressCanonical.trim().length
        ? detail.addressCanonical.trim()
        : typeof detail.address === 'string'
          ? detail.address.trim()
          : ''
    const overlayDetail: LandmarkOverlayDetail = {
      address: String(detail.address || ''),
      addressCanonical,
      propId: detail.propId != null ? Number(detail.propId) : null,
      propType: detail.propType != null ? String(detail.propType) : null,
      name: detail.name != null ? String(detail.name) : null,
      renameCount: Number(detail.renameCount ?? 0),
      ownerAddress,
      ownerAddressCased: detail.ownerAddressCased ?? null,
      worldX: Number(detail.worldX ?? 0),
      worldY: Number(detail.worldY ?? 0),
      radius: Number(detail.radius ?? 48),
      basePrice: landmarkPricing.base,
      stepPrice: landmarkPricing.step,
      lastPrice: Math.max(0, Number(detail.lastPrice ?? 0)) || 0,
      premiumPct: Math.max(0, Number(landmarkPricing.premiumPct ?? 0)),
    }
    setPersonaOverlay(overlayDetail)
  }, [landmarkPricing])

  const handlePersonaBlobletFocus = useCallback((detail?: PersonaFocusBlobletPayload | null) => {
    if (!detail || !myAddressCanonical) return
    const addrCanonical =
      typeof detail.addressCanonical === 'string' && detail.addressCanonical.trim().length
        ? detail.addressCanonical.trim()
        : typeof detail.address === 'string'
          ? detail.address.trim()
          : ''
    if (!addrCanonical || addrCanonical !== myAddressCanonical) return
    const worldX = Number(detail.worldX)
    const worldY = Number(detail.worldY)
    const overlayDetail: BlobletOverlayDetail = {
      address: typeof detail.address === 'string' && detail.address.trim().length
        ? detail.address
        : myAddressDisplaySafe,
      addressCanonical: addrCanonical,
      name: typeof detail.name === 'string' ? detail.name : null,
      worldX: Number.isFinite(worldX) ? worldX : 0,
      worldY: Number.isFinite(worldY) ? worldY : 0,
    }
    setBlobletOverlay(overlayDetail)
  }, [myAddressCanonical, myAddressDisplaySafe])

  const closeBlobletOverlay = useCallback(() => {
    setBlobletOverlay(null)
    setBlobletOverlayAnchor(null)
  }, [])

  const closePersonaOverlay = useCallback(() => {
    setPersonaOverlay(null)
    setPersonaOverlayAnchor(null)
  }, [])

  const handlePersonaClose = useCallback(() => {
    closePersonaOverlay()
    closeBlobletOverlay()
  }, [closeBlobletOverlay, closePersonaOverlay])

  const handlePersonaTopUp = useCallback(() => {
    openTopUpModal()
  }, [openTopUpModal])



  useEffect(() => {
    if (!myAddressCanonical) {
      setBlobletOverlay(null)
    }
  }, [myAddressCanonical])

  // Overlay Anchors
  useEffect(() => {
    if (!personaOverlay) {
      setPersonaOverlayAnchor(null)
      return
    }
    let rafId = 0
    const update = () => {
      const screen = canvasRef.current?.projectWorldToScreen(personaOverlay.worldX, personaOverlay.worldY)
      if (screen) {
        setPersonaOverlayAnchor((prev) => {
          if (prev && Math.abs(prev.left - screen.left) < 0.5 && Math.abs(prev.top - screen.top) < 0.5) {
            return prev
          }
          return screen
        })
      }
      rafId = requestAnimationFrame(update)
    }
    update()
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [personaOverlay])

  useEffect(() => {
    if (!blobletOverlay) {
      setBlobletOverlayAnchor(null)
      return
    }
    let rafId = 0
    const update = () => {
      const screen = canvasRef.current?.projectWorldToScreen(blobletOverlay.worldX, blobletOverlay.worldY)
      if (screen) {
        setBlobletOverlayAnchor((prev) => {
          if (prev && Math.abs(prev.left - screen.left) < 0.5 && Math.abs(prev.top - screen.top) < 0.5) {
            return prev
          }
          return screen
        })
      }
      rafId = requestAnimationFrame(update)
    }
    update()
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [blobletOverlay])

  // Wrappers
  const focusOnAddress = useCallback((address: string, opts?: any) => {
    canvasRef.current?.focusOnAddress(address, opts)
  }, [])

  const previewOpponent = useCallback((address: string | null) => {
    canvasRef.current?.previewOpponent(address)
  }, [])

  const handleSelectOpponentAddress = useCallback((address: string, opts?: { focus?: boolean }) => {
    canvasRef.current?.handleSelectOpponentAddress(address, opts)
  }, [])

  // Session
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const storedCanonical = (window.localStorage.getItem('blob:my_addr') || '').trim()
      const displayStored = (window.localStorage.getItem('blob:my_addr_display') || '').trim()
      const canonical = storedCanonical || displayStored
      if (!canonical) return
      const displayValue = displayStored || canonical
      
      if (myAddressCanonical === canonical) return 
      
      setMyAddressState(canonical)
      setMyAddressDisplay(displayValue)
    } catch {
      // ignore
    }
  }, [myAddressCanonical]) 

  useEffect(() => {
    if (!myAddressCanonical && activeDockPanel === 'assets') {
      closeDockPanel()
    }
  }, [activeDockPanel, closeDockPanel, myAddressCanonical])

  const handleOpenMyAssetsPanel = useCallback(() => {
    openHubTab('persona')
    closeDockPanel()
  }, [closeDockPanel, openHubTab])

  // Client Events
  useEffect(() => {
    const handlers = {
      [CLIENT_EVENT.PERSONA_PRICING]: handlePersonaPricing,
      [CLIENT_EVENT.PERSONA_FOCUS_LANDMARK]: handlePersonaLandmarkFocus,
      [CLIENT_EVENT.PERSONA_FOCUS_BLOBLET]: handlePersonaBlobletFocus,
      [CLIENT_EVENT.PERSONA_CLOSE]: handlePersonaClose,
      [CLIENT_EVENT.PERSONA_OPEN_TOPUP]: handlePersonaTopUp,
    }
    const unsubs = Object.entries(handlers).map(([event, handler]) => 
      subscribeClientEvent(event as any, handler as any)
    )
    return () => unsubs.forEach(u => u())
  }, [handlePersonaBlobletFocus, handlePersonaClose, handlePersonaLandmarkFocus, handlePersonaPricing, handlePersonaTopUp])

  const handleHighlightsUpdate = useCallback((data: { selectedOpponentMeta: any; highlightedTargets: HighlightedTarget[] }) => {
    setSelectedOpponentMeta(data.selectedOpponentMeta)
    setHighlightedTargets(data.highlightedTargets)
  }, [])


  const myLoadout = useMemo(() => {
    if (!myAddressCanonical) return null
    return loadoutState[myAddressCanonical] || null
  }, [myAddressCanonical, loadoutState])

  const myWeapon = myLoadout?.weapon || null
  const myShield = myLoadout?.shield || null
  const myWeaponStat = myWeapon?.op ?? 0



  const opponentDirectory = useMemo<OpponentSearchResult[]>(() => {
    const entries: OpponentSearchResult[] = []
    for (const [address, meta] of Object.entries(holderMeta)) {
      if (!address || address === myAddressCanonical) continue
      const displayAddress = (meta?.addressCased || address).trim() || address
      const rawName = (meta?.name || '').trim()
      const name = rawName.length ? rawName : null
      const rawBalance = meta?.balance
      const balance =
        typeof rawBalance === 'number' && Number.isFinite(rawBalance) ? rawBalance : null
      const hasMinimumStake =
        minStakeThreshold == null || balance == null || balance >= minStakeThreshold
      if (!hasMinimumStake) continue
      entries.push({
        address,
        displayAddress,
        name,
        hasMinimumStake,
      })
    }
    return entries
  }, [holderMeta, minStakeThreshold, myAddressCanonical])

  const opponentSearchResults = useMemo<OpponentSearchResult[]>(() => {
    const query = opponentSearchQuery.trim().toLowerCase()
    if (!query) return []
    const matches = opponentDirectory.filter((entry) => {
      const displayLower = entry.displayAddress.toLowerCase()
      const nameLower = (entry.name || '').toLowerCase()
      return (
        entry.address.includes(query) ||
        displayLower.includes(query) ||
        (nameLower && nameLower.includes(query))
      )
    })
    return matches.slice(0, 6)
  }, [opponentDirectory, opponentSearchQuery])

  useEffect(() => {
    if (!opponentSearchResults.length && opponentSearchIndex !== -1) {
      setOpponentSearchIndex(-1)
      return
    }
    if (
      opponentSearchResults.length &&
      opponentSearchIndex >= opponentSearchResults.length
    ) {
      setOpponentSearchIndex(opponentSearchResults.length - 1)
    }
  }, [opponentSearchIndex, opponentSearchResults.length])

  const {
    rewardBalanceLabel,
    rewardBalanceDisplay,
    gateRequirementLabel,
    rewardBadgeTooltip,
    rewardSummary,
    rewardButtonsDisabled,
    ledgerDockProps,
  } = useRewardsHudTelemetry({
    myAddressCanonical,
    rewardBalance,
    rewardsSnapshot,
    rewardsConfig,
    rewardsLoading,
    rewardsError,
    rewardsUpdatedAt,
    refreshRewards,
    openTopUpModal,
  })

  useEffect(() => {
    if (activeHubTab !== 'opponents') {
      previewOpponent(null)
      setOpponentSearchQuery('')
      setOpponentSearchIndex(-1)
    }
  }, [activeHubTab, previewOpponent])

  const handleOpponentSearchChange = useCallback((value: string) => {
    setOpponentSearchQuery(value)
    setOpponentSearchIndex(-1)
  }, [])

  const handleOpponentSearchNavigate = useCallback(
    (direction: 'next' | 'prev') => {
      const total = opponentSearchResults.length
      if (!total) return
      setOpponentSearchIndex((prev) => {
        if (prev === -1) {
          return direction === 'next' ? 0 : total - 1
        }
        let next = prev + (direction === 'next' ? 1 : -1)
        if (next < 0) next = total - 1
        if (next >= total) next = 0
        return next
      })
    },
    [opponentSearchResults.length],
  )

  const handleOpponentSearchSelect = useCallback(
    (address: string) => {
      if (!address) return
      handleSelectOpponentAddress(address, { focus: true })
      setOpponentSearchIndex(-1)
    },
    [handleSelectOpponentAddress],
  )

  const handleOpponentSearchSubmit = useCallback(() => {
    const target =
      opponentSearchIndex >= 0
        ? opponentSearchResults[opponentSearchIndex]
        : opponentSearchResults[0]
    if (!target) return
    handleOpponentSearchSelect(target.address)
  }, [handleOpponentSearchSelect, opponentSearchIndex, opponentSearchResults])

  const handleOpponentSearchHover = useCallback(
    (address: string | null) => {
      previewOpponent(address)
    },
    [previewOpponent],
  )

  const handleOpponentSearchClearActive = useCallback(() => {
    setOpponentSearchIndex(-1)
    previewOpponent(null)
    setSelectedOpponent(null)
  }, [previewOpponent])
  const handleHolderMetaSnapshot = useCallback(
    (meta: Record<string, HolderMetaEntry>) => {
      setHolderMeta(meta)
    },
    [],
  )
  const handleSelectOpponentState = useCallback((value: string | null) => {
    setSelectedOpponent(value)
  }, [])

  const handleHubTabToggle = useCallback((tab: HubTab) => {
    toggleHubTab(tab)
  }, [toggleHubTab])

  const handleManageGear = useCallback(() => {
    openHubTab('loadout')
    openGearManager()
  }, [openGearManager, openHubTab])
  const highlightOwnedLandmarks = Boolean(myAddressCanonical && activeDockPanel === 'assets')
  const opponentsHudVisible = activeHubTab === 'opponents'

  const loadoutCards = useMemo<LoadoutCard[]>(
    () => buildLoadoutCards(myWeapon, myShield),
    [myShield, myWeapon],
  )

  const { primary: primaryLoadoutCards, future: futureLoadoutCards } = useMemo(
    () => splitLoadoutCards(loadoutCards),
    [loadoutCards],
  )
  const lifeHubLoadout = useMemo(
    () => ({
      primaryCards: primaryLoadoutCards,
      futureCards: futureLoadoutCards,
    }),
    [futureLoadoutCards, primaryLoadoutCards],
  )
  const handleBattleLifeHubRequest = useCallback(() => {
    openHubTab('life')
  }, [openHubTab])

  const { weaponLabel, shieldLabel } = useMemo(
    () => getLoadoutLabels(myWeapon, myShield),
    [myShield, myWeapon],
  )

  const hubTabMeta = useMemo(
    () =>
      buildHubTabMeta({
        hudConfig: HUB_TAB_CONFIG,
        careHighlight: energizeHudStatus.highlight,
        personaSubtitle: rewardBalanceLabel ? `Ready: ${rewardBalanceLabel} BC` : 'Assets & names',
        highlightedCount: highlightedTargets.length,
        hasLoadout: !!myLoadout,
        rewardBalanceLabel,
        weaponLabel,
        shieldLabel,
        isNourishReady: energizeHudStatus.ready,
      }),
    [energizeHudStatus.highlight, energizeHudStatus.ready, highlightedTargets.length, myLoadout, rewardBalanceLabel, shieldLabel, weaponLabel],
  )

  const battleFlowBindings = useMemo<BattleFlowBindings>(() => ({
    challengeModalOpen,
    challengePresetTarget,
    recentOpponents,
    openChallengeModal,
    closeChallengeModal,
    handleChallengeSubmit,
    resolveChallengeAvatar,
    minStake,
    getStakeInfo,
    getPairCooldown: panelGetPairCooldown || getOpponentCooldown,
    challengeWindowHandlers,
    arenaPanel,
  }), [
    arenaPanel,
    challengeModalOpen,
    challengePresetTarget,
    challengeWindowHandlers,
    closeChallengeModal,
    getStakeInfo,
    panelGetPairCooldown,
    getOpponentCooldown,
    handleChallengeSubmit,
    minStake,
    openChallengeModal,
    recentOpponents,
    resolveChallengeAvatar,
  ])

  const selectedOpponentCooldown = selectedOpponent ? getOpponentCooldown(selectedOpponent) : null

  const worldController: WorldController = {
    canvas: {
      gameplay,
      energizeUi: lifeHubValue.energize,
      myAddressCanonical,
      activeHubTab,
      highlightOwnedLandmarks,
      onEnergizeUiChange: telemetry.setEnergizeUi,
      pendingEnergizeActionRef: telemetry.pendingEnergizeActionRef,
      onEnergizeAlert: telemetry.setEnergizeAlert,
      refreshRewards,
      prependBattle,
      updateLoadout,
      loadoutState,
      holderMeta,
      onHolderMetaSnapshot: handleHolderMetaSnapshot,
      minStake,
      myWeaponStat,
      selectedOpponent,
      onSelectOpponent: handleSelectOpponentState,
      onOpenHubTab: openHubTab,
      onCloseHub: closeHub,
      challengeWindowHandlers,
      rewardsWindowHandlers,
      onPointerTypeChange: updatePointerType,
      applyLoadouts,
      applyBattles,
      onHighlightsUpdate: handleHighlightsUpdate,
      onMyAddressResolved: setMyAddressState,
      onMyAddressDisplay: setMyAddressDisplay,
    },
    hud: {
      blobletOverlay,
      blobletOverlayAnchor,
      closeBlobletOverlay,
      personaOverlay,
      personaOverlayAnchor,
      closePersonaOverlay,
      rewardBalance,
      rewardBalanceLabel,
      rewardBalanceDisplay,
      rewardBadgeTooltip,
      rewardButtonsDisabled,
      personaEconomy,
      openTopUpModal,
      openHubTab,
      closeHub,
      refreshRewards,
      showNavHint,
      navPointerType,
      dismissNavHint: handleNavHintDismiss,
      dockTabs: HUB_TABS,
      activeHubTab,
      handleHubTabToggle,
      hubTabMeta,
      activeDockPanel,
      toggleDockPanel,
      closeDockPanel,
      highlightOwnedLandmarks,
      highlightedTargets,
      opponentSearchQuery,
      opponentSearchResults,
      opponentSearchIndex,
      opponentsHudVisible,
      handleOpponentSearchChange,
      handleOpponentSearchNavigate,
      handleOpponentSearchSubmit,
      handleOpponentSearchSelect,
      handleOpponentSearchHover,
      handleOpponentSearchClearActive,
      selectedOpponent,
      selectedOpponentMeta,
      selectedOpponentCooldown,
      previewOpponent,
      focusOnAddress,
      openChallengeModal,
      minStake,
      toasts,
      lifeHubModalVisible,
      personaModalVisible,
      gearManagerOpen,
      closeGearManager,
      topUpModalOpen,
      closeTopUpModal,
      lifeHubLoadout,
      handleManageGear,
      rewardSummary,
      ledgerDockProps,
      arenaPanel,
      myAddressCanonical,
      myLandmarkCount,
      handleOpenMyAssetsPanel,
      lootedAlert,
      onDismissLootedAlert: () => setLootedAlert(null),
    },
  }

  return (
    <LifeHubProvider value={lifeHubValue}>
      <BattleFlowProvider
        bindings={battleFlowBindings}
        myAddress={myAddress || ''}
        loadouts={loadoutState}
        itemCatalog={itemCatalog}
        onRequestLifeHub={handleBattleLifeHubRequest}
        refreshViewerLoadout={refreshViewerLoadout}
      >
        <WorldProvider value={worldController}>
          <BlobletsCanvas ref={canvasRef} />
          <BlobletsHUD logoSrc={logoSrc} rewardsConfig={rewardsConfig} />
        </WorldProvider>
      </BattleFlowProvider>
    </LifeHubProvider>
  )
}
