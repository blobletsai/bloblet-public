"use client"

import React from 'react'

import { CombatLogPanel } from './CombatLogPanel'
import { SupplyDepotPanel } from './SupplyDepotPanel'
import type { RewardLedgerEntry, RewardSwapEntry } from '@/components/hooks/useRewardsSnapshot'

export type LedgerDockProps = {
  ledgerEntries: RewardLedgerEntry[]
  swapEntries: RewardSwapEntry[]
  expandedIds: Set<number>
  onToggleEntry: (id: number) => void
  rewardTokenSymbol: string
  rewardsError: string | null
  rewardsLoading: boolean
  hasAddress: boolean
  walletConnected?: boolean
  isHolder?: boolean
  minTokens?: number | null
}

export const LedgerDock: React.FC<LedgerDockProps> = ({
  ledgerEntries,
  swapEntries,
  expandedIds,
  onToggleEntry,
  rewardTokenSymbol,
  rewardsError,
  rewardsLoading,
  hasAddress,
  walletConnected,
  isHolder,
  minTokens,
}) => {
  return (
    <div
      className="w-[340px] max-w-[calc(100vw-160px)] h-full overflow-y-auto pr-1 space-y-2"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(148,93,255,0.4) rgba(10,3,22,0.3)' }}
      data-hud-interactive="true"
    >
      <CombatLogPanel
        rewardsError={rewardsError}
        isLoading={rewardsLoading && ledgerEntries.length === 0}
        hasAddress={hasAddress}
        entries={ledgerEntries}
        expandedIds={expandedIds}
        onToggle={onToggleEntry}
        rewardTokenSymbol={rewardTokenSymbol}
        walletConnected={walletConnected}
        isHolder={isHolder}
        minTokens={minTokens ?? null}
      />
      <SupplyDepotPanel
        rewardsError={rewardsError}
        isLoading={rewardsLoading && swapEntries.length === 0}
        hasAddress={hasAddress}
        rewardSwapEntries={swapEntries}
        rewardTokenSymbol={rewardTokenSymbol}
        walletConnected={walletConnected}
        isHolder={isHolder}
        minTokens={minTokens ?? null}
      />
    </div>
  )
}
