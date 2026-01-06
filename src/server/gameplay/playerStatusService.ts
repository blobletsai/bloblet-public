import type { PoolClient } from 'pg'

import { normalizeChainAddress } from '@/src/server/address'
import { withPgClient, withPgReadonlyClient } from '@/src/server/pg'
import { getGearInventoryForAddress } from './gearService'
import { getScoreForAddress } from './scoreService'
import {
  buildChargeStatus,
  emptyChargeState,
  getFastForwardConfig,
  parseChargeState,
  type ChargeStatus,
} from '@/src/shared/care'

type RecentBattle = {
  battleId: number
  opponentMasked: string
  role: 'attacker' | 'defender'
  outcome: 'win' | 'loss'
  critical: boolean
  transfer: number
  occurredAt: string
}

export type PlayerStatus = {
  care: ChargeStatus
  gear: Awaited<ReturnType<typeof getGearInventoryForAddress>>
  score: Awaited<ReturnType<typeof getScoreForAddress>>
  recentBattle: RecentBattle | null
}

function maskAddress(address: string) {
  const trimmed = String(address || '')
  if (trimmed.length <= 8) return trimmed
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}

async function fetchCareStatus(
  client: PoolClient,
  addressCanonical: string,
  options: { now?: Date; isNewcomer?: boolean } = {},
) {
  const now = options.now ?? new Date()
  const ffConfig = getFastForwardConfig()
  const res = await client.query(
    `select care_state from public.bloblets where address_canonical = $1 limit 1`,
    [addressCanonical],
  )
  const row = res.rows[0]
  const state = parseChargeState(row?.care_state)
  return buildChargeStatus(state, now, {
    fastForward: {
      enabled: ffConfig.enabled,
      burstsPerDay: ffConfig.burstsPerDay,
      isNewcomer: options.isNewcomer === true,
    },
  })
}

async function fetchRecentBattle(client: PoolClient, addressCanonical: string): Promise<RecentBattle | null> {
  const battleRes = await client.query(
    `select id,
            attacker,
            defender,
            winner,
            critical,
            transfer_points,
            created_at
       from public.pvp_battles
      where attacker = $1 or defender = $1
      order by id desc
      limit 1`,
    [addressCanonical],
  )
  if (!battleRes.rows.length) return null
  const row = battleRes.rows[0]
  const attackerAddr = String(row.attacker || '').trim()
  const defenderAddr = String(row.defender || '').trim()
  const isAttacker = attackerAddr === addressCanonical
  const opponent = isAttacker ? defenderAddr : attackerAddr
  const winner = row.winner === 'attacker' ? 'attacker' : 'defender'
  const outcome = (isAttacker && winner === 'attacker') || (!isAttacker && winner === 'defender')
    ? 'win'
    : 'loss'
  return {
    battleId: Number(row.id),
    opponentMasked: maskAddress(String(opponent || '')),
    role: isAttacker ? 'attacker' : 'defender',
    outcome,
    critical: row.critical === true,
    transfer: Number(row.transfer_points || 0),
    occurredAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  }
}

export async function getPlayerStatus(address: string | null | undefined, options: { readOnly?: boolean } = {}): Promise<PlayerStatus> {
  const chainKind = 'sol'
  let canonical = ''
  if (address) {
    try {
      canonical = normalizeChainAddress(address, chainKind)
    } catch {
      canonical = ''
    }
  }
  const baseCareState = emptyChargeState()
  const defaultCare = buildChargeStatus(baseCareState, new Date())
  if (!canonical) {
    return {
      care: defaultCare,
      gear: { equipped: { weapon: null, shield: null }, stash: [], stashCount: 0 },
      score: { balance: 0, balanceRaw: 0, rank: null, tier: 'rookie' },
      recentBattle: null,
    }
  }

  const executor = options.readOnly ? withPgReadonlyClient : withPgClient
  return executor(async (client) => {
    const now = new Date()
    const gear = await getGearInventoryForAddress(canonical, { client })
    const stashCount = typeof (gear as any)?.stashCount === 'number' ? Number((gear as any).stashCount) : gear.stash.length
    const isNewcomer = !gear.equipped.weapon && !gear.equipped.shield && stashCount === 0
    const care = await fetchCareStatus(client, canonical, { now, isNewcomer })
    const score = await getScoreForAddress(canonical, { client })
    const recentBattle = await fetchRecentBattle(client, canonical)

    return {
      care,
      gear,
      score,
      recentBattle,
    }
  })
}
