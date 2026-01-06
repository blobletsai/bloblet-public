import crypto from 'node:crypto'
import type { PoolClient } from 'pg'

import type { PvpItem, PvpItemType } from '@/types'

import { getCareDropConfig } from './careConfig'

const DROP_PRECISION = 1_000_000

export function careDropProbability() {
  return getCareDropConfig().baseProbability
}

function carryAccumulatorOnNoLoot(pBase: number, effective: number, rngPassed: boolean) {
  if (!rngPassed) return effective
  const guaranteeThreshold = Math.max(0, Math.min(1, 1 - pBase))
  return Math.min(1, Math.max(effective, guaranteeThreshold))
}

export function randomUnit() {
  return crypto.randomInt(DROP_PRECISION) / DROP_PRECISION
}

function statForType(item: PvpItem | null | undefined, type: PvpItemType) {
  if (!item) return 0
  return type === 'weapon' ? Number(item.op || 0) : Number(item.dp || 0)
}

function chooseDropSlot(currentWeapon: PvpItem | null, currentShield: PvpItem | null): PvpItemType {
  const { shieldFirstBias } = getCareDropConfig()
  if (!currentWeapon && currentShield) return 'weapon'
  if (!currentShield && currentWeapon) return 'shield'
  if (!currentWeapon && !currentShield) {
    if (shieldFirstBias) return 'shield'
    return randomUnit() < 0.5 ? 'weapon' : 'shield'
  }
  const weaponStat = statForType(currentWeapon, 'weapon')
  const shieldStat = statForType(currentShield, 'shield')
  if (weaponStat === shieldStat) return randomUnit() < 0.5 ? 'weapon' : 'shield'
  return weaponStat < shieldStat ? 'weapon' : 'shield'
}

export type CareDropResult = {
  slot: PvpItemType
  upgraded: boolean
  item: PvpItem | null
  previous: PvpItem | null
  probability: number
  roll: number
  loadout?: {
    weapon_item_id: number | null
    shield_item_id: number | null
  }
}

export type CareDropFallbackType = 'catalog_missing' | 'maxed_out' | null

export type CareDropAttempt = CareDropResult & {
  awarded: boolean
  dropAccNext: number
  rngPassed: boolean
  fallbackType: CareDropFallbackType
}

export async function maybeGrantCareDrop(
  client: PoolClient,
  address: string,
  action: string,
  dropAcc: number = 0,
): Promise<CareDropAttempt> {
  const dropConfig = getCareDropConfig()
  const pBase = dropConfig.baseProbability > 0 && dropConfig.baseProbability <= 1 ? dropConfig.baseProbability : 0.2
  const acc = Math.max(0, Math.min(1, Number(dropAcc || 0)))
  const effective = Math.min(1, pBase + acc)
  const roll = randomUnit()
  const rngPassed = effective >= 1 || roll <= effective

  const loadoutRes = await client.query(
    `select bloblet_address, weapon_item_id, shield_item_id
       from public.bloblet_loadout
       where bloblet_address = $1
       for update`,
    [address],
  )
  const loadout = loadoutRes.rows[0] || null

  const catalogRes = await client.query(
    `select id, slug, type, name, rarity, op, dp, icon_url
       from public.pvp_items`,
  )
  const catalog = (catalogRes.rows as PvpItem[]) || []
  if (!catalog.length) {
    return {
      slot: 'weapon',
      upgraded: false,
      item: null,
      previous: null,
      probability: pBase,
      roll,
      awarded: false,
      dropAccNext: carryAccumulatorOnNoLoot(pBase, effective, rngPassed),
      rngPassed,
      fallbackType: rngPassed ? 'catalog_missing' : null,
    }
  }

  const byId = new Map<number, PvpItem>()
  for (const item of catalog) {
    if (!item) continue
    const normalizedId = Number((item as any).id)
    if (!Number.isFinite(normalizedId)) continue
    if ((item as any).id !== normalizedId) {
      ;(item as any).id = normalizedId
    }
    // Ensure numeric op/dp for downstream math
    if (item.op != null) (item as any).op = Number(item.op)
    if (item.dp != null) (item as any).dp = Number(item.dp)
    byId.set(normalizedId, item)
  }

  const currentWeapon = byId.get(Number(loadout?.weapon_item_id || 0)) || null
  const currentShield = byId.get(Number(loadout?.shield_item_id || 0)) || null
  const slot = chooseDropSlot(currentWeapon, currentShield)
  const current = slot === 'weapon' ? currentWeapon : currentShield
  const statNow = statForType(current, slot)

  const candidates = catalog
    .filter((item) => item.type === slot)
    .sort((a, b) => statForType(a, slot) - statForType(b, slot))
  if (!candidates.length) {
    return {
      slot,
      upgraded: false,
      item: null,
      previous: current,
      probability: pBase,
      roll,
      awarded: false,
      dropAccNext: carryAccumulatorOnNoLoot(pBase, effective, rngPassed),
      rngPassed,
      fallbackType: rngPassed ? 'catalog_missing' : null,
    }
  }

  const upgrade = candidates.find((item) => statForType(item, slot) > statNow)
  if (!upgrade || !rngPassed) {
    try {
      await client.query(
        `insert into public.events (type, severity, payload)
           values ($1, $2, $3::jsonb)`,
        [
          'care_drop',
          1,
          JSON.stringify({
            address,
            action,
            slot,
            outcome: !rngPassed ? 'roll_miss' : 'no_upgrade',
            current: current?.slug || null,
            probability: pBase,
            roll,
          }),
        ],
      )
    } catch {}
    const fallbackType: CareDropFallbackType =
      rngPassed && upgrade
        ? null
        : rngPassed
        ? 'maxed_out'
        : null
    return {
      slot,
      upgraded: false,
      item: null,
      previous: current,
      probability: pBase,
      roll,
      awarded: false,
      dropAccNext: carryAccumulatorOnNoLoot(pBase, effective, rngPassed),
      rngPassed,
      fallbackType,
    }
  }

  const nextWeaponId = slot === 'weapon' ? upgrade.id : loadout?.weapon_item_id ?? null
  const nextShieldId = slot === 'shield' ? upgrade.id : loadout?.shield_item_id ?? null

  await client.query(
    `insert into public.bloblet_loadout (bloblet_address, weapon_item_id, shield_item_id)
       values ($1, $2, $3)
     on conflict (bloblet_address) do update set
       weapon_item_id = excluded.weapon_item_id,
       shield_item_id = excluded.shield_item_id,
       updated_at = now()`,
    [address, nextWeaponId, nextShieldId],
  )

  try {
    await client.query(
      `insert into public.events (type, severity, payload)
         values ($1, $2, $3::jsonb)`,
      [
        'care_drop',
        0,
        JSON.stringify({
          address,
          action,
          slot,
          outcome: 'upgraded',
          item: upgrade.slug,
          rarity: upgrade.rarity,
          previous: current?.slug || null,
          probability: pBase,
          roll,
        }),
      ],
    )
  } catch {}

  return {
    slot,
    upgraded: true,
    item: upgrade,
    previous: current,
    probability: pBase,
    roll,
    awarded: true,
    dropAccNext: Math.max(0, effective >= 1 ? effective - 1 : 0),
    rngPassed,
    fallbackType: null,
    loadout: {
      weapon_item_id: nextWeaponId,
      shield_item_id: nextShieldId,
    },
  }
}
