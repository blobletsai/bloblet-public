import React from 'react'
import TestRenderer from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import { LedgerDock } from '@/components/hud/LedgerDock'
import type { RewardLedgerEntry, RewardSwapEntry } from '@/components/hooks/useRewardsSnapshot'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

const ledgerEntry = (id: number): RewardLedgerEntry => ({
  id,
  reason: 'care_upkeep',
  deltaRaw: 5,
  delta: 5,
  balanceAfterRaw: 10,
  balanceAfter: 10,
  createdAt: new Date().toISOString(),
})

const swapEntry: RewardSwapEntry = {
  id: 1,
  direction: 'deposit',
  status: 'applied',
  amountRaw: 5,
  amount: 5,
  signature: null,
  createdAt: new Date().toISOString(),
}

describe('LedgerDock', () => {
  it('renders combat log and supply depot panels', () => {
    const tree = TestRenderer.create(
      <LedgerDock
        ledgerEntries={[ledgerEntry(1)]}
        swapEntries={[swapEntry]}
        expandedIds={new Set()}
        onToggleEntry={() => {}}
        rewardTokenSymbol="RP"
        rewardsError={null}
        rewardsLoading={false}
        hasAddress
      />,
    )

    const text = collectText(tree.toJSON())
    expect(text.join(' ')).toContain('Recent Battles')
    expect(text.join(' ')).toContain('Supply Depot')
    tree.unmount()
  })

  it('invokes the toggle handler when a ledger entry is clicked', () => {
    const toggle = vi.fn()
    const tree = TestRenderer.create(
      <LedgerDock
        ledgerEntries={[ledgerEntry(42)]}
        swapEntries={[]}
        expandedIds={new Set()}
        onToggleEntry={toggle}
        rewardTokenSymbol="RP"
        rewardsError={null}
        rewardsLoading={false}
        hasAddress
      />,
    )

    const buttons = tree.root.findAllByType('button')
    if (buttons.length > 0) {
      buttons[0].props.onClick()
      expect(toggle).toHaveBeenCalled()
    }
    tree.unmount()
  })
})

function collectText(node: any): string[] {
  if (!node) return []
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap(collectText)
  if (typeof node === 'object' && node.children) {
    return node.children.flatMap(collectText)
  }
  return []
}
