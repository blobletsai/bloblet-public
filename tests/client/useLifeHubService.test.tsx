import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'

import type { LifeHubServiceResult } from '@/components/life-hub/useLifeHubService'
import { useLifeHubService } from '@/components/life-hub/useLifeHubService'
// Import the mocked function via the module to assert on it
import { useEnergizeTelemetry } from '@/components/bloblets-world/hooks/useEnergizeTelemetry'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

// Define mocks that don't need to be hoisted first
const handleEnergizeMock = vi.fn()
const openTopUpModalMock = vi.fn()
const closeTopUpModalMock = vi.fn()
const setTopUpStatusMock = vi.fn()
const refreshStatusMock = vi.fn(() => Promise.resolve())
const refreshRewardsMock = vi.fn(() => Promise.resolve(null))
const setEnergizeUiMock = vi.fn()
const setEnergizeAlertMock = vi.fn()
const pendingEnergizeActionRefMock = { current: null }
const toastsStub = [{ id: 't', icon: '⚡', message: 'toast' }]

const rewardsSnapshotMock = {
  balance: 5,
  ledger: [],
  swaps: [],
  fetchedAt: 123,
} as any

const mockContextValue = {
  energize: { state: 'ready', boosterLevel: 0, boostersActiveUntil: null, cooldownEndsAt: null, overdue: false, lastEnergizeAt: null, energizeCost: 12, consumedOrder: null, dropAcc: 0 },
  energizing: false,
  energizeCost: 12,
  rewardBalance: 10,
  needsTopUp: false,
  onEnergize: handleEnergizeMock,
  onTopUp: openTopUpModalMock,
  disabledReason: null,
  helperLabel: 'helper',
  errorMessage: null,
  walletConnected: true,
  isHolder: true,
  minTokens: null,
  hudStatus: { state: 'ready', highlight: null },
  coverageCountdownLabel: 'soon',
  topUpStatus: {
    active: false,
    open: false,
    phase: null,
    status: null,
    notice: null,
    orderId: null,
    autoStatus: 'idle',
    errorMessage: null,
  },
  setTopUpStatus: setTopUpStatusMock,
  refreshStatus: refreshStatusMock,
  statusRefreshing: false,
} as any

const rewardsWindowHandlersMock = {
  BlobletsWorld_openTopUpRewards: vi.fn(),
  BlobletsWorld_closeRewards: vi.fn(),
}

// Mock the modules
vi.mock('@/components/bloblets-world/hooks/useEnergizeTelemetry', () => ({
  useEnergizeTelemetry: vi.fn(() => ({
    energizeUi: { state: 'ready', boosterLevel: 0, boostersActiveUntil: null, cooldownEndsAt: null, overdue: false, lastEnergizeAt: null, energizeCost: 10, consumedOrder: null, dropAcc: 0 },
    setEnergizeUi: setEnergizeUiMock,
    energizeAlert: null,
    setEnergizeAlert: setEnergizeAlertMock,
    pendingEnergizeActionRef: pendingEnergizeActionRefMock,
    toasts: toastsStub,
    refreshStatus: refreshStatusMock,
    statusRefreshing: false,
  })),
}))

vi.mock('@/components/hooks/useRewardsSnapshot', () => ({
  useRewardsSnapshot: vi.fn(() => ({
    snapshot: rewardsSnapshotMock,
    loading: false,
    error: null,
    refresh: refreshRewardsMock,
    lastUpdated: rewardsSnapshotMock.fetchedAt,
  })),
}))

vi.mock('@/components/bloblets-world/modalState', () => ({
  useRewardsModalState: vi.fn(() => ({
    topUpModalOpen: false,
    openTopUpModal: openTopUpModalMock,
    closeTopUpModal: closeTopUpModalMock,
    topUpStatus: mockContextValue.topUpStatus,
    setTopUpStatus: setTopUpStatusMock,
    rewardsWindowHandlers: rewardsWindowHandlersMock,
  })),
}))

vi.mock('@/components/life-hub/useEnergizePanel', () => ({
  useEnergizePanel: vi.fn(() => ({
    coverageCountdownLabel: '5m',
    hudStatus: mockContextValue.hudStatus,
    disabledReason: null,
    helperLabel: 'helper',
  })),
}))

vi.mock('@/components/bloblets-world/useEnergizeHandler', () => ({
  useEnergizeHandler: vi.fn(() => handleEnergizeMock),
}))

vi.mock('@/components/bloblets-world/useLifeHubContextValue', () => ({
  useLifeHubContextValue: vi.fn(() => mockContextValue),
}))

type HookProps = {
  walletAddress?: string | null
  walletAddressCanonical?: string | null
  gameplay?: { connection: 'open' | 'idle'; rewardsByAddress: Map<string, any> }
}

function renderHook(overrides: HookProps = {}) {
  let lastValue: LifeHubServiceResult | null = null
  const props: Required<HookProps> = {
    walletAddress: overrides.walletAddress ?? 'ADDR',
    walletAddressCanonical: overrides.walletAddressCanonical ?? 'ADDR',
    gameplay:
      overrides.gameplay ??
      ({
        connection: 'open',
        rewardsByAddress: new Map<string, any>(),
      } as HookProps['gameplay']),
  }
  const stRef = { current: {} }

  function Harness(currentProps: HookProps) {
    lastValue = useLifeHubService({
      stRef,
      walletAddress: currentProps.walletAddress ?? null,
      walletAddressCanonical: currentProps.walletAddressCanonical ?? null,
      gameplay: currentProps.gameplay!,
      rewardsConfig: { tokenSymbol: 'BLOB', minTokens: 10 } as any,
      formatTimeLabel: (iso) => iso ?? '',
    })
    return null
  }

  const renderer = TestRenderer.create(<Harness {...props} />)

  return {
    get result() {
      if (!lastValue) throw new Error('lifeHubService not initialized')
      return lastValue
    },
    rerender(next: HookProps = {}) {
      Object.assign(props, next)
      act(() => {
        renderer.update(<Harness {...props} />)
      })
    },
    unmount() {
      renderer.unmount()
    },
  }
}

describe('useLifeHubService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rewardsSnapshotMock.balance = 5
    rewardsSnapshotMock.fetchedAt = 123
    if (!('window' in globalThis) || typeof window === 'undefined') {
      vi.stubGlobal('window', new EventTarget() as any)
    }
  })

  it('returns life hub context value and reward data', async () => {
    const gameplay = {
      connection: 'open' as const,
      rewardsByAddress: new Map<string, any>([
        ['ADDR', { balanceAfter: 42 }],
      ]),
    }
    const hook = renderHook({ gameplay })

    expect(useEnergizeTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldPollFallback: false,
      }),
    )
    expect(hook.result.lifeHubValue).toMatchObject({
      ...mockContextValue,
    })
    expect(hook.result.rewardBalance).toBe(42)
    expect(hook.result.rewardsSnapshot).toBe(rewardsSnapshotMock)
    expect(hook.result.openTopUpModal).toBe(openTopUpModalMock)
    expect(hook.result.closeTopUpModal).toBe(closeTopUpModalMock)
    expect(hook.result.toasts).toEqual(toastsStub)
    expect(hook.result.rewardsWindowHandlers).toBe(rewardsWindowHandlersMock)
    expect(hook.result.telemetry.setEnergizeUi).toBe(setEnergizeUiMock)
    expect(hook.result.telemetry.setEnergizeAlert).toBe(setEnergizeAlertMock)
    expect(hook.result.telemetry.pendingEnergizeActionRef).toBe(pendingEnergizeActionRefMock)
  })

  it('falls back to snapshot balance and refreshes when wallet changes', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    rewardsSnapshotMock.balance = 7
    const hook = renderHook({ walletAddress: 'ADDR', walletAddressCanonical: 'ADDR' })
    expect(hook.result.rewardBalance).toBe(7)

    hook.rerender({ walletAddress: 'NEW', walletAddressCanonical: 'NEW' })

    expect(refreshRewardsMock).toHaveBeenCalledWith({ silent: true })
    expect(setEnergizeUiMock).toHaveBeenCalled()
    expect(setEnergizeAlertMock).toHaveBeenCalledWith(null)

    dispatchSpy.mockRestore()
    hook.unmount()
  })
})
