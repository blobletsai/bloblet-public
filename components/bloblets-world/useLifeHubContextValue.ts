"use client"

import { useMemo } from 'react'

import type { EnergizeHudStatus, RefreshReason } from './energizeState'
import type { RewardsModalConfig } from '@/components/rewards-modal/types'
import type { LifeHubTopUpStatus } from '@/components/life-hub/LifeHubProvider'

type Args = {
  energizeUi: any
  energizeLoading: boolean
  energizeCost: number | null
  rewardBalance: number | null
  needsTopUp: boolean
  onEnergize: (orderId?: number | null) => Promise<boolean>
  onTopUp: () => void
  onFastForward?: () => Promise<boolean>
  disabledReason: string | null
  helperLabel: string
  errorMessage: string | null
  walletConnected: boolean
  rewardsConfig?: RewardsModalConfig
  hudStatus: EnergizeHudStatus
  coverageCountdownLabel: string
  topUpStatus: LifeHubTopUpStatus
  setTopUpStatus: (next?: Partial<LifeHubTopUpStatus>) => void
  refreshStatus: (reason?: RefreshReason) => Promise<void>
  statusRefreshing: boolean
  refreshRewardsSnapshot?: (options?: { silent?: boolean }) => Promise<unknown>
  fetchRewardBalance?: () => Promise<number | null>
  fastForwardAvailable?: boolean
  fastForwardDisabledReason?: string | null
  refreshStatusFn?: (reason?: RefreshReason) => Promise<void>
}

export function useLifeHubContextValue({
  energizeUi,
  energizeLoading,
  energizeCost,
  rewardBalance,
  needsTopUp,
  onEnergize,
  onTopUp,
  onFastForward,
  disabledReason,
  helperLabel,
  errorMessage,
  walletConnected,
  rewardsConfig,
  hudStatus,
  coverageCountdownLabel,
  topUpStatus,
  setTopUpStatus,
  refreshStatus,
  statusRefreshing,
  refreshRewardsSnapshot,
  fetchRewardBalance,
  fastForwardAvailable,
  fastForwardDisabledReason,
  refreshStatusFn,
}: Args) {
  return useMemo(
    () => ({
      energize: energizeUi,
      energizing: energizeLoading,
      energizeCost,
      rewardBalance,
      needsTopUp,
      onEnergize,
      onTopUp,
      onFastForward,
      disabledReason,
      helperLabel,
      errorMessage,
      walletConnected,
      isHolder: rewardsConfig?.isHolder ?? null,
      minTokens: rewardsConfig?.minTokens ?? null,
      hudStatus,
      coverageCountdownLabel,
      topUpStatus,
      setTopUpStatus,
      refreshStatus,
      statusRefreshing,
      refreshRewardsSnapshot,
      fetchRewardBalance,
      fastForwardAvailable,
      fastForwardDisabledReason,
      refreshStatusFn: refreshStatusFn || refreshStatus,
    }),
    [
      coverageCountdownLabel,
      disabledReason,
      energizeCost,
      energizeLoading,
      energizeUi,
      errorMessage,
      helperLabel,
      hudStatus,
      needsTopUp,
      onEnergize,
      onTopUp,
      onFastForward,
      refreshStatus,
      rewardBalance,
      rewardsConfig?.isHolder,
      rewardsConfig?.minTokens,
      setTopUpStatus,
      statusRefreshing,
      topUpStatus,
      walletConnected,
      refreshRewardsSnapshot,
      fetchRewardBalance,
      fastForwardAvailable,
      fastForwardDisabledReason,
      refreshStatusFn,
    ],
  )
}
