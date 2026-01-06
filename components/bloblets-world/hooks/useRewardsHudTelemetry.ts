"use client"

import { useMemo } from 'react'
import type { RewardsModalConfig } from '@/components/rewards-modal/types'
import type { RewardsSnapshot } from '@/components/hooks/useRewardsSnapshot'
import { formatTimeAgo } from '../formatters'
import { formatDisplayPoints } from '@/src/shared/points'
import { formatRewardBalanceLabel } from '../rewardsSelectors'
import { useRewardsSummary } from '../useRewardsSummary'
import { useLedgerPanelState } from '../useLedgerPanelState'

type UseRewardsHudTelemetryArgs = {
  myAddressCanonical: string | null
  rewardBalance: number | null
  rewardsSnapshot: RewardsSnapshot | null
  rewardsConfig?: RewardsModalConfig
  rewardsLoading: boolean
  rewardsError: string | null
  rewardsUpdatedAt: string | number | null
  refreshRewards: (options?: { silent?: boolean }) => Promise<unknown>
  openTopUpModal: () => void
}

export type RewardsHudTelemetryResult = {
  rewardBalanceLabel: string | null
  rewardBalanceDisplay: string
  gateRequirementLabel: string | null
  rewardBadgeTooltip: string
  rewardSummary: ReturnType<typeof useRewardsSummary>['rewardSummary']
  rewardButtonsDisabled: boolean
  ledgerDockProps: ReturnType<typeof useLedgerPanelState>['ledgerProps']
}

export function useRewardsHudTelemetry({
  myAddressCanonical,
  rewardBalance,
  rewardsSnapshot,
  rewardsConfig,
  rewardsLoading,
  rewardsError,
  rewardsUpdatedAt,
  refreshRewards,
  openTopUpModal,
}: UseRewardsHudTelemetryArgs): RewardsHudTelemetryResult {
  const rewardLedgerEntries = useMemo(() => (rewardsSnapshot?.ledger ?? []).slice(0, 5), [rewardsSnapshot])
  const rewardSwapEntries = useMemo(() => (rewardsSnapshot?.swaps ?? []).slice(0, 3), [rewardsSnapshot])

  const rewardsLastUpdatedLabel = useMemo(() => {
    if (!rewardsUpdatedAt) return null
    const iso = typeof rewardsUpdatedAt === 'number' ? new Date(rewardsUpdatedAt).toISOString() : rewardsUpdatedAt
    return formatTimeAgo(iso)
  }, [rewardsUpdatedAt])

  const rewardTokenSymbol = useMemo(
    () => (rewardsConfig?.tokenSymbol || 'BLOBLET'),
    [rewardsConfig?.tokenSymbol],
  )

  const rewardBalanceLabel = useMemo(
    () => formatRewardBalanceLabel(rewardBalance),
    [rewardBalance],
  )

  const rewardBalanceDisplay = rewardBalanceLabel || '—'

  const gateRequirementLabel = useMemo(() => {
    const min = rewardsConfig?.minTokens
    if (min == null) return null
    if (!Number.isFinite(min)) return null
    return `≥ ${formatDisplayPoints(min, min >= 1000 ? { maximumFractionDigits: 0 } : undefined)} ${rewardTokenSymbol}`
  }, [rewardTokenSymbol, rewardsConfig?.minTokens])

  const {
    rewardBadgeTooltip,
    rewardSummary,
    rewardButtonsDisabled,
  } = useRewardsSummary({
    myAddressCanonical,
    rewardBalance,
    rewardBalanceLabel,
    rewardsLoading,
    rewardsError,
    rewardsLastUpdatedLabel,
    hasSnapshot: Boolean(rewardsSnapshot),
    refreshRewards,
    openTopUpModal,
  })

  const { ledgerProps } = useLedgerPanelState({
    rewardLedgerEntries,
    rewardSwapEntries,
    rewardTokenSymbol,
    rewardsError,
    rewardsLoading,
    hasAddress: Boolean(myAddressCanonical),
    walletConnected: Boolean(rewardsConfig?.walletConnected),
    isHolder: rewardsConfig?.isHolder ?? null,
    minTokens: rewardsConfig?.minTokens ?? null,
  })

  return {
    rewardBalanceLabel,
    rewardBalanceDisplay,
    gateRequirementLabel,
    rewardBadgeTooltip,
    rewardSummary,
    rewardButtonsDisabled,
    ledgerDockProps: ledgerProps,
  }
}
