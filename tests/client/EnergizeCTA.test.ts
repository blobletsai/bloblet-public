import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type {
  EnergizeHudStatus,
  EnergizeUiState,
} from '@/components/bloblets-world/energizeState'
import { EnergizeCTA } from '@/components/life-hub/EnergizeCTA'
import {
  EMPTY_TOP_UP_STATUS,
  LifeHubProvider,
  type LifeHubContextValue,
} from '@/components/life-hub/LifeHubProvider'

// Vitest + esbuild compile the client components with the classic JSX runtime,
// so we expose React on the global scope to satisfy createElement lookups.
(globalThis as typeof globalThis & { React?: typeof React }).React = React

function makeEnergizeState(overrides: Partial<EnergizeUiState> = {}): EnergizeUiState {
  return {
    state: 'ready',
    boosterLevel: 2,
    boostersActiveUntil: null,
    cooldownEndsAt: null,
    overdue: false,
    lastEnergizeAt: null,
    energizeCost: 12,
    consumedOrder: null,
    ...overrides,
  }
}

function makeHudStatus(overrides: Partial<EnergizeHudStatus> = {}): EnergizeHudStatus {
  return {
    title: 'Ready to Energize',
    highlight: 'READY',
    detail: 'Refresh boosters when you are ready.',
    tone: 'idle',
    ...overrides,
  }
}

function renderCTA(
  contextOverrides: Partial<LifeHubContextValue> = {},
  ctaProps: React.ComponentProps<typeof EnergizeCTA> = {},
) {
  const value: LifeHubContextValue = {
    energize: makeEnergizeState(),
    energizing: false,
    energizeCost: 12,
    rewardBalance: 120,
    needsTopUp: false,
    onEnergize: async () => true,
    onTopUp: undefined,
    disabledReason: null,
    helperLabel: null,
    errorMessage: null,
    walletConnected: true,
    isHolder: true,
    minTokens: null,
    hudStatus: makeHudStatus(),
    coverageCountdownLabel: 'READY',
    topUpStatus: { ...EMPTY_TOP_UP_STATUS },
    setTopUpStatus: undefined,
    refreshStatus: async () => {},
    statusRefreshing: false,
    ...contextOverrides,
  }

  const element = React.createElement(
    LifeHubProvider,
    { value, children: React.createElement(EnergizeCTA, ctaProps) } as React.ComponentProps<typeof LifeHubProvider>,
  )

  return renderToStaticMarkup(element)
}

describe('EnergizeCTA', () => {
  it('renders the ready state when enabled', () => {
    const markup = renderCTA()
    expect(markup).toContain('Nourish')
    expect(markup).toContain('Nourishing refreshes boosters, rolls for loot, and resets cooldowns.')
    expect(markup).not.toContain('cursor-not-allowed')
    expect(markup).not.toContain('Buy BlobCoin')
  })

  it('disables the button and shows loading copy while energizing', () => {
    const markup = renderCTA({ energizing: true })
    expect(markup).toContain('Nourishing…')
    expect(markup).toContain('disabled')
    expect(markup).toContain('cursor-not-allowed')
  })

  it('shows helper copy and Buy Points CTA when top-up flow is available', () => {
    const markup = renderCTA({
      disabledReason: 'Buy BlobCoin required.',
      helperLabel: 'Buy BlobCoin to add BlobCoin before nourishing.',
      onTopUp: () => {},
    })
    expect(markup).toContain('Buy BlobCoin')
    expect(markup).toContain('Buy BlobCoin to add BlobCoin before nourishing.')
    expect(markup).toContain('cursor-not-allowed')
  })
})
