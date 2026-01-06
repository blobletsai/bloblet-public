"use client"

import React, { createContext, useContext } from 'react'
import type { ReactNode, MutableRefObject, Dispatch, SetStateAction } from 'react'

import type { EnergizeUiState } from './energizeState'
import type { HolderMetaEntry, HubTab, DockPanelId } from './types'
import type { OpponentSearchResult } from '../hud/OpponentSearchPanel'
import type { HighlightedTarget } from './opponentSelectors'
import type { LoadoutCard } from './loadoutSelectors'
import type { HubTabMeta } from './loadoutSelectors'
import type { LedgerDockProps } from '@/components/hud/LedgerDock'
import type { RewardSummaryCardProps } from '@/components/hud/RewardSummaryCard'
import type { EnergizeToast } from './EnergizeToasts'
import type { EconomyConfig } from '@/src/config/economy'
import type { BlobletOverlayDetail } from './BlobletRenameOverlay'
import type { LandmarkOverlayDetail } from './LandmarkRenameOverlay'
import type { LootedAlertDetail } from '@/components/LootedAlertOverlay'

type HandlerMap = Record<string, (...args: any[]) => unknown>

export type RefreshRewardsHandler = (options?: { silent?: boolean }) => Promise<unknown>

export interface WorldCanvasBindings {
  gameplay: any
  energizeUi: EnergizeUiState
  myAddressCanonical: string
  activeHubTab: HubTab | null
  highlightOwnedLandmarks: boolean
  onEnergizeUiChange: Dispatch<SetStateAction<EnergizeUiState>>
  pendingEnergizeActionRef: MutableRefObject<any>
  onEnergizeAlert: Dispatch<SetStateAction<any>>
  refreshRewards: RefreshRewardsHandler
  prependBattle: (battle: any) => void
  updateLoadout: (payload: any) => void
  loadoutState: Record<string, any>
  holderMeta: Record<string, HolderMetaEntry>
  onHolderMetaSnapshot: (meta: Record<string, HolderMetaEntry>) => void
  minStake: number | null
  myWeaponStat: number
  selectedOpponent: string | null
  onSelectOpponent: (address: string | null) => void
  onOpenHubTab: (tab: HubTab) => void
  onCloseHub: () => void
  challengeWindowHandlers: HandlerMap
  rewardsWindowHandlers: HandlerMap
  onPointerTypeChange: (type: 'mouse' | 'touch' | 'pen') => void
  applyLoadouts: (payload: any) => void
  applyBattles: (payload: any) => void
  onHighlightsUpdate: (data: { selectedOpponentMeta: any; highlightedTargets: HighlightedTarget[] }) => void
  onMyAddressResolved: (address: string) => void
  onMyAddressDisplay: (value: string) => void
}

export interface WorldHudBindings {
  blobletOverlay: BlobletOverlayDetail | null
  blobletOverlayAnchor: { left: number; top: number } | null
  closeBlobletOverlay: () => void
  personaOverlay: LandmarkOverlayDetail | null
  personaOverlayAnchor: { left: number; top: number } | null
  closePersonaOverlay: () => void
  rewardBalance: number | null
  rewardBalanceLabel: string | null
  rewardBalanceDisplay: string
  rewardBadgeTooltip: string
  rewardButtonsDisabled: boolean
  personaEconomy: EconomyConfig
  openTopUpModal: () => void
  openHubTab: (tab: HubTab) => void
  closeHub: () => void
  lootedAlert: LootedAlertDetail | null
  onDismissLootedAlert: () => void
  refreshRewards: RefreshRewardsHandler
  showNavHint: boolean
  navPointerType: 'mouse' | 'touch' | 'pen'
  dismissNavHint: () => void
  dockTabs: HubTab[]
  activeHubTab: HubTab | null
  handleHubTabToggle: (tab: HubTab) => void
  hubTabMeta: HubTabMeta
  activeDockPanel: DockPanelId | null
  toggleDockPanel: (panel: DockPanelId) => void
  closeDockPanel: () => void
  highlightOwnedLandmarks: boolean
  highlightedTargets: HighlightedTarget[]
  opponentSearchQuery: string
  opponentSearchResults: OpponentSearchResult[]
  opponentSearchIndex: number
  opponentsHudVisible: boolean
  handleOpponentSearchChange: (val: string) => void
  handleOpponentSearchNavigate: (dir: 'next' | 'prev') => void
  handleOpponentSearchSubmit: () => void
  handleOpponentSearchSelect: (addr: string) => void
  handleOpponentSearchHover: (addr: string | null) => void
  handleOpponentSearchClearActive: () => void
  selectedOpponent: string | null
  selectedOpponentMeta: any
  selectedOpponentCooldown: number | null
  previewOpponent: (addr: string | null) => void
  focusOnAddress: (addr: string, opts?: any) => void
  openChallengeModal: (addr?: string) => void
  minStake: number | null
  toasts: EnergizeToast[]
  lifeHubModalVisible: boolean
  personaModalVisible: boolean
  gearManagerOpen: boolean
  closeGearManager: () => void
  topUpModalOpen: boolean
  closeTopUpModal: () => void
  lifeHubLoadout: {
    primaryCards: LoadoutCard[]
    futureCards: LoadoutCard[]
  }
  handleManageGear: () => void
  rewardSummary: RewardSummaryCardProps
  ledgerDockProps: LedgerDockProps
  arenaPanel: React.ReactNode
  myAddressCanonical: string
  myLandmarkCount: number
  handleOpenMyAssetsPanel: () => void
}

export interface WorldController {
  canvas: WorldCanvasBindings
  hud: WorldHudBindings
}

const WorldContext = createContext<WorldController | null>(null)

type WorldProviderProps = {
  value: WorldController
  children: ReactNode
}

export function WorldProvider({ value, children }: WorldProviderProps) {
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>
}

export function useWorld(): WorldController {
  const ctx = useContext(WorldContext)
  if (!ctx) {
    throw new Error('useWorld must be used within a WorldProvider')
  }
  return ctx
}

export function useWorldCanvas(): WorldCanvasBindings {
  return useWorld().canvas
}

export function useWorldHud(): WorldHudBindings {
  return useWorld().hud
}
