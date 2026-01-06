import type { PoolClient } from 'pg'
import type { PvpItem } from '@/types'
import { fetchRewardBalances, roundPoints } from '@/src/server/rewards'
import { buildChargeStatus, parseChargeState } from '@/src/shared/care'
import {
  getChallengeableMinPoints,
  getHouseCutBasisPoints,
  getMinTransferPoints,
  getTransferBasisPoints,
} from '@/src/shared/gameplay/config'
import { BattleError } from '../battleService'
import type { BattleContext, ParticipantState } from './types'
import { gameplayConfig } from '@/src/config/gameplay'

export class BattleFetcher {
  constructor(private client: PoolClient) {}

  async loadContext(attackerAddr: string, defenderAddr: string, now: Date): Promise<BattleContext> {
    const nowMs = now.getTime()
    const pairCooldownMs = this.pairCooldownMs()

    // 1. Check Defender Grace Period (Read-only check)
    // Defender global grace period: block challenges to a recently defeated defender
    const graceMs = this.defenderGraceMs()
    let defenderLastLossAt: number | null = null
    
    if (graceMs > 0) {
      const graceRes = await this.client.query(
        `select created_at
           from public.reward_ledger
          where address = $1 and reason = 'battle_loss'
          order by id desc
          limit 1`,
        [defenderAddr],
      )
      defenderLastLossAt = graceRes.rows[0]?.created_at ? Date.parse(graceRes.rows[0].created_at) : 0
      if (defenderLastLossAt && nowMs - defenderLastLossAt < graceMs) {
        const nextAllowedAt = new Date(defenderLastLossAt + graceMs).toISOString()
        throw new BattleError(429, 'defender_recently_lost', { nextAllowedAt })
      }
    }

    // 2. Check & Lock Pair Cooldowns
    const cooldownRes = await this.client.query(
      `select attacker, defender, next_allowed_at
         from public.pvp_cooldowns
        where (attacker = $1 and defender = $2) or (attacker = $2 and defender = $1)
        for update`,
      [attackerAddr, defenderAddr],
    )

    for (const row of cooldownRes.rows) {
      const next = row.next_allowed_at ? Date.parse(row.next_allowed_at) : 0
      if (row.attacker === attackerAddr && next && next > nowMs) {
        throw new BattleError(429, 'pair_cooldown', { nextAllowedAt: new Date(next).toISOString() })
      }
    }

    // 3. Lock Bloblets (Ensure existence & alive status)
    const blobRes = await this.client.query(
      `select address_canonical as address, care_state, is_alive
         from public.bloblets
        where address_canonical = any($1::text[])
        for update`,
      [[attackerAddr, defenderAddr]],
    )
    if (blobRes.rows.length !== 2) {
      throw new BattleError(404, 'bloblet_not_found')
    }

    const blobMap = new Map<string, any>()
    for (const row of blobRes.rows) {
      const key = String(row.address || '').trim()
      if (key) blobMap.set(key, row)
    }

    const attackerBlob = blobMap.get(attackerAddr)
    const defenderBlob = blobMap.get(defenderAddr)
    if (!attackerBlob) throw new BattleError(404, 'bloblet_not_found')
    if (!defenderBlob) throw new BattleError(404, 'defender_missing')
    if (attackerBlob.is_alive === false) throw new BattleError(400, 'attacker_dead')
    if (defenderBlob.is_alive === false) throw new BattleError(400, 'defender_dead')

    // 4. Fetch Reward Balances (Locks rows if Ledger enabled)
    const rewardSnapshots = await fetchRewardBalances(this.client, [attackerAddr, defenderAddr], { lockRows: true })

    // 5. Fetch Items Catalog (Read-only)
    const itemsRes = await this.client.query(
      `select id, slug, type, name, rarity, op, dp, icon_url
         from public.pvp_items`,
    )
    if (!itemsRes.rows.length) {
      throw new BattleError(500, 'pvp_items_empty')
    }
    const itemsById = new Map<number, PvpItem>()
    for (const row of itemsRes.rows) {
      const item: PvpItem = {
        id: Number(row.id),
        slug: String(row.slug),
        type: row.type === 'shield' ? 'shield' : 'weapon',
        name: String(row.name),
        rarity: String(row.rarity || 'common'),
        op: Number(row.op || 0),
        dp: Number(row.dp || 0),
        icon_url: row.icon_url || null,
      }
      itemsById.set(item.id, item)
    }

    // 6. Fetch & Lock Loadouts (Auto-create if missing)
    const loadoutRes = await this.client.query(
      `select bloblet_address, weapon_item_id, shield_item_id
         from public.bloblet_loadout
        where bloblet_address = any($1::text[])
        for update`,
      [[attackerAddr, defenderAddr]],
    )
    const loadoutMap = new Map<
      string,
      { weapon_item_id: number | null; shield_item_id: number | null }
    >()
    for (const row of loadoutRes.rows) {
      const key = String(row.bloblet_address || '').trim()
      if (!key) continue
      loadoutMap.set(key, {
        weapon_item_id: row.weapon_item_id ? Number(row.weapon_item_id) : null,
        shield_item_id: row.shield_item_id ? Number(row.shield_item_id) : null,
      })
    }

    // 7. Fetch Pair Battle History (Anti-Farm)
    let pairBattlesLastHour = 0
    const pairLimit = this.pairFreqLimit1h()
    if (pairLimit > 0) {
      const oneHourAgo = new Date(nowMs - 60 * 60 * 1000).toISOString()
      const freqRes = await this.client.query(
        `select count(*)::int as cnt
           from public.pvp_battles
          where created_at >= $1
            and ((attacker = $2 and defender = $3) or (attacker = $3 and defender = $2))`,
        [oneHourAgo, attackerAddr, defenderAddr],
      )
      pairBattlesLastHour = Number(freqRes.rows?.[0]?.cnt || 0)
    }

    // Helper to assemble ParticipantState
    const buildParticipant = (address: string): ParticipantState => {
      const blob = blobMap.get(address) || {}
      const careState = this.parseCareState(blob.care_state)
      const status = buildChargeStatus(careState, now)
      const boosterLevel = status.boosterLevel
      const snapshot = rewardSnapshots.get(address)
      const points = roundPoints(snapshot?.currentBalance ?? 0)
      const load = loadoutMap.get(address) || {
        weapon_item_id: null,
        shield_item_id: null,
      }
      const weapon = load.weapon_item_id ? itemsById.get(load.weapon_item_id) || null : null
      const shield = load.shield_item_id ? itemsById.get(load.shield_item_id) || null : null
      return {
        address,
        isAlive: blob.is_alive !== false,
        points,
        boosterLevel,
        status,
        loadout: { weapon, shield },
      }
    }

    return {
      attacker: buildParticipant(attackerAddr),
      defender: buildParticipant(defenderAddr),
      config: {
        pairCooldownMs,
        luckVariance: this.luckVariance(),
        tieBand: this.tieBand(),
        criticalChance: this.criticalChance(),
        transferBps: getTransferBasisPoints(),
        houseCutBps: getHouseCutBasisPoints(),
        minTransfer: getMinTransferPoints(),
        pairBattlesLastHour,
        pairFreqLimit: pairLimit,
        pairSurchargeBps: this.pairHouseSurchargeBps(),
        defenderGraceMs: graceMs,
        defenderLastLossAt,
        nowMs,
        cooldownEndsAtIso: new Date(nowMs + pairCooldownMs).toISOString(),
      },
    }
  }

  // --- Env Config Helpers (Pure) ---

  private pairCooldownMs() {
    const raw = gameplayConfig.pvp.pairCooldownMin
    return Math.max(1, raw) * 60 * 1000
  }

  private luckVariance() {
    const raw = gameplayConfig.pvp.luckVariance
    return Math.max(0, Math.min(0.5, Number.isFinite(raw) ? raw : 0.2))
  }

  private tieBand() {
    const raw = gameplayConfig.pvp.tieBand
    return Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0.2))
  }

  private criticalChance() {
    const raw = gameplayConfig.pvp.criticalChance
    return Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0.05))
  }

  private defenderGraceMs() {
    const raw = gameplayConfig.pvp.defenderGlobalCooldownMin
    if (!Number.isFinite(raw) || raw <= 0) return 0
    return Math.max(1, Math.floor(raw)) * 60 * 1000
  }

  private pairFreqLimit1h() {
    const raw = gameplayConfig.pvp.pairFreqLimit1h
    if (!Number.isFinite(raw) || raw <= 0) return 0
    return Math.max(1, Math.floor(raw))
  }

  private pairHouseSurchargeBps() {
    const raw = gameplayConfig.pvp.pairHouseSurchargeBps
    if (!Number.isFinite(raw) || raw <= 0) return 0
    return Math.max(0, Math.min(10_000, Math.floor(raw)))
  }

  // --- Utils ---

  private statForType(item: PvpItem | null | undefined, slot: 'weapon' | 'shield') {
    if (!item) return 0
    return slot === 'weapon' ? Number(item.op || 0) : Number(item.dp || 0)
  }

  private parseCareState(raw: any) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try {
      return JSON.parse(String(raw))
    } catch {
      return {}
    }
  }
}
