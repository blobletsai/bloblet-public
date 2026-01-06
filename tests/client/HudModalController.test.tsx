import React from 'react'
import { describe, expect, it } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'

import { useHudModalController } from '@/components/bloblets-world/hooks/useHudModalController'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

type Result = ReturnType<
  typeof useHudModalController<'life' | 'persona' | 'opponents', 'stats' | 'arena'>
>

type HarnessProps = {
  challengeModalOpen?: boolean
}

function renderHook(initialProps: HarnessProps = {}) {
  let lastState: Result | null = null

  function Harness(props: HarnessProps) {
    lastState = useHudModalController<'life' | 'persona' | 'opponents', 'stats' | 'arena'>({
      personaTab: 'persona',
      lifeHubTabs: ['life'],
      challengeModalOpen: props.challengeModalOpen ?? false,
      queryConfig: {
        param: 'modal',
        valueToTab: {
          life: 'life',
          persona: 'persona',
          'my-assets': 'persona',
        },
        tabToValue: {
          persona: 'my-assets',
        },
      },
    })
    return null
  }

  const renderer = TestRenderer.create(<Harness {...initialProps} />)

  return {
    get state() {
      if (!lastState) throw new Error('state not initialized')
      return lastState
    },
    rerender(nextProps: HarnessProps = initialProps) {
      act(() => {
        renderer.update(<Harness {...nextProps} />)
      })
    },
    unmount() {
      renderer.unmount()
    },
  }
}

describe('useHudModalController', () => {
  it('toggles hub and dock panels', () => {
    const hook = renderHook()

    act(() => {
      hook.state.toggleHubTab('life')
    })
    expect(hook.state.activeHubTab).toBe('life')

    act(() => {
      hook.state.toggleHubTab('life')
    })
    expect(hook.state.activeHubTab).toBeNull()

    act(() => {
      hook.state.toggleDockPanel('stats')
    })
    expect(hook.state.activeDockPanel).toBe('stats')

    act(() => {
      hook.state.toggleDockPanel('stats')
    })
    expect(hook.state.activeDockPanel).toBeNull()

    hook.unmount()
  })

  it('hydrates hub tabs from query params', () => {
    const hook = renderHook()

    act(() => {
      hook.state.hydrateFromQuery('?modal=my-assets')
    })
    expect(hook.state.activeHubTab).toBe('persona')

    act(() => {
      hook.state.hydrateFromQuery('?modal=life')
    })
    expect(hook.state.activeHubTab).toBe('life')

    hook.unmount()
  })
})
