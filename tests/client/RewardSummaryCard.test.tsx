import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TestRenderer from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import { RewardSummaryCard } from '@/components/hud/RewardSummaryCard'

// Ensure React is available for JSX within Vitest
(globalThis as typeof globalThis & { React?: typeof React }).React = React

const baseProps = {
  balanceLabel: '120',
  balance: 120,
  loading: false,
  hasWallet: true,
  errorMessage: null,
  onRefresh: vi.fn(),
  onBuyPoints: vi.fn(),
  buyDisabled: false,
}

describe('RewardSummaryCard', () => {
  it('renders the balance label and action buttons', () => {
    const markup = renderToStaticMarkup(<RewardSummaryCard {...baseProps} />)
    expect(markup).toContain('120')
    expect(markup).toContain('Buy BlobCoin')
  })

  it('disables actions when configured', () => {
    const tree = TestRenderer.create(
      <RewardSummaryCard
        {...baseProps}
        buyDisabled
      />,
    )
    const buyButton = tree.root
      .findAllByType('button')
      .find((btn) => btn.props.onClick === baseProps.onBuyPoints)
    expect(buyButton).toBeDefined()
    expect(buyButton?.props.disabled).toBe(true)
  })

  it('shows an error message when provided', () => {
    const markup = renderToStaticMarkup(
      <RewardSummaryCard
        {...baseProps}
        errorMessage="Ledger offline"
      />,
    )
    expect(markup).toContain('Ledger offline')
    expect(markup).not.toContain('Buy BlobCoin')
  })
})
