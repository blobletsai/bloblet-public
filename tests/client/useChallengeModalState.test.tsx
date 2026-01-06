import React from 'react'
import TestRenderer from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useChallengeModalState } from '@/components/bloblets-world/modalState'
import type { PvpBattle } from '@/types'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

type HookArgs = Parameters<typeof useChallengeModalState>[0]

type HarnessHandle = {
  result: ReturnType<typeof useChallengeModalState>
  update: (next: Partial<HookArgs>) => void
  unmount: () => void
}

const emptyBattleFeed: PvpBattle[] = []

function defaultArgs(): HookArgs {
  return {
    holderMeta: {
      '0xDEF': {
        balance: 12,
        name: null,
        addressCased: '0xDEF',
        aliveUrl: null,
        deadUrl: null,
      },
      '0xLOW': {
        balance: 3,
        name: null,
        addressCased: '0xLOW',
        aliveUrl: null,
        deadUrl: null,
      },
      '0xunknown': {
        balance: null,
        name: null,
        addressCased: '0xunknown',
        aliveUrl: null,
        deadUrl: null,
      },
    },
    battleFeed: emptyBattleFeed,
    myAddress: '0xme',
    refreshRewards: vi.fn().mockResolvedValue(undefined),
    minStake: 5,
  }
}

let currentProps: HookArgs
let latest: ReturnType<typeof useChallengeModalState> | null = null
let originalWindow: typeof window | undefined
let originalCustomEvent: typeof CustomEvent | undefined

function renderHook(args: Partial<HookArgs> = {}): HarnessHandle {
  currentProps = { ...defaultArgs(), ...args }

  function Harness({ props }: { props: HookArgs }) {
    latest = useChallengeModalState(props)
    return null
  }

  const renderer = TestRenderer.create(React.createElement(Harness, { props: currentProps }))

  return {
    get result() {
      if (!latest) throw new Error('hook result not initialised')
      return latest
    },
    update(next: Partial<HookArgs>) {
      currentProps = { ...currentProps, ...next }
      renderer.update(React.createElement(Harness, { props: currentProps }))
    },
    unmount() {
      renderer.unmount()
    },
  }
}

beforeEach(() => {
  originalWindow = (globalThis as any).window
  originalCustomEvent = (globalThis as any).CustomEvent
  const customEventMock = class {
    detail: any
    type: string
    constructor(type: string, init?: { detail?: any }) {
      this.type = type
      this.detail = init?.detail
    }
  }
  ;(globalThis as any).CustomEvent = customEventMock as unknown as typeof CustomEvent
  ;(globalThis as any).window = {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    localStorage: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    sessionStorage: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  } as unknown as Window
})

afterEach(() => {
  latest = null
  if (originalWindow) {
    ;(globalThis as any).window = originalWindow
  } else {
    delete (globalThis as any).window
  }
  if (originalCustomEvent) {
    ;(globalThis as any).CustomEvent = originalCustomEvent
  } else {
    delete (globalThis as any).CustomEvent
  }
  originalWindow = undefined
  originalCustomEvent = undefined
})

describe('useChallengeModalState stake guards', () => {
  it('treats defenders with sufficient balance as stake-ready', () => {
    const harness = renderHook()
    const info = harness.result.getStakeInfo('0xDEF')
    expect(info.balance).toBe(12)
    expect(info.balanceKnown).toBe(true)
    expect(info.stakeReady).toBe(true)
    expect(info.minStake).toBe(5)
    harness.unmount()
  })

  it('blocks challenges when known balance is below min stake', () => {
    const harness = renderHook()
    const info = harness.result.getStakeInfo('0xLOW')
    expect(info.balance).toBe(3)
    expect(info.balanceKnown).toBe(true)
    expect(info.stakeReady).toBe(false)
    expect(info.minStake).toBe(5)
    harness.unmount()
  })

  it('remains neutral when defender balance is unknown', () => {
    const harness = renderHook()
    const info = harness.result.getStakeInfo('0xunknown')
    expect(info.balance).toBeNull()
    expect(info.balanceKnown).toBe(false)
    expect(info.stakeReady).toBe(true)
    harness.unmount()
  })

  it('treats addresses without metadata as unknown balance', () => {
    const harness = renderHook()
    const info = harness.result.getStakeInfo('0xNOPE')
    expect(info.balance).toBeNull()
    expect(info.balanceKnown).toBe(false)
    expect(info.stakeReady).toBe(true)
    harness.unmount()
  })
})
