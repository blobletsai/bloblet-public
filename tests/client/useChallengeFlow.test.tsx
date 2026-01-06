import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useChallengeFlow } from '@/components/challenge-modal/useChallengeFlow'
import type { ChallengeHandlerResult, ChallengeResult } from '@/components/ChallengeModal'
import type { PvpItem } from '@/types'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

const noopLoadout: { weapon: PvpItem | null; shield: PvpItem | null } = {
  weapon: null,
  shield: null,
}

const MY_ADDR = 'DMGPDaz9V9UMcStxpMWAeDDX71uPxipmW2krp4U1ofBa'
const OPPONENT_ADDR = '5ercAfJdewdJGXrvytKBSeH9mPG84FaymZmkpS5edGj4'
const START_ADDR = 'FKcMeA2PtN71g5CheSDmpgSPvGsxx6EDyijT56AQnT8q'

type HookArgs = Parameters<typeof useChallengeFlow>[0]

type HarnessHandle = {
  result: ReturnType<typeof useChallengeFlow>
  update: (next: Partial<HookArgs>) => void
  unmount: () => void
}

let latest: ReturnType<typeof useChallengeFlow> | null = null
let currentProps: HookArgs
let originalDocument: Document | undefined
let originalClipboard: typeof navigator.clipboard | undefined


function defaultArgs(): HookArgs {
  return {
    open: true,
    myAddress: MY_ADDR,
    loadouts: {
      [MY_ADDR]: noopLoadout,
      [OPPONENT_ADDR]: noopLoadout,
    },
    suggestedTargets: [OPPONENT_ADDR, MY_ADDR, OPPONENT_ADDR],
    initialTarget: null,
    onSubmit: async (): Promise<ChallengeHandlerResult> => ({ ok: true, result: createResult() }),
    resolveAvatarUrl: (address) => (address ? `${address}-avatar` : null),
  }
}

function createResult(): ChallengeResult {
  return {
    winner: 'attacker',
    critical: false,
    attacker: {
      address: MY_ADDR,
      booster: 0,
      base: 5000,
      roll: 6000,
      pointsBefore: 1000,
      pointsAfter: 2000,
      weapon: null,
      shield: null,
    },
    opponent: {
      address: OPPONENT_ADDR,
      maskedId: 'Opp...end',
      displayHint: 'Shrouded challenger',
    },
    transfer: { transfer: 1000, house: 100, winnerGain: 900 },
    loot: [],
    cooldownEndsAt: null,
    executedAt: new Date().toISOString(),
  }
}

function renderHook(args: Partial<HookArgs> = {}): HarnessHandle {
  const initialArgs = { ...defaultArgs(), ...args }

  function Harness({ props }: { props: HookArgs }) {
    latest = useChallengeFlow(props)
    return null
  }

  currentProps = initialArgs
  const renderer = TestRenderer.create(React.createElement(Harness, { props: currentProps }))

  return {
    get result() {
      if (!latest) throw new Error('hook result not initialised')
      return latest
    },
    update(next: Partial<HookArgs>) {
      currentProps = { ...currentProps, ...next }
      act(() => {
        renderer.update(React.createElement(Harness, { props: currentProps }))
      })
    },
    unmount() {
      renderer.unmount()
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  const writeText = vi.fn().mockResolvedValue(undefined)
  originalClipboard = navigator.clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText,
    },
  })
  originalDocument = (globalThis as any).document
  const textarea = {
    value: '',
    style: {} as Record<string, string>,
    select: vi.fn(),
  }
  ;(globalThis as any).document = {
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    createElement: vi.fn(() => ({ ...textarea })),
    execCommand: vi.fn().mockReturnValue(true),
  } as unknown as Document
  ;(globalThis as any).window = globalThis
})

afterEach(() => {
  vi.useRealTimers()
  if (originalClipboard) {
    Object.assign(navigator, { clipboard: originalClipboard })
    originalClipboard = undefined
  }
  if (originalDocument) {
    ;(globalThis as any).document = originalDocument
    originalDocument = undefined
  }
})

describe('useChallengeFlow', () => {
  it('normalises suggestions and resolves avatars', async () => {
    const harness = renderHook()

    await act(async () => {})

    expect(harness.result.uniqueSuggestions).toEqual([OPPONENT_ADDR])
    expect(harness.result.myAvatarUrl).toBe(`${MY_ADDR}-avatar`)

    harness.unmount()
  })

  it('transitions to result stage after a successful submit', async () => {
    const onSubmit = vi.fn(async (): Promise<ChallengeHandlerResult> => ({ ok: true, result: createResult() }))
    const harness = renderHook({ onSubmit, initialTarget: OPPONENT_ADDR })

    await act(async () => {})

    expect(harness.result.normalizedTarget).toBe(OPPONENT_ADDR)

    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => {
      await harness.result.handleSubmit(event)
    })

    expect(onSubmit).toHaveBeenCalledWith(OPPONENT_ADDR)
    expect(harness.result.formError).toBeNull()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(harness.result.stage).toBe('result')

    harness.unmount()
  })

  it('surfaces errors and returns to form stage', async () => {
    const onSubmit = vi.fn(async (): Promise<ChallengeHandlerResult> => ({ ok: false, error: 'cooldown', message: 'Cooldown' }))
    const harness = renderHook({ onSubmit, initialTarget: OPPONENT_ADDR })

    await act(async () => {})

    expect(harness.result.normalizedTarget).toBe(OPPONENT_ADDR)

    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => {
      await harness.result.handleSubmit(event)
    })

    expect(harness.result.stage).toBe('form')
    expect(harness.result.formError).toBe('Cooldown')

    harness.unmount()
  })

  it('resets state when modal closes and reopens', async () => {
    const harness = renderHook({ initialTarget: START_ADDR })

    await act(async () => {})

    expect(harness.result.addressInput).toBe(START_ADDR)

    await act(async () => {
      harness.update({ open: false })
    })
    await act(async () => {
      harness.update({ open: true })
    })

    expect(harness.result.stage).toBe('form')
    expect(harness.result.addressInput).toBe(START_ADDR)

    harness.unmount()
  })

  it('writes to clipboard with fallback when navigator clipboard fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('no clipboard'))
    const execCommand = vi.fn()
    Object.assign(document, {
      execCommand,
    })
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    const harness = renderHook()

    await act(async () => {
      await harness.result.handleCopyToClipboard(MY_ADDR)
    })

    expect(writeText).toHaveBeenCalledWith(MY_ADDR)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(harness.result.copyMessage).toBe('Address copied')

    harness.unmount()
  })

  it('emits battle errors for energize/balance blockers', async () => {
    const onBattleError = vi.fn()
    const onSubmit = vi.fn(async (): Promise<ChallengeHandlerResult> => ({
      ok: false,
      error: 'attacker_overdue',
      message: 'Energize before launching',
    }))
    const harness = renderHook({ onSubmit, initialTarget: OPPONENT_ADDR, onBattleError })

    await act(async () => {})

    await act(async () => {
      await harness.result.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(onBattleError).toHaveBeenCalledWith({
      code: 'attacker_overdue',
      message: 'Energize before launching',
      target: OPPONENT_ADDR,
      kind: 'energize',
    })
    expect(harness.result.formError).toBeNull()

    const balanceSubmit = vi.fn(async (): Promise<ChallengeHandlerResult> => ({
      ok: false,
      error: 'attacker_balance_low',
      message: 'Need more points',
    }))
    harness.update({ onSubmit: balanceSubmit })

    await act(async () => {
      await harness.result.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent)
    })

    expect(onBattleError).toHaveBeenLastCalledWith({
      code: 'attacker_balance_low',
      message: 'Need more points',
      target: OPPONENT_ADDR,
      kind: 'balance',
    })
    expect(harness.result.formError).toBeNull()

    harness.unmount()
  })
})
