"use client"

import { useCallback, useState } from 'react'

import type { LedgerDockProps } from '../hud/LedgerDock'

type Args = {
  rewardLedgerEntries: LedgerDockProps['ledgerEntries']
  rewardSwapEntries: LedgerDockProps['swapEntries']
  rewardTokenSymbol: LedgerDockProps['rewardTokenSymbol']
  rewardsError: LedgerDockProps['rewardsError']
  rewardsLoading: LedgerDockProps['rewardsLoading']
  hasAddress: boolean
  walletConnected: boolean
  isHolder?: boolean | null
  minTokens?: number | null
}

export function useLedgerPanelState({
  rewardLedgerEntries,
  rewardSwapEntries,
  rewardTokenSymbol,
  rewardsError,
  rewardsLoading,
  hasAddress,
  walletConnected,
  isHolder,
  minTokens,
}: Args) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const toggleEntry = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const ledgerProps: LedgerDockProps = {
    ledgerEntries: rewardLedgerEntries,
    swapEntries: rewardSwapEntries,
    expandedIds,
    onToggleEntry: toggleEntry,
    rewardTokenSymbol,
    rewardsError,
    rewardsLoading,
    hasAddress,
    walletConnected,
    isHolder: typeof isHolder === 'boolean' ? isHolder : undefined,
    minTokens: minTokens ?? null,
  }

  return {
    ledgerProps,
    expandedIds,
    toggleEntry,
  }
}
