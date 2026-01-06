import React from 'react'
import TestRenderer from 'react-test-renderer'
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'

import { LifeHubDesktopModal } from '@/components/life-hub/LifeHubDesktopModal'
import {
  EMPTY_TOP_UP_STATUS,
  LifeHubProvider,
  type LifeHubContextValue,
} from '@/components/life-hub/LifeHubProvider'
import {
  emptyEnergizeUi,
  type EnergizeHudStatus,
} from '@/components/bloblets-world/energizeState'
import type { LoadoutCard } from '@/components/bloblets-world/loadoutSelectors'

// Vitest + esbuild compile the client components with the classic JSX runtime,
// so we expose React on the global scope to satisfy createElement lookups.
(globalThis as typeof globalThis & { React?: typeof React }).React = React

const originalWindow = globalThis.window
const originalDocument = globalThis.document

beforeAll(() => {
  const noop = () => {}
  if (!originalWindow) {
    ;(globalThis as typeof globalThis & { window?: Window }).window = {
      addEventListener: noop,
      removeEventListener: noop,
      matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop }),
    } as Window
  } else {
    originalWindow.addEventListener ??= noop
    originalWindow.removeEventListener ??= noop
    originalWindow.matchMedia ??= () => ({ matches: false, addListener: noop, removeListener: noop })
  }

  if (!originalDocument) {
    ;(globalThis as typeof globalThis & { document?: Document }).document = {
      addEventListener: noop as any,
      removeEventListener: noop as any,
      body: {
        setAttribute: noop,
        removeAttribute: noop,
      },
    } as Document
  } else {
    originalDocument.addEventListener ??= noop as any
    originalDocument.removeEventListener ??= noop as any
    originalDocument.body ??= { setAttribute: noop, removeAttribute: noop } as any
    originalDocument.body.setAttribute ??= noop
    originalDocument.body.removeAttribute ??= noop
  }
})

afterAll(() => {
  if (originalWindow) {
    ;(globalThis as typeof globalThis & { window?: Window }).window = originalWindow
  } else {
    delete (globalThis as typeof globalThis & { window?: Window }).window
  }

  if (originalDocument) {
    ;(globalThis as typeof globalThis & { document?: Document }).document = originalDocument
  } else {
    delete (globalThis as typeof globalThis & { document?: Document }).document
  }
})

function makeContextValue(overrides: Partial<LifeHubContextValue> = {}): LifeHubContextValue {
  const baseHudStatus: EnergizeHudStatus = {
    title: 'Cycle Ready',
    highlight: 'READY',
    detail: 'Energize to refresh boosters, roll for loot, and earn upkeep.',
    tone: 'idle',
  }

  return {
    energize: emptyEnergizeUi(),
    energizing: false,
    energizeCost: 5,
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
    hudStatus: baseHudStatus,
    coverageCountdownLabel: 'READY',
    topUpStatus: { ...EMPTY_TOP_UP_STATUS },
    setTopUpStatus: undefined,
    refreshStatus: async () => {},
    statusRefreshing: false,
    ...overrides,
  }
}

const sampleLoadoutCard: LoadoutCard = {
  key: 'weapon',
  kind: 'weapon',
  icon: '⚔️',
  title: 'Blade of Testing',
  subtitle: 'Equipped',
  rarity: 'LEGENDARY',
  statLabel: 'OP Bonus',
  statValue: '+7',
  description: 'A powerful testing blade.',
  equipped: true,
}

describe('LifeHubDesktopModal', () => {
  it('renders the Life panel when active tab is life', () => {
    const tree = TestRenderer.create(
      <LifeHubProvider value={makeContextValue()}>
        <LifeHubDesktopModal
          activeTab="life"
          onClose={() => {}}
          loadout={{
            primaryCards: [sampleLoadoutCard],
            futureCards: [],
            onManageGear: () => {},
            onLaunchChallenge: () => {},
          }}
          rewardsCard={<div>Rewards card</div>}
          rewardsHistory={<div>History</div>}
          showRewardsHub
        />
      </LifeHubProvider>,
    )

    const text = collectText(tree.toJSON())
    expect(text.join(' ').toLowerCase()).toContain('life panel')
    tree.unmount()
  })

  it('wires loadout actions when the loadout tab is active', () => {
    const manageGear = vi.fn()
    const launchChallenge = vi.fn()

    const tree = TestRenderer.create(
      <LifeHubProvider value={makeContextValue()}>
        <LifeHubDesktopModal
          activeTab="loadout"
          onClose={() => {}}
          loadout={{
            primaryCards: [sampleLoadoutCard],
            futureCards: [],
            onManageGear: manageGear,
            onLaunchChallenge: launchChallenge,
          }}
          rewardsCard={<div>Rewards card</div>}
          rewardsHistory={<div>History</div>}
          showRewardsHub
        />
      </LifeHubProvider>,
    )

    const manageButtons = tree.root.findAll(
      (node: any) => node.type === 'button' && node.props.onClick === manageGear,
    )
    expect(manageButtons.length).toBeGreaterThan(0)
    const manageButton = manageButtons[0]
    const launchButton = tree.root.find(
      (node: any) => node.type === 'button' && node.props.onClick === launchChallenge,
    )

    manageButton.props.onClick()
    launchButton.props.onClick()

    expect(manageGear).toHaveBeenCalledTimes(1)
    expect(launchChallenge).toHaveBeenCalledTimes(1)
    tree.unmount()
  })

  it('renders the rewards hub only when enabled', () => {
    const enabledTree = TestRenderer.create(
      <LifeHubProvider value={makeContextValue()}>
        <LifeHubDesktopModal
          activeTab="rewards"
          onClose={() => {}}
          loadout={{
            primaryCards: [],
            futureCards: [],
            onManageGear: () => {},
            onLaunchChallenge: () => {},
          }}
          rewardsCard={<div>Rewards card</div>}
          rewardsHistory={<div>History</div>}
          showRewardsHub
        />
      </LifeHubProvider>,
    )
    expect(collectText(enabledTree.toJSON()).join(' ')).toContain('Battle Treasury')
    enabledTree.unmount()

    const disabledTree = TestRenderer.create(
      <LifeHubProvider value={makeContextValue()}>
        <LifeHubDesktopModal
          activeTab="rewards"
          onClose={() => {}}
          loadout={{
            primaryCards: [],
            futureCards: [],
            onManageGear: () => {},
            onLaunchChallenge: () => {},
          }}
          rewardsCard={<div>Rewards card</div>}
          rewardsHistory={<div>History</div>}
          showRewardsHub={false}
        />
      </LifeHubProvider>,
    )
    expect(disabledTree.toJSON()).toBeNull()
    disabledTree.unmount()
  })

  it('returns null when the tab is opponents or null', () => {
    const opponentsTree = TestRenderer.create(
      <LifeHubProvider value={makeContextValue()}>
        <LifeHubDesktopModal
          activeTab="opponents"
          onClose={() => {}}
          loadout={{
            primaryCards: [],
            futureCards: [],
            onManageGear: () => {},
            onLaunchChallenge: () => {},
          }}
          rewardsCard={<div>Rewards card</div>}
          rewardsHistory={<div>History</div>}
          showRewardsHub
        />
      </LifeHubProvider>,
    )

    const nullTree = TestRenderer.create(
      <LifeHubProvider value={makeContextValue()}>
        <LifeHubDesktopModal
          activeTab={null}
          onClose={() => {}}
          loadout={{
            primaryCards: [],
            futureCards: [],
            onManageGear: () => {},
            onLaunchChallenge: () => {},
          }}
          rewardsCard={<div>Rewards card</div>}
          rewardsHistory={<div>History</div>}
          showRewardsHub
        />
      </LifeHubProvider>,
    )

    expect(opponentsTree.toJSON()).toBeNull()
    expect(nullTree.toJSON()).toBeNull()
    opponentsTree.unmount()
    nullTree.unmount()
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
