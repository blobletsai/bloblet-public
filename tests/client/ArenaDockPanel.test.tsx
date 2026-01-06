import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TestRenderer from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import { ArenaDockPanel } from '@/components/hud/ArenaDockPanel'
import { ArenaFeedPanel } from '@/components/hud/ArenaFeedPanel'
import type { PvpBattle, PvpItem } from '@/types'

(globalThis as typeof globalThis & { React?: typeof React }).React = React

const sampleBattle: PvpBattle = {
  id: 1,
  attacker: '0xaaaa',
  defender: '0xbbbb',
  attacker_booster: 1,
  defender_booster: 0,
  attacker_base: 10,
  defender_base: 8,
  attacker_total: 18,
  defender_total: 12,
  winner: 'attacker',
  transfer_points: 5,
  house_points: 1,
  loot: [],
  critical: false,
  created_at: new Date().toISOString(),
}

const itemCatalog: Record<number, PvpItem> = {}

describe('Arena panels', () => {
  it('renders dock panel and fires launch callback', () => {
    const launch = vi.fn()
    const tree = TestRenderer.create(
      <ArenaDockPanel onLaunch={launch} battles={<div>Battle list</div>} />,
    )
    const button = tree.root.findByType('button')
    button.props.onClick()
    expect(launch).toHaveBeenCalledTimes(1)
    expect(renderToStaticMarkup(<ArenaDockPanel onLaunch={() => {}} battles={<div>Battle list</div>} />)).toContain('Battle list')
  })

  it('renders the feed list with challenge prompts', () => {
    const challenge = vi.fn()
    const markup = renderToStaticMarkup(
      <ArenaFeedPanel
        battles={[sampleBattle]}
        myAddress="0xaaaa"
        itemCatalog={itemCatalog}
        onChallenge={challenge}
      />,
    )

    expect(markup).toContain('vs')
  })

  it('renders empty state when no battles exist', () => {
    const markup = renderToStaticMarkup(
      <ArenaFeedPanel
        battles={[]}
        myAddress=""
        itemCatalog={itemCatalog}
        onChallenge={() => {}}
      />,
    )
    expect(markup).toContain('No battles yet')
  })
})
