import type { PoolClient } from 'pg'

import { normalizeChainAddress } from '@/src/server/address'
import { resolveChainKind } from '@/src/server/chains'
import { withPgClient } from '@/src/server/pg'
import { normalizeLedgerPoints, rewardLedgerDecimals } from '@/src/shared/points'

const DECIMALS = rewardLedgerDecimals()

export type ScoreTier = 'legend' | 'champion' | 'adventurer' | 'rookie'

export type ScoreSnapshot = {
  balance: number
  balanceRaw: number
  rank: number | null
  tier: ScoreTier
}

export type LeaderboardEntry = {
  address: string
  addressMasked: string
  balance: number
  balanceRaw: number
}

export function maskAddress(address: string) {
  const trimmed = String(address || '')
  if (!trimmed) return ''
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}

export function scoreTier(balance: number): ScoreTier {
  if (balance >= 1000) return 'legend'
  if (balance >= 250) return 'champion'
  if (balance >= 50) return 'adventurer'
  return 'rookie'
}

async function fetchScore(client: PoolClient, addressCanonical: string): Promise<ScoreSnapshot> {
  const res = await client.query(
    `select
        coalesce(rb.balance_raw, 0) as balance_raw,
        coalesce(rb.balance, 0) as balance,
        (
          select 1 + count(*) from public.reward_balances AS ranked
          where ranked.balance_raw > coalesce(rb.balance_raw, 0)
        ) as rank
      from public.reward_balances rb
     where rb.address = $1
     limit 1`,
    [addressCanonical],
  )

  const row = res.rows[0] || { balance_raw: 0, balance: 0, rank: null }
  const balanceRaw = Number(row.balance_raw || 0)
  const balance = normalizeLedgerPoints(balanceRaw, DECIMALS)
  const rankValue = row.rank != null ? Number(row.rank) : null

  return {
    balance,
    balanceRaw,
    rank: rankValue && Number.isFinite(rankValue) ? rankValue : null,
    tier: scoreTier(balance),
  }
}

export async function getScoreForAddress(
  address: string | null | undefined,
  options: { client?: PoolClient } = {},
): Promise<ScoreSnapshot> {
  const chainKind = resolveChainKind()
  let canonical = ''
  if (address) {
    try {
      canonical = normalizeChainAddress(address, chainKind)
    } catch {
      canonical = ''
    }
  }
  if (!canonical) {
    return { balance: 0, balanceRaw: 0, rank: null, tier: 'rookie' }
  }
  if (options.client) {
    return fetchScore(options.client, canonical)
  }
  return withPgClient((client) => fetchScore(client, canonical))
}

export async function getScoreLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const capped = Math.max(1, Math.min(100, Math.floor(limit)))
  return withPgClient(async (client) => {
    const res = await client.query(
      `select address, balance_raw
         from public.reward_balances
        where balance_raw > 0
        order by balance_raw desc, address asc
        limit $1`,
      [capped],
    )
    return res.rows.map((row) => {
      const balanceRaw = Number(row.balance_raw || 0)
      const balance = normalizeLedgerPoints(balanceRaw, DECIMALS)
      const address = String(row.address || '')
      return {
        address,
        addressMasked: maskAddress(address),
        balanceRaw,
        balance,
      }
    })
  })
}
