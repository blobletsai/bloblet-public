import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TestRenderer from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import { RewardBadge } from '@/components/hud/RewardBadge'

// Vitest + esbuild compile the client components with the classic JSX runtime,
// so we expose React on the global scope to satisfy createElement lookups.
(globalThis as typeof globalThis & { React?: typeof React }).React = React

describe('RewardBadge', () => {
  it('renders the tooltip and balance label', () => {
    const markup = renderToStaticMarkup(
      <RewardBadge
        tooltip="BlobCoin: 120 BC"
        balanceLabel="120"
        onBuyPoints={() => {}}
        walletButton={<span>Wallet</span>}
      />,
    )

    expect(markup).toContain('BlobCoin: 120 BC')
    expect(markup).toContain('120')
    expect(markup).toContain('Wallet')
  })

  it('invokes the buy handler when clicked', () => {
    const handler = vi.fn()
    const tree = TestRenderer.create(
      <RewardBadge
        tooltip="BlobCoin"
        balanceLabel="50"
        onBuyPoints={handler}
        walletButton={<span>Wallet</span>}
      />,
    )

    const button = tree.root.findByType('button')
    button.props.onClick()
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
