import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it } from 'vitest'

import { useRewardsModalState } from '@/components/bloblets-world/modalState'
import {
  EMPTY_TOP_UP_STATUS,
  type LifeHubTopUpStatus,
} from '@/components/life-hub/LifeHubProvider'

describe('useRewardsModalState', () => {
  function renderHarness() {
    let lastState: ReturnType<typeof useRewardsModalState> | null = null

    function Harness() {
      lastState = useRewardsModalState()
      return null
    }

    const renderer = TestRenderer.create(React.createElement(Harness))

    if (!lastState) {
      throw new Error('useRewardsModalState did not initialise for the test harness')
    }

    return {
      get state() {
        if (!lastState) {
          throw new Error('Rewards modal state not available')
        }
        return lastState
      },
      unmount: () => renderer.unmount(),
    }
  }

  it('resets the top-up status when cleared', () => {
    const harness = renderHarness()

    expect(harness.state.topUpStatus).toEqual(EMPTY_TOP_UP_STATUS)

    act(() => {
      harness.state.setTopUpStatus({
        active: true,
        phase: 'awaiting_payment',
        status: 'pending',
        notice: 'Waiting for transfer',
        orderId: 42,
        autoStatus: 'running',
        errorMessage: null,
      })
    })

    expect(harness.state.topUpStatus.active).toBe(true)
    expect(harness.state.topUpStatus.phase).toBe('awaiting_payment')
    expect(harness.state.topUpStatus.autoStatus).toBe('running')

    act(() => {
      harness.state.setTopUpStatus()
    })

    expect(harness.state.topUpStatus).toEqual(EMPTY_TOP_UP_STATUS)

    harness.unmount()
  })

  it('merges partial updates while keeping defaults', () => {
    const harness = renderHarness()

    const assertSnapshot = (expected: Partial<LifeHubTopUpStatus>) => {
      expect(harness.state.topUpStatus).toMatchObject(expected)
    }

    act(() => {
      harness.state.setTopUpStatus({
        phase: 'awaiting_payment',
        status: 'pending',
      })
    })
    assertSnapshot({
      phase: 'awaiting_payment',
      status: 'pending',
      active: false,
      autoStatus: 'idle',
    })

    act(() => {
      harness.state.setTopUpStatus({
        status: 'applied',
        autoStatus: 'success',
        notice: 'Buy Points credited.',
      })
    })

    assertSnapshot({
      phase: 'awaiting_payment',
      status: 'applied',
      notice: 'Buy Points credited.',
      autoStatus: 'success',
    })

    harness.unmount()
  })
})
