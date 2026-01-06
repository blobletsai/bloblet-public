"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { resolvePublicEconomyConfig } from '@/src/config/economy'
import { supaAnon } from '@/src/server/supa'
import { useHolderSession } from '@/src/client/hooks/useHolderSession'
import { attachChannelWithRetry } from '@/src/client/realtime/helpers'
import { normalizeLedgerPoints } from '@/src/shared/points'
import type { PersonaBloblet, PersonaLandmark, PersonaSession } from '@/src/client/persona/types'
import { useClientEventBus, useClientEventPublisher } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

const CHAIN_KIND: 'sol' = 'sol'

const ECONOMY_CONFIG = resolvePublicEconomyConfig()
const DEFAULT_PRICING = {
  base: ECONOMY_CONFIG.pricing.landmarkBaseRp,
  step: ECONOMY_CONFIG.pricing.landmarkStepRp,
  premiumPct: ECONOMY_CONFIG.pricing.landmarkPremiumPct,
}

type PersonaPricing = {
  base: number
  step: number
  premiumPct: number
}

type RefreshOptions = {
  showSpinner?: boolean
}

export type UsePersonaAssetsResult = {
  session: PersonaSession
  sessionLoading: boolean
  bloblet: PersonaBloblet | null
  landmarks: PersonaLandmark[]
  pricing: PersonaPricing
  rewardBalance: number | null
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: (options?: RefreshOptions) => Promise<void>
}

function normalizePricing(next?: Partial<PersonaPricing>): PersonaPricing {
  const base = Number.isFinite(Number(next?.base)) ? Number(next?.base) : DEFAULT_PRICING.base
  const step = Number.isFinite(Number(next?.step)) ? Number(next?.step) : DEFAULT_PRICING.step
  const premiumPct = Number.isFinite(Number(next?.premiumPct))
    ? Math.max(0, Number(next?.premiumPct))
    : DEFAULT_PRICING.premiumPct
  return { base, step, premiumPct }
}

function toPersonaBloblet(row: any, fallbackAddress: string): PersonaBloblet {
  const name =
    typeof row?.name === 'string' && row.name.trim().length > 0 ? String(row.name).trim() : null
  const socialHandle =
    typeof row?.social_handle === 'string' && row.social_handle.trim().length > 0
      ? String(row.social_handle).trim()
      : null
  const avatarAlive256 =
    typeof row?.avatar_alive_url_256 === 'string' ? row.avatar_alive_url_256.trim() : null
  const avatarUrl = avatarAlive256 || null
  const addressCanonical =
    (typeof row?.address_canonical === 'string' && row.address_canonical.trim()) || fallbackAddress
  return {
    address: addressCanonical,
    addressCased: String(row?.address_cased || row?.address || fallbackAddress),
    name,
    socialHandle,
    avatarUrl,
    avatarUrl256: avatarAlive256 || avatarUrl || null,
  }
}

function mapLandmarks(items: any[]): PersonaLandmark[] {
  return items
    .map((item) => ({
      id: Number(item?.id ?? item?.prop_id),
      type: String(item?.type ?? item?.prop_type ?? 'landmark'),
      name:
        typeof item?.name === 'string' && item.name.trim().length ? String(item.name).trim() : null,
      renameCount: Math.max(0, Number(item?.rename_count || item?.renameCount || 0)),
      currentPrice: Math.max(0, Number(item?.current_price ?? item?.currentPrice ?? 0)),
      lastPrice: Math.max(0, Number(item?.last_price ?? item?.lastPrice ?? 0)),
    }))
    .filter((landmark) => Number.isFinite(landmark.id))
}

export function usePersonaAssets(): UsePersonaAssetsResult {
  const sessionState = useHolderSession()
  const personaSession = useMemo<PersonaSession>(
    () => ({
      address: sessionState.address,
      isHolder: !!sessionState.isHolder,
    }),
    [sessionState.address, sessionState.isHolder],
  )

  const [bloblet, setBloblet] = useState<PersonaBloblet | null>(null)
  const [landmarks, setLandmarks] = useState<PersonaLandmark[]>([])
  const [pricing, setPricing] = useState<PersonaPricing>(() => normalizePricing(DEFAULT_PRICING))
  const [rewardBalance, setRewardBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPersonaData = useMemo(
    () => Boolean(bloblet) || landmarks.length > 0 || rewardBalance != null,
    [bloblet, landmarks.length, rewardBalance],
  )

  const eventPublisher = useClientEventPublisher()

  const eventBus = useClientEventBus()

  const broadcastPricing = useCallback((next: Partial<PersonaPricing> | null | undefined) => {
    const normalized = normalizePricing(next ?? undefined)
    setPricing(normalized)
    eventPublisher.emit(CLIENT_EVENT.PERSONA_PRICING, normalized)
  }, [eventPublisher])

  useEffect(() => {
    if (!eventBus) return
    const handleOrderApplied = () => {
      void loadRef.current({ showSpinner: false })
    }
    return eventBus.subscribe(CLIENT_EVENT.ORDER_APPLIED, handleOrderApplied)
  }, [eventBus])

  const load = useCallback(
    async (options?: RefreshOptions) => {
      if (sessionState.loading) return

      if (!sessionState.address || !sessionState.supabaseAccessToken) {
        setBloblet(null)
        setLandmarks([])
        broadcastPricing(DEFAULT_PRICING)
        setRewardBalance(null)
        setRefreshing(false)
        setLoading(false)
        setError(null)
        return
      }

      const showSpinner = options?.showSpinner !== false

      if (showSpinner) {
        if (hasPersonaData) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }
      } else if (hasPersonaData) {
        setRefreshing(true)
      }

      setError(null)

      try {
        const addressCanonical = sessionState.address.trim()
        const supa = supaAnon()

        const blobletPromise = supa
          .from('bloblets')
          .select('address,address_cased,address_canonical,name,social_handle,avatar_alive_url_256')
          .eq('chain_kind', CHAIN_KIND)
          .eq('address_canonical', addressCanonical)
          .maybeSingle()

        const rewardsPromise = fetch('/api/rewards/me', { credentials: 'same-origin' })
        const assetsPromise = fetch('/api/assets/my', { credentials: 'same-origin' })

        const [blobletRes, rewardsRes, assetsRes] = await Promise.allSettled([
          blobletPromise,
          rewardsPromise,
          assetsPromise,
        ])

        if (blobletRes.status === 'fulfilled' && blobletRes.value?.data) {
          setBloblet(toPersonaBloblet(blobletRes.value.data, sessionState.address))
        } else {
          setBloblet(null)
        }

        if (rewardsRes.status === 'fulfilled') {
          if (rewardsRes.value.ok) {
            const json = await rewardsRes.value.json().catch(() => null)
            if (json && typeof json.balance === 'number') {
              setRewardBalance(Number(json.balance))
            } else if (json && typeof json.balanceRaw === 'number' && typeof json.decimals === 'number') {
              const decimals = Number(json.decimals)
              const balanceRaw = Number(json.balanceRaw)
              if (Number.isFinite(decimals) && Number.isFinite(balanceRaw)) {
                setRewardBalance(normalizeLedgerPoints(balanceRaw, Math.max(0, Math.floor(decimals))))
              }
            }
          } else if (rewardsRes.value.status === 401) {
            setRewardBalance(null)
          }
        }

        if (assetsRes.status === 'fulfilled' && assetsRes.value.ok) {
          const json = await assetsRes.value.json().catch(() => null)
          const owned = Array.isArray(json?.owned) ? mapLandmarks(json.owned) : []
          setLandmarks(owned)
          broadcastPricing({
            base: Number(json?.base),
            step: Number(json?.step),
            premiumPct: Number(json?.premiumPct),
          })
        } else {
          setLandmarks([])
          broadcastPricing(DEFAULT_PRICING)
        }
      } catch (err) {
        console.error('[usePersonaAssets] failed to load assets', err)
        setError('Failed to load My Assets. Please try again.')
        setLandmarks([])
        broadcastPricing(DEFAULT_PRICING)
      } finally {
        if (showSpinner) {
          setLoading(false)
          setRefreshing(false)
        } else {
          setRefreshing(false)
        }
      }
    },
    [broadcastPricing, hasPersonaData, sessionState.address, sessionState.loading, sessionState.supabaseAccessToken],
  )

  // Keep ref to latest load function to prevent stale closures in event listeners
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    if (sessionState.loading) return
    void load({ showSpinner: true })
  }, [sessionState.loading, sessionState.address, load])

  useEffect(() => {
    if (!eventBus) return
    return eventBus.subscribe(CLIENT_EVENT.VERIFIED, () => {
      void loadRef.current({ showSpinner: false })
    })
  }, [eventBus])

  useEffect(() => {
    if (sessionState.loading) return
    const addressCanonical = sessionState.address?.trim()
    if (!addressCanonical || !sessionState.supabaseAccessToken) return
    const supa = supaAnon()
    const channelLabel = `[Realtime] persona:${addressCanonical}`
    const refreshFromRealtime = () => {
      void load({ showSpinner: false })
    }
    const cleanup = attachChannelWithRetry(
      supa,
      channelLabel,
      () =>
        supa
          .channel(`persona-assets:${addressCanonical}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bloblets', filter: `address_canonical=eq.${addressCanonical}` },
            refreshFromRealtime,
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bloblets', filter: `last_owner=eq.${addressCanonical}` },
            refreshFromRealtime,
          ),
    )
    return () => {
      cleanup()
    }
  }, [load, sessionState.address, sessionState.loading, sessionState.supabaseAccessToken])

  // Cross-tab synchronization using BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return

    const channel = new BroadcastChannel('persona_updates')

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'rp_balance_changed' && event.data?.address === sessionState.address) {
        // Another tab updated RP balance, refresh our data
        void loadRef.current({ showSpinner: false })
      }
    }

    channel.addEventListener('message', handleMessage)

    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [sessionState.address])

  // Broadcast RP balance changes to other tabs
  const prevBalanceRef = useRef(rewardBalance)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return
    if (prevBalanceRef.current === rewardBalance) return
    if (rewardBalance == null) return

    prevBalanceRef.current = rewardBalance

    try {
      const channel = new BroadcastChannel('persona_updates')
      channel.postMessage({
        type: 'rp_balance_changed',
        address: sessionState.address,
        balance: rewardBalance,
      })
      channel.close()
    } catch (err) {
      console.warn('[usePersonaAssets] Failed to broadcast RP balance change', err)
    }
  }, [rewardBalance, sessionState.address])

  return {
    session: personaSession,
    sessionLoading: sessionState.loading,
    bloblet,
    landmarks,
    pricing,
    rewardBalance,
    loading,
    refreshing,
    error,
    refresh: load,
  }
}
