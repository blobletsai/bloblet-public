import type { PostgrestError } from '@supabase/supabase-js'
import type { PoolClient } from 'pg'
import { rewardsConfig } from '@/src/config/rewards'
import { gameplayConfig } from '@/src/config/gameplay'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'
import { supaAdmin } from '@/src/server/supa'
import {
  normalizeLedgerPoints,
  rewardDecimals as getRewardDecimals,
  rewardLedgerDecimals,
} from '@/src/shared/points'

export const rewardDecimals = getRewardDecimals

export const REWARD_LEDGER_ENABLED = rewardsConfig.ledger.enabled

export type RewardLedgerReason =
  | 'balance_snapshot'
  | 'care_upkeep'
  | 'care_debit'
  | 'battle_win'
  | 'battle_loss'
  | 'treasury_cut'
  | 'swap_credit'
  | 'redeem_debit'
  | 'redeem_fee'
  | 'manual_adjustment'
  | 'rename_debit'
  | 'avatar_debit'
  | 'landmark_debit'
  | 'faucet_credit'
  | 'dead_confiscation'

export type RewardLedgerEntryInput = {
  address: string
  delta: number
  reason: RewardLedgerReason
  battleId?: number | null
  swapId?: number | null
  metadata?: Record<string, any> | null
}

export type RewardBalanceSnapshot = {
  address: string
  tokenBalance: number
  ledgerBalance: number | null
  currentBalance: number
}

type FetchOptions = {
  lockRows?: boolean
}

type ApplyOptions = {
  now?: Date
  updateTokenHolders?: boolean
}

const PRECISION = 1e6
const ACTIVE_CHAIN_KIND = resolveChainKind()
const ACTIVE_CHAIN_KIND_PARAM = ACTIVE_CHAIN_KIND
const IS_SOL_CHAIN = ACTIVE_CHAIN_KIND === 'sol'
const LEDGER_DECIMALS = rewardLedgerDecimals()

export function roundPoints(value: number): number {
  return Math.round(value * PRECISION) / PRECISION
}

export function careUpkeepPoints(actions = 1): number {
  const perActionRaw = Number(gameplayConfig.care.upkeepPoints)
  const perAction = Number.isFinite(perActionRaw) ? perActionRaw : 1
  const total = perAction * Math.max(1, actions)
  return roundPoints(total)
}

function parseNumeric(value: any): number {
  if (value == null) return 0
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function normalizeAddress(address: string): string {
  return normalizeChainAddress(address, ACTIVE_CHAIN_KIND) || ''
}

export async function fetchRewardBalances(
  client: PoolClient,
  addresses: string[],
  options: FetchOptions = {}
): Promise<Map<string, RewardBalanceSnapshot>> {
  const unique = Array.from(new Set(addresses.map(normalizeAddress))).filter(Boolean)
  const map = new Map<string, RewardBalanceSnapshot>()
  if (!unique.length) return map

  const tokenQuery = options.lockRows === false
    ? `select address_canonical as address, balance from public.token_holders where address_canonical = any($1::text[]) and chain_kind = $2`
    : `select address_canonical as address, balance from public.token_holders where address_canonical = any($1::text[]) and chain_kind = $2 for update`

  const tokenRes = await client.query(tokenQuery, [unique, ACTIVE_CHAIN_KIND_PARAM])
  for (const row of tokenRes.rows) {
    const addr = normalizeAddress(row.address)
    const tokenBalance = parseNumeric(row.balance)
    const initialCurrent = REWARD_LEDGER_ENABLED ? 0 : tokenBalance
    map.set(addr, {
      address: addr,
      tokenBalance,
      ledgerBalance: REWARD_LEDGER_ENABLED ? null : tokenBalance,
      currentBalance: initialCurrent,
    })
  }

  // Ensure all requested addresses have at least zero balances in map
  for (const addr of unique) {
    if (!map.has(addr)) {
      map.set(addr, {
        address: addr,
        tokenBalance: 0,
        ledgerBalance: REWARD_LEDGER_ENABLED ? null : 0,
        currentBalance: REWARD_LEDGER_ENABLED ? 0 : 0,
      })
    }
  }

  if (!REWARD_LEDGER_ENABLED) {
    return map
  }

  const latestRes = await client.query(
    `select rl.address, rl.balance_after, rl.id
       from public.reward_ledger rl
       join (
         select address, max(id) as max_id
         from public.reward_ledger
         where address = any($1::text[])
         group by address
       ) latest on latest.address = rl.address and latest.max_id = rl.id`,
    [unique]
  )
  const needsFallback: string[] = []
  for (const row of latestRes.rows) {
    const addr = normalizeAddress(row.address)
    const snap = map.get(addr)
    if (!snap) continue
    const bal = parseNumeric(row.balance_after)
    if (Number.isFinite(bal)) {
      snap.ledgerBalance = bal
      snap.currentBalance = bal
    } else {
      needsFallback.push(addr)
    }
  }

  if (needsFallback.length) {
    const fallbackRes = await client.query(
      `select address, coalesce(sum(delta), 0)::numeric as total
         from public.reward_ledger
         where address = any($1::text[])
         group by address`,
      [needsFallback]
    )
    for (const row of fallbackRes.rows) {
      const addr = normalizeAddress(row.address)
      const snap = map.get(addr)
      if (!snap) continue
      const bal = parseNumeric(row.total)
      snap.ledgerBalance = bal
      snap.currentBalance = bal
    }
  }

  return map
}

export async function applyLedgerEntries(
  client: PoolClient,
  entries: RewardLedgerEntryInput[],
  options: ApplyOptions = {}
): Promise<Map<string, number>> {
  if (!entries.length) return new Map()
  if (!REWARD_LEDGER_ENABLED) {
    throw new Error('Reward ledger is disabled')
  }

  const now = options.now || new Date()
  const nowIso = now.toISOString()
  const addresses = entries.map((e) => normalizeAddress(e.address)).filter(Boolean)
  await ensureTokenHolderRows(client, addresses)
  const stateMap = await fetchRewardBalances(client, addresses, { lockRows: true })
  const newBalances = new Map<string, number>()

  const values: string[] = []
  const params: any[] = []
  let idx = 1

  for (const entry of entries) {
    const address = normalizeAddress(entry.address)
    if (!address) continue
    const delta = roundPoints(entry.delta)
    if (!Number.isFinite(delta) || delta === 0) continue

    const current = newBalances.has(address)
      ? (newBalances.get(address) as number)
      : (stateMap.get(address)?.currentBalance ?? 0)

    const next = roundPoints(current + delta)
    newBalances.set(address, next)

    const metadata = entry.metadata ? JSON.stringify(entry.metadata) : '{}'
    values.push(`($${idx++}, $${idx++}::public.reward_reason, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb)`)
    params.push(
      address,
      entry.reason,
      delta,
      next,
      entry.battleId ?? null,
      entry.swapId ?? null,
      metadata
    )
  }

  if (values.length) {
    await client.query(
      `insert into public.reward_ledger (address, reason, delta, balance_after, battle_id, swap_id, metadata)
       values ${values.join(', ')}`,
      params
    )
  }

  if (options.updateTokenHolders !== false && newBalances.size) {
    const upsertValues: string[] = []
    const upsertParams: any[] = []
    idx = 1
    for (const [address, balance] of newBalances.entries()) {
      const display = address
      upsertValues.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
      upsertParams.push(display, display, address, ACTIVE_CHAIN_KIND_PARAM, balance, nowIso)
    }

    await client.query(
      `insert into public.token_holders (address, address_cased, address_canonical, chain_kind, balance, updated_at)
         values ${upsertValues.join(', ')}
       on conflict (address_canonical, chain_kind) do update
         set balance = excluded.balance,
             address = excluded.address,
             address_canonical = excluded.address_canonical,
             address_cased = excluded.address_cased,
             updated_at = excluded.updated_at`,
      upsertParams
    )
  }

  return newBalances
}

export async function ensureTokenHolderRows(client: PoolClient, addresses: string[]): Promise<void> {
  if (!addresses.length) return
  const unique = Array.from(new Set(addresses.map(normalizeAddress))).filter(Boolean)
  if (!unique.length) return
  const nowIso = new Date().toISOString()
  const values: string[] = []
  const params: any[] = []
  let idx = 1
  for (const addr of unique) {
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
    params.push(addr, addr, addr, ACTIVE_CHAIN_KIND_PARAM, 0, nowIso)
  }
  await client.query(
    `insert into public.token_holders (address, address_cased, address_canonical, chain_kind, balance, updated_at)
       values ${values.join(', ')}
     on conflict (address_canonical, chain_kind) do nothing`,
    params
  )
}

export function ledgerTreasuryAddress(): string | null {
  const override = (rewardsConfig.ledger.treasuryAddress || '').trim()
  if (override) {
    return normalizeChainAddress(override, ACTIVE_CHAIN_KIND)
  }
  const solWallet = (rewardsConfig.ledger.solanaTreasuryAddress || '').trim()
  return solWallet ? normalizeChainAddress(solWallet, 'sol') : null
}

export function normalizeRewardDisplay(value: number): number {
  return roundPoints(parseNumeric(value))
}

export type RewardSnapshotLedgerEntry = {
  id: number
  reason: string
  deltaRaw: number
  delta: number
  balanceAfterRaw: number | null
  balanceAfter: number | null
  createdAt: string
}

export type RewardSnapshotSwapEntry = {
  id: number
  direction: string
  status: string
  amountRaw: number
  amount: number
  signature: string | null
  createdAt: string
}

export type RewardSnapshot = {
  decimals: number
  balanceRaw: number
  balance: number
  ledger: RewardSnapshotLedgerEntry[]
  swaps: RewardSnapshotSwapEntry[]
  fetchedAt: string
}

const EMPTY_REWARD_SNAPSHOT: RewardSnapshot = {
  decimals: LEDGER_DECIMALS,
  balanceRaw: 0,
  balance: 0,
  ledger: [],
  swaps: [],
  fetchedAt: new Date(0).toISOString(),
}

type RewardSnapshotOptions = {
  client?: PoolClient
}

async function loadRewardSnapshot(client: PoolClient, addressCanonical: string, decimals: number): Promise<RewardSnapshot> {
  const balanceRes = await client.query(
    `select balance_raw, balance
       from public.reward_balances
      where address = $1`,
    [addressCanonical]
  )
  const balanceRow = balanceRes.rows?.[0] ?? {}
  const balanceRaw = balanceRow.balance_raw != null ? parseNumeric(balanceRow.balance_raw) : parseNumeric(balanceRow.balance)
  const normalizedBalance = normalizeLedgerPoints(balanceRaw, decimals)

  const ledgerRes = await client.query(
    `select id, reason, delta, balance_after, created_at
       from public.reward_ledger
      where address = $1
      order by id desc
      limit 20`,
    [addressCanonical]
  )

  const swapsRes = await client.query(
    `select id, direction, status, amount_points, tx_signature, created_at
       from public.treasury_swaps
      where address = $1
      order by created_at desc
      limit 20`,
    [addressCanonical]
  )

  const ledger: RewardSnapshotLedgerEntry[] = (ledgerRes.rows || []).map((row: any) => {
    const deltaRaw = parseNumeric(row?.delta)
    const balanceAfterRaw = row?.balance_after != null ? parseNumeric(row.balance_after) : null
    return {
      id: Number(row?.id || 0),
      reason: String(row?.reason || 'unknown'),
      deltaRaw,
      delta: normalizeLedgerPoints(deltaRaw, decimals),
      balanceAfterRaw,
      balanceAfter: balanceAfterRaw != null ? normalizeLedgerPoints(balanceAfterRaw, decimals) : null,
      createdAt: row?.created_at ? String(row.created_at) : new Date().toISOString(),
    }
  })

  const swaps: RewardSnapshotSwapEntry[] = (swapsRes.rows || []).map((row: any) => {
    const amountRaw = parseNumeric(row?.amount_points)
    return {
      id: Number(row?.id || 0),
      direction: String(row?.direction || 'deposit'),
      status: String(row?.status || 'pending'),
      amountRaw,
      amount: normalizeLedgerPoints(amountRaw, decimals),
      signature: row?.tx_signature ? String(row.tx_signature) : null,
      createdAt: row?.created_at ? String(row.created_at) : new Date().toISOString(),
    }
  })

  return {
    decimals,
    balanceRaw,
    balance: normalizedBalance,
    ledger,
    swaps,
    fetchedAt: new Date().toISOString(),
  }
}

async function loadRewardSnapshotViaSupabase(addressCanonical: string, decimals: number): Promise<RewardSnapshot> {
  const supabase = supaAdmin()

  type BalanceRow = { balance_raw?: number | string | null; balance?: number | string | null }
  type LedgerRow = { id?: number | string; reason?: string; delta?: number | string; balance_after?: number | string | null; created_at?: string }
  type SwapRow = { id?: number | string; direction?: string; status?: string; amount_points?: number | string; tx_signature?: string | null; created_at?: string }

  const [
    balanceRes,
    ledgerRes,
    swapsRes,
  ] = await Promise.all([
    supabase
      .from('reward_balances')
      .select('balance_raw,balance')
      .eq('address', addressCanonical)
      .maybeSingle(),
    supabase
      .from('reward_ledger')
      .select('id,reason,delta,balance_after,created_at')
      .eq('address', addressCanonical)
      .order('id', { ascending: false })
      .limit(20),
    supabase
      .from('treasury_swaps')
      .select('id,direction,status,amount_points,tx_signature,created_at')
      .eq('address', addressCanonical)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const handleError = (label: string, error: PostgrestError | null) => {
    if (!error) return
    throw new Error(`[reward_snapshot] ${label} query failed: ${error.message}`)
  }

  handleError('balance', balanceRes.error)
  handleError('ledger', ledgerRes.error)
  handleError('swaps', swapsRes.error)

  const balanceRow: BalanceRow = balanceRes.data ?? {}
  const balanceRaw =
    balanceRow.balance_raw != null
      ? parseNumeric(balanceRow.balance_raw)
      : parseNumeric(balanceRow.balance)
  const normalizedBalance = normalizeLedgerPoints(balanceRaw, decimals)

  const ledgerData = Array.isArray(ledgerRes.data) ? (ledgerRes.data as LedgerRow[]) : []
  const ledger: RewardSnapshotLedgerEntry[] = ledgerData.map((row) => {
    const deltaRaw = parseNumeric(row?.delta)
    const balanceAfterRaw = row?.balance_after != null ? parseNumeric(row.balance_after) : null
    return {
      id: Number(row?.id || 0),
      reason: String(row?.reason || 'unknown'),
      deltaRaw,
      delta: normalizeLedgerPoints(deltaRaw, decimals),
      balanceAfterRaw,
      balanceAfter: balanceAfterRaw != null ? normalizeLedgerPoints(balanceAfterRaw, decimals) : null,
      createdAt: row?.created_at ? String(row.created_at) : new Date().toISOString(),
    }
  })

  const swapsData = Array.isArray(swapsRes.data) ? (swapsRes.data as SwapRow[]) : []
  const swaps: RewardSnapshotSwapEntry[] = swapsData.map((row) => {
    const amountRaw = parseNumeric(row?.amount_points)
    return {
      id: Number(row?.id || 0),
      direction: String(row?.direction || 'deposit'),
      status: String(row?.status || 'pending'),
      amountRaw,
      amount: normalizeLedgerPoints(amountRaw, decimals),
      signature: row?.tx_signature ? String(row.tx_signature) : null,
      createdAt: row?.created_at ? String(row.created_at) : new Date().toISOString(),
    }
  })

  return {
    decimals,
    balanceRaw,
    balance: normalizedBalance,
    ledger,
    swaps,
    fetchedAt: new Date().toISOString(),
  }
}

export async function getRewardSnapshot(
  address: string | null | undefined,
  options: RewardSnapshotOptions = {}
): Promise<RewardSnapshot> {
  const decimals = LEDGER_DECIMALS
  const normalizedAddress = normalizeAddress(address || '')
  if (!normalizedAddress) {
    return { ...EMPTY_REWARD_SNAPSHOT, decimals, fetchedAt: new Date().toISOString() }
  }

  const exec = async (client: PoolClient) => loadRewardSnapshot(client, normalizedAddress, decimals)

  if (options.client) {
    return exec(options.client)
  }

  return loadRewardSnapshotViaSupabase(normalizedAddress, decimals)
}
