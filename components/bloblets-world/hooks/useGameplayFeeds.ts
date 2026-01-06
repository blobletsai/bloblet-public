import { useEffect } from 'react'
import type { MutableRefObject, Dispatch, SetStateAction } from 'react'

import type { GameplayState } from '@/src/client/realtime/gameplay'
import type { PvpBattle, PvpItem } from '@/types'
import { normalizeBattle } from '../pvp'
import type { LootedAlertDetail } from '@/components/LootedAlertOverlay'

type LoadoutLookup = Record<string, { weapon: PvpItem | null; shield: PvpItem | null }>

type FetchBattlesOptions = {
  limit: number
  before?: string | null
}

type GameplayFeedsOptions = {
  gameplay: GameplayState
  battleFeedRef: MutableRefObject<PvpBattle[]>
  setBattleFeed: Dispatch<SetStateAction<PvpBattle[]>>
  loadoutRef: MutableRefObject<LoadoutLookup>
  setLoadoutState: Dispatch<SetStateAction<LoadoutLookup>>
  itemCatalogRef: MutableRefObject<Record<number, PvpItem>>
  fetchBattlesFromSupabase: (options: FetchBattlesOptions) => Promise<PvpBattle[]>
  fetchLoadoutsFromSupabase: () => Promise<any[]>
  applyLoadouts: (payload: any) => void
  viewerAddress?: string | null
  setLootedAlert: Dispatch<SetStateAction<LootedAlertDetail | null>>
}

export function buildLoadoutStateFromEvents(
  events: Map<string, { weaponItemId: number | null; shieldItemId: number | null }>,
  itemCatalog: Record<number, PvpItem>,
  viewer: string,
): LoadoutLookup {
  const next: LoadoutLookup = {}
  for (const [address, payload] of events.entries()) {
    const isOwner = viewer && address === viewer
    const weapon =
      isOwner && payload.weaponItemId != null ? itemCatalog[payload.weaponItemId] ?? null : null
    const shield =
      isOwner && payload.shieldItemId != null ? itemCatalog[payload.shieldItemId] ?? null : null
    next[address] = { weapon, shield }
  }
  return next
}

export function useGameplayFeeds({
  gameplay,
  battleFeedRef,
  setBattleFeed,
  loadoutRef,
  setLoadoutState,
  itemCatalogRef,
  fetchBattlesFromSupabase,
  fetchLoadoutsFromSupabase,
  applyLoadouts,
  viewerAddress,
  setLootedAlert,
}: GameplayFeedsOptions) {
  const viewer = (viewerAddress || '').trim()
  useEffect(() => {
    const shouldHydrateBattles =
      gameplay.lastEvent?.topic === 'battle' ||
      (!battleFeedRef.current.length && gameplay.battles.size > 0)
    if (!shouldHydrateBattles) return

    // Check for LOOTED event (if the new event is a battle I lost)
    if (gameplay.lastEvent?.topic === 'battle' && viewer) {
      const evt = gameplay.lastEvent.payload
      // If I am the defender AND I lost (winner is attacker) AND loot > 0
      if (
        evt &&
        evt.defender === viewer &&
        evt.winner === evt.attacker &&
        (evt.loot || 0) > 0
      ) {
        setLootedAlert({
          amount: evt.loot || 0,
          attackerName: evt.attacker || 'Unknown',
          timestamp: Date.now()
        })
      }
    }

    const entries = Array.from(gameplay.battles.values())
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
      .slice(0, 20)
      .map((payload) =>
        normalizeBattle({
          id: payload.id,
          attacker: payload.attacker,
          defender: payload.defender,
          attacker_booster: payload.attackerBooster,
          defender_booster: payload.defenderBooster,
          attacker_base: payload.attackerBase,
          defender_base: payload.defenderBase,
          attacker_total: payload.attackerTotal,
          defender_total: payload.defenderTotal,
          winner: payload.winner,
          transfer_points: payload.transferPoints,
          house_points: payload.housePoints,
          loot: payload.loot,
          critical: payload.critical,
          created_at: payload.createdAt,
        }),
      )
    const existing = battleFeedRef.current
    const sameLength = existing.length === entries.length
    const sameEntries =
      sameLength && existing.every((prev, index) => prev?.id === entries[index]?.id && prev?.created_at === entries[index]?.created_at)
    if (sameEntries) return
    battleFeedRef.current = entries
    setBattleFeed(entries)
  }, [gameplay.battles, gameplay.lastEvent, battleFeedRef, setBattleFeed, setLootedAlert, viewer])

  useEffect(() => {
    const shouldHydrateLoadouts =
      gameplay.lastEvent?.topic === 'loadout' ||
      (Object.keys(loadoutRef.current).length === 0 && gameplay.loadouts.size > 0)
    if (!shouldHydrateLoadouts) return
    const items = { ...itemCatalogRef.current }
    const next = buildLoadoutStateFromEvents(gameplay.loadouts, items, viewer)
    const prev = loadoutRef.current
    const sameKeys = Object.keys(prev).length === Object.keys(next).length
    const stable =
      sameKeys &&
      Object.keys(next).every((key) => {
        const prevEntry = prev[key]
        const nextEntry = next[key]
        if (!prevEntry || !nextEntry) return false
        const prevWeapon = prevEntry.weapon?.id ?? null
        const nextWeapon = nextEntry.weapon?.id ?? null
        const prevShield = prevEntry.shield?.id ?? null
        const nextShield = nextEntry.shield?.id ?? null
        return prevWeapon === nextWeapon && prevShield === nextShield
      })
    if (stable) return
    loadoutRef.current = next
    setLoadoutState({ ...next })
  }, [gameplay.lastEvent, gameplay.loadouts, itemCatalogRef, loadoutRef, setLoadoutState, viewer])

  useEffect(() => {
    const conn = gameplay.connection
    if (conn === 'open' || conn === 'connecting' || conn === 'idle') return
    let cancelled = false
    ;(async () => {
      const [battleSnapshot, loadoutRows] = await Promise.all([
        fetchBattlesFromSupabase({ limit: 20 }),
        fetchLoadoutsFromSupabase(),
      ])
      if (cancelled) return
      if (battleSnapshot.length) {
        battleFeedRef.current = battleSnapshot.slice(0, 20)
        setBattleFeed(battleSnapshot.slice(0, 20))
      }
      if (loadoutRows.length) {
        applyLoadouts({ loadouts: loadoutRows })
      }
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [
    applyLoadouts,
    battleFeedRef,
    fetchBattlesFromSupabase,
    fetchLoadoutsFromSupabase,
    gameplay.connection,
    setBattleFeed,
  ])

}
