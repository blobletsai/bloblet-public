import type { PoolClient } from 'pg'
import type { PvpItem } from '@/types'
import { normalizeChainAddress } from '@/src/server/address'
import { resolveChainKind } from '@/src/server/chains'
import { withPgClient } from '@/src/server/pg'
import {
  getChallengeableMinPoints,
  getHouseCutBasisPoints,
  getMinTransferPoints,
  getTransferBasisPoints,
} from '@/src/shared/gameplay/config'

import { BattleFetcher } from './battle/fetcher'
import { BattleEngine } from './battle/engine'
import { buildFinalLoadouts } from './battle/loadouts'
import { BattlePersister } from './battle/persister'
import { evaluateBattleEligibility } from './battleEligibility'
import { CryptoRandomProvider } from './battle/random'
import type { BattleEffect } from './battle/types'

export type BattleResult = {
  winner: 'attacker' | 'defender'
  critical: boolean
  effects: BattleEffect[]
  loot: Array<{
    slot: 'weapon' | 'shield'
    item_id: number
    item_slug: string
    from: string
    to: string
    equipped: boolean
  }>
  transfer: {
    transfer: number
    house: number
    winnerGain: number
  }
  cooldownUntil: string
  battleId: number
  attacker: {
    address: string
    booster: number
    base: number
    roll: number
    pointsBefore: number
    pointsAfter: number
  }
  attackerLoadout: {
    weapon: PvpItem | null
    shield: PvpItem | null
  }
  defender: {
    address: string
    booster: number
    base: number
    roll: number
    pointsBefore: number
    pointsAfter: number
  }
  defenderLoadout: {
    weapon: PvpItem | null
    shield: PvpItem | null
  }
}

export class BattleError extends Error {
  status: number
  details?: any

  constructor(status: number, message: string, details?: any) {
    super(message)
    this.status = status
    this.details = details
  }
}

function resolveCanonicalAddress(raw: string, chainKind: string): string {
  try {
    const canonical = normalizeChainAddress(raw, chainKind)
    if (!canonical) {
      throw new BattleError(400, 'invalid_address')
    }
    return canonical
  } catch (err) {
    throw new BattleError(400, 'invalid_address')
  }
}

function maskAddress(address: string) {
  const trimmed = String(address || '')
  if (trimmed.length <= 6) return '???'
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-3)}`
}

export function buildMaskedOpponent(address: string) {
  return {
    maskedId: maskAddress(address),
    displayHint: 'Shrouded challenger',
  }
}

export type BattleOptions = {
  now?: Date
  chainKind?: string
}

// Legacy compatible return type for API consumers
// Engine's BattleOutcome is very similar but nested. We map it here.
// Actually `types/index.ts` defines `PvpBattle` etc.
// Let's stick to the shape expected by `pages/api/pvp/challenge.ts`
// Check `pages/api/pvp/challenge.ts`:
// type BattleResponse = ... { winner, critical, loot, transfer, cooldownEndsAt, battleId, attacker: { ... }, defender: { ... }, opponent }
// `runBattle` returns `BattleResult` which matches that structure (mostly).

export async function runBattle(attacker: string, defender: string, options: BattleOptions = {}): Promise<BattleResult> {
  const chainKind = options.chainKind || resolveChainKind()
  const attackerCanonical = resolveCanonicalAddress(attacker, chainKind)
  const defenderCanonical = resolveCanonicalAddress(defender, chainKind)
  
  if (attackerCanonical === defenderCanonical) {
    throw new BattleError(400, 'self_target')
  }

  const now = options.now || new Date()

  return withPgClient(async (client) => {
    // 1. Transaction Start
    await client.query('BEGIN')
    
    try {
      await ensureLoadouts(client, [attackerCanonical, defenderCanonical])
      // 2. Data Fetching (Locks Rows)
      const fetcher = new BattleFetcher(client)
      const ctx = await fetcher.loadContext(attackerCanonical, defenderCanonical, now)
      
      // 3. Eligibility Check
      // We do this here because it depends on the fetched state
      const minStake = Math.max(getChallengeableMinPoints(), getMinTransferPoints())
      const eligibility = evaluateBattleEligibility(
        {
          address: ctx.attacker.address,
          status: ctx.attacker.status,
          pointsBefore: ctx.attacker.points,
          isAlive: ctx.attacker.isAlive,
        },
        {
          address: ctx.defender.address,
          status: ctx.defender.status,
          pointsBefore: ctx.defender.points,
          isAlive: ctx.defender.isAlive,
        },
        minStake
      )
      
      if (!eligibility.allowed) {
        const blocker = eligibility.blocker
        throw new BattleError(400, blocker.code, blocker.details)
      }

      // 4. Engine Resolution (Pure Logic)
      const rng = new CryptoRandomProvider()
      const outcome = BattleEngine.resolve(ctx, rng)

      const finalLoadouts = buildFinalLoadouts(
        ctx.attacker.address,
        ctx.defender.address,
        ctx.attacker.loadout,
        ctx.defender.loadout,
        outcome.loot,
      )
      
      // 5. Persistence (Writes)
      const persister = new BattlePersister(client)
      const battleId = await persister.commit(outcome, ctx.attacker, ctx.defender, now)
      
      // 6. Transaction Commit
      await client.query('COMMIT')
      
      // 7. Map to Legacy Result Shape
      const attackerLoadout = finalLoadouts.get(ctx.attacker.address) || ctx.attacker.loadout
      const defenderLoadout = finalLoadouts.get(ctx.defender.address) || ctx.defender.loadout

      return {
        winner: outcome.winner,
        critical: outcome.critical,
        effects: outcome.effects,
        loot: outcome.loot.map(l => ({
          slot: l.slot,
          item_id: l.item.id,
          item_slug: l.item.slug,
          from: l.from,
          to: l.to,
          equipped: l.equipped
        })),
        transfer: outcome.transfer,
        cooldownUntil: outcome.cooldownUntil,
        battleId,
        attacker: {
          address: outcome.attacker.address,
          booster: outcome.attacker.booster,
          base: outcome.attacker.base,
          roll: outcome.attacker.roll,
          pointsBefore: outcome.attacker.pointsBefore,
          pointsAfter: outcome.attacker.pointsAfter,
        },
        attackerLoadout,
        defender: {
          address: outcome.defender.address,
          booster: outcome.defender.booster,
          base: outcome.defender.base,
          roll: outcome.defender.roll,
          pointsBefore: outcome.defender.pointsBefore,
          pointsAfter: outcome.defender.pointsAfter,
        },
        defenderLoadout: defenderLoadout,
      }
      
    } catch (err) {
      await client.query('ROLLBACK')
      if (err instanceof BattleError) throw err
      throw err
    }
  })
}

// Exports for testing
export const __battleTestables = {
  // computeTransfer, etc are now in Engine
  // We can export the classes for testing if needed
  BattleFetcher,
  BattleEngine,
  BattlePersister
}

async function ensureLoadouts(client: PoolClient, addresses: string[]) {
  const unique = Array.from(new Set(addresses.filter(Boolean)))
  if (!unique.length) return

  const loadoutRes = await client.query(
    `select bloblet_address
       from public.bloblet_loadout
      where bloblet_address = any($1::text[])
      for update`,
    [unique],
  )
  const existing = new Set(
    loadoutRes.rows.map((row) => String(row.bloblet_address || '').trim()).filter(Boolean),
  )
  const missing = unique.filter((addr) => !existing.has(addr))
  if (!missing.length) return

  const itemsRes = await client.query(
    `select id, type, op, dp
       from public.pvp_items`,
  )
  if (!itemsRes.rows.length) {
    throw new BattleError(500, 'pvp_items_empty')
  }

  let starterWeaponId: number | null = null
  let starterWeaponStat = Number.POSITIVE_INFINITY
  let starterShieldId: number | null = null
  let starterShieldStat = Number.POSITIVE_INFINITY

  for (const row of itemsRes.rows) {
    const type = row.type === 'shield' ? 'shield' : 'weapon'
    const stat = type === 'weapon' ? Number(row.op || 0) : Number(row.dp || 0)
    if (type === 'weapon' && stat <= starterWeaponStat) {
      starterWeaponStat = stat
      starterWeaponId = row.id ? Number(row.id) : null
    }
    if (type === 'shield' && stat <= starterShieldStat) {
      starterShieldStat = stat
      starterShieldId = row.id ? Number(row.id) : null
    }
  }

  for (const addr of missing) {
    await client.query(
      `insert into public.bloblet_loadout (bloblet_address, weapon_item_id, shield_item_id)
       values ($1, $2, $3)
       on conflict (bloblet_address) do nothing`,
      [addr, starterWeaponId, starterShieldId],
    )
  }
}
