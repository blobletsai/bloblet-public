"use client"

import { useCallback, useMemo } from 'react'

import type { RewardSummaryCardProps } from '@/components/hud/RewardSummaryCard'
import { formatDisplayPoints } from '@/src/shared/points'

type Args = {
  myAddressCanonical: string | null
  rewardBalance: number | null
  rewardBalanceLabel: string | null
  rewardsLoading: boolean
  rewardsError: string | null
  rewardsLastUpdatedLabel: string | null
  hasSnapshot: boolean
  refreshRewards: (options?: { silent?: boolean }) => Promise<unknown>
  openTopUpModal: () => void
}

type Result = {
  rewardBadgeTooltip: string
  rewardSummary: RewardSummaryCardProps
  handleRefreshRewards: () => void
  rewardButtonsDisabled: boolean
}

export function useRewardsSummary({
  myAddressCanonical,
  rewardBalance,
  rewardBalanceLabel,
  rewardsLoading,
  rewardsError,
  rewardsLastUpdatedLabel,
  hasSnapshot,
  refreshRewards,
  openTopUpModal,
}: Args): Result {
  const rewardButtonsDisabled = rewardsLoading && !hasSnapshot

  const rewardBadgeTooltip = useMemo(() => {
    if (!myAddressCanonical) return 'Connect wallet to view BlobCoin.'
    if (rewardsError) return `BlobCoin unavailable — ${rewardsError}`
    if (rewardsLoading && !rewardBalanceLabel) return 'Loading BlobCoin…'
    const baseLabel = rewardBalanceLabel
      ? `BlobCoin: ${rewardBalanceLabel}`
      : `BlobCoin: ${formatDisplayPoints(rewardBalance ?? 0)}`
    const updated = rewardsLastUpdatedLabel ? `Updated ${rewardsLastUpdatedLabel} ago` : null
    return [baseLabel, updated].filter(Boolean).join(' · ') || baseLabel
  }, [
    myAddressCanonical,
    rewardBalance,
    rewardBalanceLabel,
    rewardsError,
    rewardsLastUpdatedLabel,
    rewardsLoading,
  ])

  const handleRefreshRewards = useCallback(() => {
    refreshRewards().catch(() => {})
  }, [refreshRewards])

  const rewardSummary: RewardSummaryCardProps = useMemo(() => ({
    balanceLabel: rewardBalanceLabel,
    balance: rewardBalance,
    loading: rewardsLoading,
    hasWallet: Boolean(myAddressCanonical),
    errorMessage: rewardsError,
    onRefresh: handleRefreshRewards,
    onBuyPoints: openTopUpModal,
    buyDisabled: rewardButtonsDisabled,
  }), [
    handleRefreshRewards,
    myAddressCanonical,
    openTopUpModal,
    rewardBalance,
    rewardBalanceLabel,
    rewardButtonsDisabled,
    rewardsError,
    rewardsLoading,
  ])

  return {
    rewardBadgeTooltip,
    rewardSummary,
    handleRefreshRewards,
    rewardButtonsDisabled,
  }
}
