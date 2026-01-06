"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import { chargeCostPoints } from '@/src/shared/care'
import { formatDisplayPoints } from '@/src/shared/points'
import { useRewardsSnapshot } from '@/components/hooks/useRewardsSnapshot'
import type { RewardsModalConfig } from '@/components/rewards-modal/types'
import type { GameplayState } from '@/src/client/realtime/gameplay/types'
import { useEnergizeTelemetry } from '../bloblets-world/hooks/useEnergizeTelemetry'
import { useEnergizePanel } from './useEnergizePanel'
import { useEnergizeHandler } from '../bloblets-world/useEnergizeHandler'
import { useLifeHubContextValue } from '../bloblets-world/useLifeHubContextValue'
import { useRewardsModalState } from '../bloblets-world/modalState'
import {
  emptyEnergizeUi,
  toEnergizeUiState,
  type EnergizeAlert,
  type EnergizeUiState,
} from '../bloblets-world/energizeState'
import type { LifeHubContextValue } from './LifeHubProvider'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import type { EnergizeToast } from '../bloblets-world/EnergizeToasts'
import { fetchPlayerStatusSnapshot } from '@/src/client/hooks/usePlayerStatus'

type GameplayLike = Pick<GameplayState, 'connection' | 'rewardsByAddress'>

type UseLifeHubServiceOptions = {
  walletAddress: string | null
  walletAddressCanonical: string | null
  gameplay: GameplayLike
  rewardsConfig?: RewardsModalConfig
  formatTimeLabel: (iso: string | null | undefined) => string
}

export type LifeHubServiceResult = {
  lifeHubValue: LifeHubContextValue
  toasts: EnergizeToast[]
  rewardBalance: number | null
  rewardsSnapshot: ReturnType<typeof useRewardsSnapshot>['snapshot']
  rewardsLoading: boolean
  rewardsError: string | null
  rewardsUpdatedAt: number | null
  refreshRewards: ReturnType<typeof useRewardsSnapshot>['refresh']
  openTopUpModal: ReturnType<typeof useRewardsModalState>['openTopUpModal']
  closeTopUpModal: ReturnType<typeof useRewardsModalState>['closeTopUpModal']
  topUpModalOpen: boolean
  rewardsWindowHandlers: ReturnType<typeof useRewardsModalState>['rewardsWindowHandlers']
  telemetry: {
    setEnergizeUi: Dispatch<SetStateAction<EnergizeUiState>>
    setEnergizeAlert: Dispatch<SetStateAction<EnergizeAlert>>
    pendingEnergizeActionRef: MutableRefObject<string | null>
  }
}

export function useLifeHubService({
  walletAddress,
  walletAddressCanonical,
  gameplay,
  rewardsConfig,
  formatTimeLabel,
}: UseLifeHubServiceOptions): LifeHubServiceResult {
  const [energizeLoading, setEnergizeLoading] = useState(false)
  const [energizeError, setEnergizeError] = useState<string | null>(null)

  const {
    energizeUi,
    setEnergizeUi,
    energizeAlert,
    setEnergizeAlert,
    pendingEnergizeActionRef,
    toasts,
    refreshStatus,
    statusRefreshing,
  } = useEnergizeTelemetry({
    shouldPollFallback: gameplay.connection !== 'open',
  })

  const {
    topUpModalOpen,
    openTopUpModal,
    closeTopUpModal,
    topUpStatus,
    setTopUpStatus,
    rewardsWindowHandlers,
  } = useRewardsModalState()

  const {
    snapshot: rewardsSnapshot,
    loading: rewardsLoading,
    error: rewardsError,
    refresh: refreshRewards,
    lastUpdated: rewardsUpdatedAt,
  } = useRewardsSnapshot(Boolean(walletAddressCanonical), {
    pollIntervalMs: gameplay.connection === 'open' ? 600000 : undefined,
  })

  // Detect wallet changes and reset energize state
  const prevAddressRef = useRef(walletAddressCanonical)
  useEffect(() => {
    const prevAddress = prevAddressRef.current
    if (prevAddress === walletAddressCanonical) return

    setEnergizeUi(() => emptyEnergizeUi())
    setEnergizeAlert(null)
    pendingEnergizeActionRef.current = null

    if (walletAddressCanonical) {
      refreshRewards({ silent: true }).catch(() => {})
      refreshStatus('manual').catch(() => {})
      emitClientEvent(CLIENT_EVENT.VERIFIED, { address: walletAddressCanonical })
    }

    prevAddressRef.current = walletAddressCanonical
  }, [pendingEnergizeActionRef, refreshRewards, refreshStatus, setEnergizeAlert, setEnergizeUi, walletAddressCanonical])

  useEffect(() => {
    if (energizeError && energizeUi.state === 'covered') {
      setEnergizeError(null)
    }
  }, [energizeError, energizeUi.state])

  const realtimeLedgerEntry = walletAddress ? gameplay.rewardsByAddress.get(walletAddress) : undefined
  const defaultEnergizeCost = useMemo(() => chargeCostPoints(), [])
  const activeEnergizeCost = energizeUi.energizeCost ?? defaultEnergizeCost
  const rewardBalance = realtimeLedgerEntry?.balanceAfter != null
    ? Number(realtimeLedgerEntry.balanceAfter)
    : rewardsSnapshot?.balance ?? null
  const needsTopUp =
    rewardBalance != null && Number.isFinite(activeEnergizeCost)
      ? rewardBalance + 1e-6 < activeEnergizeCost
      : false

  const gateRequirementLabel = useMemo(() => {
    const minTokens = rewardsConfig?.minTokens
    if (minTokens == null || !Number.isFinite(minTokens)) return null
    const tokenSymbol = rewardsConfig?.tokenSymbol || 'BLOBLET'
    const formatted = formatDisplayPoints(
      minTokens,
      minTokens >= 1000 ? { maximumFractionDigits: 0 } : undefined,
    )
    return `≥ ${formatted} ${tokenSymbol}`
  }, [rewardsConfig?.minTokens, rewardsConfig?.tokenSymbol])

  const {
    coverageCountdownLabel,
    hudStatus: energizeHudStatus,
    disabledReason: energizeDisabledReason,
    helperLabel: energizeHelperLabel,
    fastForwardAvailable,
    fastForwardDisabledReason,
  } = useEnergizePanel({
    energizeUi,
    energizeLoading,
    walletAddressLower: walletAddressCanonical,
    needsTopUp,
    rewardsConfig,
    gateRequirementLabel,
    formatTimeLabel,
    topUpStatus,
  })

  const handleEnergize = useEnergizeHandler({
    energizeLoading,
    setEnergizeLoading,
    setEnergizeError,
    setEnergizeAlert,
    setEnergizeUi,
    openTopUpModal,
    formatTimeLabel,
    refreshRewards,
    refreshStatus,
    myAddressCanonical: walletAddressCanonical,
  })

  const handleFastForward = useCallback(async () => {
    return handleEnergize(null, 'fast-forward')
  }, [handleEnergize])

  const walletConnected = Boolean(walletAddressCanonical)

  const fetchRewardBalance = useCallback(async () => {
    try {
      const snapshot = await refreshRewards({ silent: true })
      if (snapshot && typeof snapshot.balance === 'number' && Number.isFinite(snapshot.balance)) {
        return Number(snapshot.balance)
      }
      return rewardBalance
    } catch {
      return rewardBalance
    }
  }, [refreshRewards, rewardBalance])

  const lifeHubValue = useLifeHubContextValue({
    energizeUi,
    energizeLoading,
    energizeCost: activeEnergizeCost,
    rewardBalance,
    needsTopUp,
    onEnergize: handleEnergize,
    onTopUp: openTopUpModal,
    onFastForward: handleFastForward,
    disabledReason: energizeDisabledReason,
    helperLabel: energizeHelperLabel,
    errorMessage: energizeError,
    walletConnected,
    rewardsConfig,
    hudStatus: energizeHudStatus,
    coverageCountdownLabel,
    topUpStatus,
    setTopUpStatus,
    refreshStatus,
    refreshStatusFn: refreshStatus,
    statusRefreshing,
    refreshRewardsSnapshot: refreshRewards,
    fetchRewardBalance,
    fastForwardAvailable,
    fastForwardDisabledReason,
  })

  const { onFastForward, onEnergize } = lifeHubValue

  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(window as any).__lifeHub = {
      fastForwardAvailable,
      fastForwardDisabledReason,
      disabledReason: energizeDisabledReason,
      energizeUi,
      onFastForward: onFastForward ?? null,
      onEnergize: onEnergize ?? null,
      refreshStatus,
    }
  }, [energizeDisabledReason, energizeUi, fastForwardAvailable, fastForwardDisabledReason, onEnergize, onFastForward, refreshStatus])

  useEffect(() => {
    let cancelled = false
    if (!walletAddressCanonical) return
    ;(async () => {
      try {
        const status = await fetchPlayerStatusSnapshot()
        if (cancelled || !status?.care) return
        setEnergizeUi(() => toEnergizeUiState(status.care))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setEnergizeUi, walletAddressCanonical])

  // Always hydrate from status once on mount, even if realtime is open, so we don't stay on the empty snapshot
  useEffect(() => {
    refreshStatus('init').catch(() => {})
  }, [refreshStatus])

  return {
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
    telemetry: {
      setEnergizeUi,
      setEnergizeAlert,
      pendingEnergizeActionRef,
    },
  }
}
