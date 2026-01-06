import React, { useRef } from 'react'
import { act } from 'react-test-renderer'
import TestRenderer from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import { useGameplayFeeds } from '@/components/bloblets-world/hooks/useGameplayFeeds'
import type { GameplayEvent, GameplayState } from '@/src/client/realtime/gameplay'
import type { PvpBattle, PvpItem } from '@/types'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

type LoadoutLookup = Record<string, { weapon: PvpItem | null; shield: PvpItem | null }>

function createGameplayState(partial: Partial<GameplayState>): GameplayState {
  return {
    connection: 'open',
    orders: new Map(),
    ordersByAddress: new Map(),
    careByAddress: new Map(),
    rewardsByAddress: new Map(),
    battles: new Map(),
    loadouts: new Map(),
    lastEvent: null,
    ...partial,
  }
}

const baseBattlePayload = {
  id: 1,
  attacker: '0xattacker',
  defender: '0xdefender',
  attackerBooster: 1,
  defenderBooster: 2,
  attackerBase: 10,
  defenderBase: 12,
  attackerTotal: 15,
  defenderTotal: 14,
  winner: 'attacker',
  transferPoints: 5,
  housePoints: 1,
  loot: [],
  critical: false,
  createdAt: new Date().toISOString(),
}

const baseLoadoutPayload = {
  address: '0xdefender',
  weaponItemId: 1,
  shieldItemId: 2,
  updatedAt: new Date().toISOString(),
}

describe('useGameplayFeeds', () => {
  it('hydrates battle feed and loadouts from realtime state', async () => {
    const setBattleFeed = vi.fn()
    const setLoadoutState = vi.fn()
    const applyLoadouts = vi.fn()
    const setLootedAlert = vi.fn()

    const gameplay = createGameplayState({
      battles: new Map([[baseBattlePayload.id, baseBattlePayload]]),
      loadouts: new Map([[baseLoadoutPayload.address, baseLoadoutPayload]]),
      lastEvent: {
        topic: 'battle',
        eventType: 'INSERT',
        payload: baseBattlePayload,
      } as GameplayEvent,
    })

    const fetchBattles = vi.fn().mockResolvedValue([] as PvpBattle[])
    const fetchLoadouts = vi.fn().mockResolvedValue([] as any[])

    function Harness({ state }: { state: GameplayState }) {
      const battleFeedRef = useRef<PvpBattle[]>([])
      const loadoutRef = useRef<LoadoutLookup>({})
      const itemCatalogRef = useRef<Record<number, PvpItem>>({
        1: { id: 1, slug: 'sword', type: 'weapon', name: 'Sword', rarity: 'common', op: 10, dp: 0 },
        2: { id: 2, slug: 'shield', type: 'shield', name: 'Shield', rarity: 'common', op: 0, dp: 5 },
      })
      useGameplayFeeds({
        gameplay: state,
        battleFeedRef,
        setBattleFeed,
        loadoutRef,
        setLoadoutState,
        itemCatalogRef,
        fetchBattlesFromSupabase: fetchBattles,
        fetchLoadoutsFromSupabase: fetchLoadouts,
        applyLoadouts,
        setLootedAlert,
      })
      return null
    }

    await act(async () => {
      TestRenderer.create(<Harness state={gameplay} />)
    })

    expect(setBattleFeed).toHaveBeenCalledTimes(1)
    expect(setLoadoutState).toHaveBeenCalledTimes(1)
    expect(fetchBattles).not.toHaveBeenCalled()
    expect(fetchLoadouts).not.toHaveBeenCalled()
    expect(applyLoadouts).not.toHaveBeenCalled()

    const firstCall = setBattleFeed.mock.calls[0] as [PvpBattle[]]
    expect(firstCall).toBeTruthy()
    const [battleFeedArg] = firstCall
    expect(Array.isArray(battleFeedArg)).toBe(true)
    expect(battleFeedArg[0]?.id).toBe(baseBattlePayload.id)
  })

  it('triggers looted alert when defender loses and loot is taken', async () => {
    const setBattleFeed = vi.fn()
    const setLoadoutState = vi.fn()
    const applyLoadouts = vi.fn()
    const setLootedAlert = vi.fn()

    const lootedPayload = {
      ...baseBattlePayload,
      id: 99,
      attacker: '0xattacker',
      defender: '0xme',
      winner: '0xattacker',
      loot: 100,
    }

    const gameplay = createGameplayState({
      battles: new Map([[lootedPayload.id, lootedPayload]]),
      lastEvent: {
        topic: 'battle',
        eventType: 'INSERT',
        payload: lootedPayload,
      } as GameplayEvent,
    })

    const fetchBattles = vi.fn().mockResolvedValue([])
    const fetchLoadouts = vi.fn().mockResolvedValue([])

    function Harness({ state }: { state: GameplayState }) {
      const battleFeedRef = useRef<PvpBattle[]>([])
      const loadoutRef = useRef<LoadoutLookup>({})
      const itemCatalogRef = useRef<Record<number, PvpItem>>({})
      useGameplayFeeds({
        gameplay: state,
        battleFeedRef,
        setBattleFeed,
        loadoutRef,
        setLoadoutState,
        itemCatalogRef,
        fetchBattlesFromSupabase: fetchBattles,
        fetchLoadoutsFromSupabase: fetchLoadouts,
        applyLoadouts,
        setLootedAlert,
        viewerAddress: '0xme',
      })
      return null
    }

    await act(async () => {
      TestRenderer.create(<Harness state={gameplay} />)
    })

    expect(setLootedAlert).toHaveBeenCalledTimes(1)
    const [alert] = setLootedAlert.mock.calls[0] as any[]
    expect(alert.amount).toBe(100)
    expect(alert.attackerName).toBe('0xattacker')
  })
})
