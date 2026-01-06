// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

import {
  BattleFlowProvider,
  type BattleFlowBindings,
  useBattleFlow,
} from '@/components/challenge-modal/BattleFlowProvider'

vi.mock('@/components/challenge-modal/BattleAlertProvider', () => ({
  BattleAlertProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let lastChallengeModalProps: Record<string, any> | null = null

vi.mock('@/components/ChallengeModal', () => ({
  default: (props: Record<string, any>) => {
    lastChallengeModalProps = props
    return <div data-testid="challenge-modal" />
  },
}))

function createBindings(overrides: Partial<BattleFlowBindings> = {}): BattleFlowBindings {
  return {
    challengeModalOpen: true,
    challengePresetTarget: null,
    recentOpponents: ['target-1'],
    openChallengeModal: vi.fn(),
    closeChallengeModal: vi.fn(),
    handleChallengeSubmit: vi.fn(),
    resolveChallengeAvatar: vi.fn(),
    minStake: 100,
    getStakeInfo: vi.fn(() => ({ balance: 10, stakeReady: true, minStake: 10 })),
    getPairCooldown: vi.fn(() => null),
    challengeWindowHandlers: {},
    arenaPanel: <div data-testid="arena-panel" />,
    ...overrides,
  }
}

let lastContext: ReturnType<typeof useBattleFlow> | null = null

function ContextProbe() {
  lastContext = useBattleFlow()
  return <div data-testid="context-probe" />
}

describe('BattleFlowProvider', () => {
  it('exposes battle flow context values', () => {
    const bindings = createBindings()
    render(
      <BattleFlowProvider
        bindings={bindings}
        myAddress="0xabc"
        loadouts={{}}
        itemCatalog={{}}
        onRequestLifeHub={() => {}}
      >
        <ContextProbe />
      </BattleFlowProvider>,
    )
    expect(lastContext?.challengeModalOpen).toBe(true)
    expect(lastContext?.openChallengeModal).toBe(bindings.openChallengeModal)
    expect(lastContext?.arenaPanel).toBe(bindings.arenaPanel)
  })

  it('delays Life Hub launch until the modal closes', () => {
    const onRequestLifeHub = vi.fn()
    const initialBindings = createBindings({ challengeModalOpen: true })
    const { rerender } = render(
      <BattleFlowProvider
        bindings={initialBindings}
        myAddress="0xabc"
        loadouts={{}}
        itemCatalog={{}}
        onRequestLifeHub={onRequestLifeHub}
      >
        <ContextProbe />
      </BattleFlowProvider>,
    )

    act(() => {
      lastChallengeModalProps?.onEnergizeNow?.()
    })

    expect(onRequestLifeHub).not.toHaveBeenCalled()

    const nextBindings = createBindings({ challengeModalOpen: false })
    rerender(
      <BattleFlowProvider
        bindings={nextBindings}
        myAddress="0xabc"
        loadouts={{}}
        itemCatalog={{}}
        onRequestLifeHub={onRequestLifeHub}
      >
        <ContextProbe />
      </BattleFlowProvider>,
    )

    expect(onRequestLifeHub).toHaveBeenCalledTimes(1)
  })
})
