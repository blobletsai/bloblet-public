"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

import type { GameplayState } from '@/src/client/realtime/gameplay'
import { supaAnon } from '@/src/server/supa'
import type { PvpBattle, PvpItem } from '@/types'
import { normalizeBattle, normalizePvpItem } from '../pvp'
import { useGameplayFeeds } from './useGameplayFeeds'
import { sanitizeLoadoutEntry } from '@/src/shared/pvp/loadoutVisibility'
import { logVisibilityDebug } from '@/src/shared/pvp/visibilityDebug'
import type { LootedAlertDetail } from '@/components/LootedAlertOverlay'
import type { Dispatch, SetStateAction } from 'react'
import { featuresConfig } from '@/src/config/features'

export type LoadoutLookup = Record<string, { weapon: PvpItem | null; shield: PvpItem | null }>

type FetchBattlesArgs = { limit?: number; before?: string | null }

type UseLoadoutAndBattleStateArgs = {
  gameplay: GameplayState
  viewerAddress?: string | null
  setLootedAlert: Dispatch<SetStateAction<LootedAlertDetail | null>>
}

type GearInventorySnapshot = {
  equipped?: {
    weapon?: any | null
    shield?: any | null
  }
  stash?: any[] | null
}

type LoadoutWithSource = {
  weapon: PvpItem | null
  shield: PvpItem | null
  weaponSource: 'equipped' | 'stash' | null
  shieldSource: 'equipped' | 'stash' | null
}

const gearIdForSlot = (item: any) => {
  const id = item?.baseItemId ?? item?.base_item_id ?? item?.id
  const numeric = Number(id)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

const GEAR_REFRESH_COOLDOWN_MS = 15000

const normalizeGearItemToPvp = (item: any, slot: 'weapon' | 'shield'): PvpItem | null => {
  const id = gearIdForSlot(item)
  if (!id) return null
  return normalizePvpItem({
    id,
    slug: item?.slug ?? item?.name ?? `item-${id}`,
    type: slot,
    name: item?.name ?? item?.slug ?? `Item ${id}`,
    rarity: item?.rarity ?? 'common',
    op: Number(item?.op ?? 0),
    dp: Number(item?.dp ?? 0),
    icon_url: item?.iconUrl ?? item?.icon_url ?? item?.generatedIconUrl ?? null,
  })
}

const selectDefaultLoadout = (gear: GearInventorySnapshot | null | undefined): LoadoutWithSource => {
  const stash = Array.isArray(gear?.stash) ? gear?.stash : []
  const pickBest = (slot: 'weapon' | 'shield') => {
    const equipped = gear?.equipped?.[slot] || null
    const equippedId = gearIdForSlot(equipped)
    if (equipped && equippedId) {
      return { item: equipped, source: 'equipped' as const }
    }
    const candidates = stash.filter((entry) => (entry?.type || slot) === slot && gearIdForSlot(entry))
    const best = candidates.reduce<{ item: any | null; score: number; id: number | null }>(
      (acc, entry) => {
        const stat = slot === 'weapon' ? Number(entry?.op ?? 0) : Number(entry?.dp ?? 0)
        const id = gearIdForSlot(entry)
        if (!id) return acc
        if (acc.item === null || stat > acc.score || (stat === acc.score && id > (acc.id ?? 0))) {
          return { item: entry, score: stat, id }
        }
        return acc
      },
      { item: null, score: -Infinity, id: null },
    )
    if (best.item) return { item: best.item, source: 'stash' as const }
    return { item: null, source: null }
  }

  const weaponPick = pickBest('weapon')
  const shieldPick = pickBest('shield')

  const weapon = normalizeGearItemToPvp(weaponPick.item, 'weapon')
  const shield = normalizeGearItemToPvp(shieldPick.item, 'shield')

  return {
    weapon,
    shield,
    weaponSource: weapon ? weaponPick.source : null,
    shieldSource: shield ? shieldPick.source : null,
  }
}

export function useLoadoutAndBattleState({ gameplay, viewerAddress, setLootedAlert }: UseLoadoutAndBattleStateArgs) {
  const [itemCatalog, setItemCatalog] = useState<Record<number, PvpItem>>({})
  const itemCatalogRef = useRef<Record<number, PvpItem>>({})
  const [loadoutState, setLoadoutState] = useState<LoadoutLookup>({})
  const loadoutRef = useRef<LoadoutLookup>({})
  const [battleFeed, setBattleFeed] = useState<PvpBattle[]>([])
  const battleFeedRef = useRef<PvpBattle[]>([])
  const viewerHydrationRef = useRef<Promise<void> | null>(null)
  const gearHydrationMetaRef = useRef<{ lastFetchAt: number; etag: string | null }>({
    lastFetchAt: 0,
    etag: null,
  })
  const viewer = (viewerAddress || '').trim()
  const viewerLoadout = viewer ? loadoutState[viewer] : null

  const applyLoadouts = useCallback(
    (payload: any) => {
      const entries = Array.isArray(payload?.loadouts)
        ? payload.loadouts
        : Array.isArray(payload)
          ? payload
          : []
      const rawItems = Array.isArray(payload?.items) ? payload.items : []

      const mergedItems: Record<number, PvpItem> = { ...itemCatalogRef.current }
      for (const it of rawItems) {
        const normal = normalizePvpItem(it)
        if (normal.id) mergedItems[normal.id] = normal
      }

      const nextLoadouts: LoadoutLookup = { ...loadoutRef.current }
      let loadoutMutated = false
      for (const entry of entries) {
        const sanitized = sanitizeLoadoutEntry(entry, viewer)
        if (!sanitized) continue
        const addr = sanitized.address
        const isOwner = viewer && addr === viewer
        const weaponId =
          sanitized.weapon_item_id != null ? Number(sanitized.weapon_item_id) : null
        const shieldId =
          sanitized.shield_item_id != null ? Number(sanitized.shield_item_id) : null
        const weapon =
          isOwner && sanitized.weapon
            ? normalizePvpItem(sanitized.weapon)
            : isOwner && weaponId && mergedItems[weaponId]
              ? mergedItems[weaponId]
              : null
        const shield =
          isOwner && sanitized.shield
            ? normalizePvpItem(sanitized.shield)
            : isOwner && shieldId && mergedItems[shieldId]
              ? mergedItems[shieldId]
              : null
        if (weapon && weapon.id) mergedItems[weapon.id] = weapon
        if (shield && shield.id) mergedItems[shield.id] = shield
        nextLoadouts[addr] = { weapon: weapon || null, shield: shield || null }
        loadoutMutated = true
      }

      itemCatalogRef.current = mergedItems
      setItemCatalog({ ...mergedItems })
      if (loadoutMutated) {
        loadoutRef.current = nextLoadouts
        setLoadoutState({ ...nextLoadouts })
      }
    },
    [viewer],
  )

  const updateLoadout = useCallback(
    (entry: any) => {
      if (!entry) return
      const sanitized = sanitizeLoadoutEntry(entry, viewer)
      if (!sanitized) return
      const addr = sanitized.address
      const currentItems: Record<number, PvpItem> = { ...itemCatalogRef.current }
      const currentLoadouts: LoadoutLookup = { ...loadoutRef.current }

      const weaponId =
        sanitized.weapon_item_id != null ? Number(sanitized.weapon_item_id) : null
      const shieldId =
        sanitized.shield_item_id != null ? Number(sanitized.shield_item_id) : null
      const weapon =
        viewer && addr === viewer && sanitized.weapon
          ? normalizePvpItem(sanitized.weapon)
          : viewer && addr === viewer && weaponId && currentItems[weaponId]
            ? currentItems[weaponId]
            : null
      const shield =
        viewer && addr === viewer && sanitized.shield
          ? normalizePvpItem(sanitized.shield)
          : viewer && addr === viewer && shieldId && currentItems[shieldId]
            ? currentItems[shieldId]
            : null
      if (weapon && weapon.id) currentItems[weapon.id] = weapon
      if (shield && shield.id) currentItems[shield.id] = shield

      currentLoadouts[addr] = { weapon: weapon || null, shield: shield || null }
      itemCatalogRef.current = currentItems
      loadoutRef.current = currentLoadouts
      setItemCatalog({ ...currentItems })
      setLoadoutState({ ...currentLoadouts })
    },
    [viewer],
  )

  const applyBattles = useCallback((rows: any) => {
    const arr = Array.isArray(rows) ? rows : []
    const normalized = arr.map((row) => normalizeBattle(row))
    battleFeedRef.current = normalized
    setBattleFeed([...normalized])
  }, [])

  const prependBattle = useCallback((row: any) => {
    const normalized = normalizeBattle(row)
    const existing = battleFeedRef.current.slice()
    const next = [normalized, ...existing]
    const dedup = new Map<number, PvpBattle>()
    for (const entry of next) {
      if (!dedup.has(entry.id)) dedup.set(entry.id, entry)
    }
    const finalList = Array.from(dedup.values()).slice(0, 20)
    battleFeedRef.current = finalList
    setBattleFeed([...finalList])
  }, [])

  const fetchBattlesFromSupabase = useCallback(async ({ limit = 20, before = null }: FetchBattlesArgs = {}) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return []
      const client = supaAnon()
      const query = client
        .from('pvp_battles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (before) {
        query.lt('created_at', before)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || []).map((row) => normalizeBattle(row))
    } catch (err) {
      if (featuresConfig.worldDebug) {
        console.warn('[BlobletsWorld] Failed to fetch battles snapshot', err)
      }
      return []
    }
  }, [])

  const fetchLoadoutsFromSupabase = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return []
      if (!viewer) return []
      const client = supaAnon()
      const { data, error } = await client
        .from('bloblet_loadout')
        .select('*')
        .eq('bloblet_address', viewer)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (err) {
      if (featuresConfig.worldDebug) {
        console.warn('[BlobletsWorld] Failed to fetch loadouts snapshot', err)
      }
      return []
    }
  }, [viewer])

  const refreshViewerLoadout = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!viewer) return loadoutRef.current[viewer] || null
      const existing = loadoutRef.current[viewer]
      const hasFullLoadout = !!(existing?.weapon && existing?.shield)
      if (hasFullLoadout) return existing
      const now = Date.now()
      if (viewerHydrationRef.current) {
        await viewerHydrationRef.current
        return loadoutRef.current[viewer] || null
      }
      const timeSinceLast = now - gearHydrationMetaRef.current.lastFetchAt
      if (!force && timeSinceLast < GEAR_REFRESH_COOLDOWN_MS) {
        return loadoutRef.current[viewer] || null
      }
      const hydratePromise = (async () => {
        try {
          const headers: Record<string, string> = {}
          if (gearHydrationMetaRef.current.etag) {
            headers['If-None-Match'] = gearHydrationMetaRef.current.etag
          }
          const res = await fetch('/api/gear/my', { credentials: 'same-origin', headers })
          const responseEtag = res.headers.get('etag')
          if (responseEtag) gearHydrationMetaRef.current.etag = responseEtag
          if (res.status === 304) {
            gearHydrationMetaRef.current.lastFetchAt = Date.now()
            return
          }
          const payload = await res.json().catch(() => null)
          if (!res.ok || !payload?.gear) {
            gearHydrationMetaRef.current.lastFetchAt = Date.now()
            return
          }
          gearHydrationMetaRef.current.etag = responseEtag || null
          gearHydrationMetaRef.current.lastFetchAt = Date.now()
          const { weapon, shield, weaponSource, shieldSource } = selectDefaultLoadout(payload.gear as GearInventorySnapshot)
          const items = []
          if (weapon) items.push(weapon)
          if (shield) items.push(shield)
          if (!weapon && !shield) return
          applyLoadouts({
            loadouts: [
              {
                address: viewer,
                bloblet_address: viewer,
                weapon_item_id: weapon?.id ?? null,
                shield_item_id: shield?.id ?? null,
                weapon,
                shield,
              },
            ],
            items,
          })
          logVisibilityDebug('gear/my', {
            viewer,
            weapon: weapon ? { id: weapon.id, slug: weapon.slug, op: weapon.op, dp: weapon.dp, source: weaponSource } : null,
            shield: shield ? { id: shield.id, slug: shield.slug, op: shield.op, dp: shield.dp, source: shieldSource } : null,
          })
        } catch (err) {
          gearHydrationMetaRef.current.lastFetchAt = Date.now()
          console.warn('[BlobletsWorld] Failed to hydrate viewer loadout', err)
        }
      })()
      viewerHydrationRef.current = hydratePromise
      try {
        await hydratePromise
      } finally {
        viewerHydrationRef.current = null
      }
      return loadoutRef.current[viewer] || null
    },
    [applyLoadouts, viewer],
  )

  useEffect(() => {
    if (!viewer) return
    const missingWeapon = !viewerLoadout?.weapon
    const missingShield = !viewerLoadout?.shield
    if (!missingWeapon && !missingShield) return
    refreshViewerLoadout().catch(() => {})
  }, [refreshViewerLoadout, viewer, viewerLoadout])

  useGameplayFeeds({
    gameplay,
    battleFeedRef,
    setBattleFeed,
    loadoutRef,
    setLoadoutState,
    itemCatalogRef,
    fetchBattlesFromSupabase,
    fetchLoadoutsFromSupabase,
    applyLoadouts,
    viewerAddress: viewer,
    setLootedAlert,
  })

  return {
    itemCatalog,
    loadoutState,
    battleFeed,
    applyLoadouts,
    updateLoadout,
    applyBattles,
    prependBattle,
    refreshViewerLoadout,
  }
}

export type UseLoadoutAndBattleStateResult = ReturnType<typeof useLoadoutAndBattleState>
