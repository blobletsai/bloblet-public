import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it } from 'vitest'

import {
  emptyEnergizeUi,
  type EnergizeUiState,
} from '@/components/bloblets-world/energizeState'
import { useEnergizePanel } from '@/components/life-hub/useEnergizePanel'
import type { LifeHubTopUpStatus } from '@/components/life-hub/LifeHubProvider'

type HookParams = Parameters<typeof useEnergizePanel>[0]

function defaultParams(): HookParams {
  return {
    energizeUi: emptyEnergizeUi(),
    energizeLoading: false,
    walletAddressLower: '0xabc',
    needsTopUp: false,
    rewardsConfig: undefined,
    gateRequirementLabel: null,
    formatTimeLabel: () => '10:00',
    topUpStatus: undefined,
  }
}

function renderHook(params: Partial<HookParams> = {}) {
  let latestResult: ReturnType<typeof useEnergizePanel> | null = null

  function Harness({ testParams }: { testParams: HookParams }) {
    latestResult = useEnergizePanel(testParams)
    return null
  }

  const initialParams = { ...defaultParams(), ...params }
  const renderer = TestRenderer.create(React.createElement(Harness, { testParams: initialParams }))

  return {
    get result() {
      if (!latestResult) {
        throw new Error('Hook result not initialised')
      }
      return latestResult
    },
    update(next: Partial<HookParams>) {
      const updated = { ...defaultParams(), ...next }
      act(() => {
        renderer.update(React.createElement(Harness, { testParams: updated }))
      })
    },
    unmount() {
      renderer.unmount()
    },
  }
}

describe('useEnergizePanel top-up helper states', () => {
  it('surfaces auto-energize progress while top-up completes', () => {
    const topUpStatus: LifeHubTopUpStatus = {
      active: true,
      open: true,
      phase: 'applying',
      status: 'pending',
      notice: null,
      orderId: 42,
      autoStatus: 'running',
      errorMessage: null,
    }
    const harness = renderHook({ topUpStatus })

    expect(harness.result.disabledReason).toBe('Auto-nourish in progress…')
    expect(harness.result.helperLabel).toBe('Auto-nourish in progress…')

    harness.unmount()
  })

  it('shows a ready message once the top-up applied and auto-energize succeeded', () => {
    const topUpStatus: LifeHubTopUpStatus = {
      active: false,
      open: false,
      phase: 'applied',
      status: 'applied',
      notice: null,
      orderId: 42,
      autoStatus: 'success',
      errorMessage: null,
    }
    const harness = renderHook({ topUpStatus })

    expect(harness.result.disabledReason).toBeNull()
    expect(harness.result.helperLabel).toBe('Buy BlobCoin credited — Nourish ready.')

    harness.unmount()
  })

  it('shows a ready message once the top-up applied without auto-energize', () => {
    const topUpStatus: LifeHubTopUpStatus = {
      active: false,
      open: false,
      phase: 'applied',
      status: 'applied',
      notice: null,
      orderId: 77,
      autoStatus: 'idle',
      errorMessage: null,
    }
    const harness = renderHook({ topUpStatus })

    expect(harness.result.disabledReason).toBeNull()
    expect(harness.result.helperLabel).toBe('Buy BlobCoin credited — Nourish ready.')

    harness.unmount()
  })

  it('surfaces auto-energize errors without blocking energize', () => {
    const topUpStatus: LifeHubTopUpStatus = {
      active: false,
      open: true,
      phase: 'applied',
      status: 'applied',
      notice: null,
      orderId: 55,
      autoStatus: 'error',
      errorMessage: 'Custom failure copy.',
    }
    const harness = renderHook({ topUpStatus })

    expect(harness.result.disabledReason).toBeNull()
    expect(harness.result.helperLabel).toBe('Custom failure copy.')

    harness.unmount()
  })

  it('detects fast-forward availability correctly', () => {
    const energizeUi: EnergizeUiState = {
      ...emptyEnergizeUi(),
      state: 'cooldown',
      cooldownEndsAt: new Date(Date.now() + 50000).toISOString(),
      fastForwardEligible: true,
      fastForwardBurstsRemaining: 2,
      fastForwardDebtUntil: null,
      fastForwardIsNewcomer: true,
    }
    const harness = renderHook({ energizeUi })

    expect(harness.result.fastForwardAvailable).toBe(true)
    expect(harness.result.fastForwardDisabledReason).toBeNull()
    expect(harness.result.helperLabel).toBe('Fast-forward available — debt applies')

    harness.unmount()
  })

  it('hides fast-forward if debt is active', () => {
    const energizeUi: EnergizeUiState = {
      ...emptyEnergizeUi(),
      state: 'cooldown',
      cooldownEndsAt: new Date(Date.now() + 50000).toISOString(),
      fastForwardEligible: true,
      fastForwardBurstsRemaining: 2,
      fastForwardDebtUntil: new Date(Date.now() + 100000).toISOString(),
      fastForwardIsNewcomer: true,
    }
    const harness = renderHook({ energizeUi })

    expect(harness.result.fastForwardAvailable).toBe(false)
    expect(harness.result.fastForwardDisabledReason).toBeNull()
    expect(harness.result.helperLabel).not.toBe('Fast-forward available — debt applies')

    harness.unmount()
  })

  it('shows fast-forward during covered window when eligible', () => {
    const energizeUi: EnergizeUiState = {
      ...emptyEnergizeUi(),
      state: 'covered',
      boostersActiveUntil: new Date(Date.now() + 50000).toISOString(),
      cooldownEndsAt: new Date(Date.now() + 50000).toISOString(),
      fastForwardEligible: true,
      fastForwardBurstsRemaining: 2,
      fastForwardDebtUntil: null,
      fastForwardIsNewcomer: true,
    }
    const harness = renderHook({ energizeUi })

    expect(harness.result.fastForwardAvailable).toBe(true)
    expect(harness.result.fastForwardDisabledReason).toBeNull()
    expect(harness.result.helperLabel).toBe('Fast-forward available — debt applies')

    harness.unmount()
  })

  it('trusts server eligibility and hides fast-forward when marked ineligible', () => {
    const energizeUi: EnergizeUiState = {
      ...emptyEnergizeUi(),
      state: 'covered',
      boostersActiveUntil: new Date(Date.now() + 50000).toISOString(),
      cooldownEndsAt: new Date(Date.now() + 50000).toISOString(),
      fastForwardEligible: false,
      fastForwardBurstsRemaining: 0,
      fastForwardDebtUntil: null,
      fastForwardIsNewcomer: true,
    }
    const harness = renderHook({ energizeUi })

    expect(harness.result.fastForwardAvailable).toBe(false)
    expect(harness.result.fastForwardDisabledReason).toBeNull()

    harness.unmount()
  })

  it('uses newcomer+bursts fallback when eligibility flag is false', () => {
    const energizeUi: EnergizeUiState = {
      ...emptyEnergizeUi(),
      state: 'cooldown',
      cooldownEndsAt: new Date(Date.now() + 50000).toISOString(),
      fastForwardEligible: false,
      fastForwardBurstsRemaining: 2,
      fastForwardDebtUntil: null,
      fastForwardIsNewcomer: true,
    }
    const harness = renderHook({ energizeUi })

    expect(harness.result.fastForwardAvailable).toBe(true)
    expect(harness.result.helperLabel).toBe('Fast-forward available — debt applies')

    harness.unmount()
  })

  it('keeps fast-forward disabled when balance is insufficient even if eligible', () => {
    const energizeUi: EnergizeUiState = {
      ...emptyEnergizeUi(),
      state: 'cooldown',
      cooldownEndsAt: new Date(Date.now() + 50000).toISOString(),
      fastForwardEligible: true,
      fastForwardBurstsRemaining: 2,
      fastForwardDebtUntil: null,
      fastForwardIsNewcomer: true,
    }
    const harness = renderHook({ energizeUi, needsTopUp: true })

    expect(harness.result.fastForwardAvailable).toBe(true)
    expect(harness.result.fastForwardDisabledReason).toBe('Buy BlobCoin to add BlobCoin before nourishing.')
    expect(harness.result.helperLabel).toBe('Buy BlobCoin to add BlobCoin before nourishing.')

    harness.unmount()
  })
})
