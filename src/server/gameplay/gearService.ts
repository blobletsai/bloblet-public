import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'

import { normalizeChainAddress } from '@/src/server/address'
import { withPgClient } from '@/src/server/pg'
import type { PvpItem } from '@/types'

import type { CareDropResult } from './careDrops'

export type GearItem = {
  id: string
  baseItemId: number | null
  slug: string | null
  type: 'weapon' | 'shield'
  name: string | null
  rarity: string | null
  op: number | null
  dp: number | null
  iconUrl: string | null
  generatedIconUrl: string | null
  createdAt: string
  equippedSlot?: 'weapon' | 'shield'
  masked?: boolean
  metadata?: Record<string, any> | null
}

export type GearInventory = {
  equipped: {
    weapon: GearItem | null
    shield: GearItem | null
  }
  stash: GearItem[]
  stashCount: number
}

type GearFetchOptions = {
  mask?: boolean
}

type GetOptions = GearFetchOptions & {
  client?: PoolClient
}

type DropSource = 'care_drop' | 'battle_loot'

type GearEntryInput = {
  addressCanonical: string
  slot: 'weapon' | 'shield'
  baseItemId: number | null
  slug: string | null
  name: string | null
  rarity: string | null
  op: number | null
  dp: number | null
  iconUrl: string | null
  generatedIconUrl: string | null
  now: Date
  metadata: Record<string, any> | null
}

function normalizeEquipped(row: any, slot: 'weapon' | 'shield'): GearItem | null {
  const id =
    slot === 'weapon' ? row.weapon_item_id : row.shield_item_id
  if (!id) return null
  return {
    id: String(id),
    baseItemId: Number(id),
    slug: slot === 'weapon' ? row.weapon_slug : row.shield_slug,
    type: slot,
    name: slot === 'weapon' ? row.weapon_name : row.shield_name,
    rarity: slot === 'weapon' ? row.weapon_rarity : row.shield_rarity,
    op:
      slot === 'weapon'
        ? row.weapon_op != null
          ? Number(row.weapon_op)
          : 0
        : row.shield_op != null
          ? Number(row.shield_op)
          : 0,
    dp:
      slot === 'shield'
        ? row.shield_dp != null
          ? Number(row.shield_dp)
          : 0
        : row.weapon_dp != null
          ? Number(row.weapon_dp)
          : 0,
    iconUrl: slot === 'weapon' ? row.weapon_icon_url : row.shield_icon_url,
    generatedIconUrl: null,
    createdAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    equippedSlot: slot,
  }
}

function normalizeStash(rawItems: any[] | null): GearItem[] {
  if (!Array.isArray(rawItems)) return []
  return rawItems.map((entry) => ({
    id: String(entry?.id || randomUUID()),
    baseItemId: entry?.baseItemId ?? entry?.base_item_id ?? null,
    slug: entry?.slug ?? null,
    type: entry?.type === 'shield' ? 'shield' : 'weapon',
    name: entry?.name ?? null,
    rarity: entry?.rarity ?? null,
    op: entry?.op != null ? Number(entry.op) : null,
    dp: entry?.dp != null ? Number(entry.dp) : null,
    iconUrl: entry?.iconUrl ?? entry?.icon_url ?? null,
    generatedIconUrl: entry?.generatedIconUrl ?? entry?.generated_icon_url ?? null,
    createdAt: entry?.createdAt ? String(entry.createdAt) : new Date().toISOString(),
    metadata: entry?.metadata ?? null,
  }))
}

function maskItem(item: GearItem | null): GearItem | null {
  if (!item) return null
  return {
    ...item,
    slug: null,
    name: null,
    op: null,
    dp: null,
    iconUrl: null,
    generatedIconUrl: null,
    masked: true,
  }
}

async function fetchGear(
  client: PoolClient,
  addressCanonical: string,
  options: GearFetchOptions = {},
): Promise<GearInventory> {
  const loadoutRes = await client.query(
    `select bl.bloblet_address,
            bl.weapon_item_id,
            bl.shield_item_id,
            bl.updated_at,
            weapon.slug as weapon_slug,
            weapon.name as weapon_name,
            weapon.rarity as weapon_rarity,
            weapon.op as weapon_op,
            weapon.dp as weapon_dp,
            weapon.icon_url as weapon_icon_url,
            shield.slug as shield_slug,
            shield.name as shield_name,
            shield.rarity as shield_rarity,
            shield.op as shield_op,
            shield.dp as shield_dp,
            shield.icon_url as shield_icon_url
       from public.bloblet_loadout bl
  left join public.pvp_items weapon on weapon.id = bl.weapon_item_id
  left join public.pvp_items shield on shield.id = bl.shield_item_id
      where bl.bloblet_address = $1`,
    [addressCanonical],
  )

  const loadoutRow = loadoutRes.rows[0] || null
  const weapon = loadoutRow ? normalizeEquipped(loadoutRow, 'weapon') : null
  const shield = loadoutRow ? normalizeEquipped(loadoutRow, 'shield') : null

  const stashRes = await client.query(
    `select items from public.bloblet_gear_inventory where bloblet_address = $1`,
    [addressCanonical],
  )
  const stash = normalizeStash(stashRes.rows[0]?.items ?? [])

  if (options.mask) {
    return {
      equipped: {
        weapon: maskItem(weapon),
        shield: maskItem(shield),
      },
      stash: stash.map((item) => ({
        ...maskItem(item)!,
        masked: true,
      })),
      stashCount: stash.length,
    }
  }

  return {
    equipped: { weapon, shield },
    stash,
    stashCount: stash.length,
  }
}

export async function getGearInventoryForAddress(
  address: string,
  options: GetOptions = {},
): Promise<GearInventory> {
  const addressCanonical = normalizeChainAddress(address, 'sol')
  if (!addressCanonical) {
    return {
      equipped: { weapon: null, shield: null },
      stash: [],
      stashCount: 0,
    }
  }
  const { client, ...rest } = options
  if (client) {
    return fetchGear(client, addressCanonical, rest)
  }
  return withPgClient((pooledClient) => fetchGear(pooledClient, addressCanonical, rest))
}

async function appendGearEntry(client: PoolClient, params: GearEntryInput) {
  const entry = {
    id: randomUUID(),
    baseItemId: params.baseItemId,
    slug: params.slug,
    type: params.slot,
    name: params.name,
    rarity: params.rarity,
    op: params.op,
    dp: params.dp,
    iconUrl: params.iconUrl,
    generatedIconUrl: params.generatedIconUrl,
    createdAt: params.now.toISOString(),
    metadata: params.metadata,
  }

  await client.query(
    `insert into public.bloblet_gear_inventory (bloblet_address, items)
     values ($1, jsonb_build_array(($2)::jsonb))
     on conflict (bloblet_address) do update
       set items = coalesce(public.bloblet_gear_inventory.items, '[]'::jsonb) || jsonb_build_array(($2)::jsonb),
           updated_at = now()`,
    [params.addressCanonical, JSON.stringify(entry)],
  )
}

export async function recordGearDrop(
  client: PoolClient,
  params: {
    addressCanonical: string
    drop: CareDropResult
    slot: 'weapon' | 'shield'
    source: DropSource
    action?: string | null
    now: Date
  },
) {
  const { addressCanonical, drop, slot, source, action, now } = params
  if (!drop.item) return

  await appendGearEntry(client, {
    addressCanonical,
    slot,
    baseItemId: drop.item.id ?? null,
    slug: drop.item.slug ?? null,
    name: drop.item.name ?? null,
    rarity: drop.item.rarity ?? null,
    op: drop.item.op ?? null,
    dp: drop.item.dp ?? null,
    iconUrl: drop.item.icon_url ?? null,
    generatedIconUrl: null,
    now,
    metadata: {
      source,
      slot,
      upgraded: drop.upgraded,
      action: action ?? null,
      probability: drop.probability,
      roll: drop.roll,
    },
  })
}

export async function recordBattleLoot(
  client: PoolClient,
  params: {
    addressCanonical: string
    slot: 'weapon' | 'shield'
    item: PvpItem | null
    now: Date
    metadata?: Record<string, any> | null
  },
) {
  const { addressCanonical, slot, item, now, metadata } = params
  if (!item) return

  await appendGearEntry(client, {
    addressCanonical,
    slot,
    baseItemId: item.id ?? null,
    slug: item.slug ?? null,
    name: item.name ?? null,
    rarity: item.rarity ?? null,
    op: item.op ?? null,
    dp: item.dp ?? null,
    iconUrl: item.icon_url ?? null,
    generatedIconUrl: null,
    now,
    metadata: {
      source: 'battle_loot',
      slot,
      ...metadata,
    },
  })
}

export async function getMaskedOpponentGear(address: string): Promise<GearInventory> {
  return getGearInventoryForAddress(address, { mask: true })
}
