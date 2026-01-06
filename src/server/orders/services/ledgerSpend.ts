import type { PoolClient } from 'pg'
import { withPgClient } from '@/src/server/pg'
import {
  REWARD_LEDGER_ENABLED,
  applyLedgerEntries,
  fetchRewardBalances,
  roundPoints,
  type RewardLedgerReason,
} from '@/src/server/rewards'

export class RewardLedgerDisabledError extends Error {
  constructor(message = 'Reward ledger is disabled') {
    super(message)
    this.name = 'RewardLedgerDisabledError'
  }
}

export class InsufficientRewardPointsError extends Error {
  constructor(message = 'Insufficient BlobCoin') {
    super(message)
    this.name = 'InsufficientRewardPointsError'
  }
}

export type LedgerDebitMetadata = Record<string, any> | null | undefined

export type LedgerDebitParams = {
  client: PoolClient
  addressCanonical: string
  addressCased: string
  amountRp: number
  reason: RewardLedgerReason
  metadata?: LedgerDebitMetadata
  now?: Date
}

export type LedgerDebitResult = {
  balanceBefore: number
  balanceAfter: number
}

export type LedgerCreditParams = {
  client: PoolClient
  addressCanonical: string
  addressCased: string
  amountRp: number
  reason: RewardLedgerReason
  metadata?: LedgerDebitMetadata
  now?: Date
}

const EPSILON = 1e-6

function normalizeAddress(address: string): string {
  return String(address || '').trim()
}

export async function ensureRewardLedgerEnabled() {
  if (!REWARD_LEDGER_ENABLED) {
    throw new RewardLedgerDisabledError()
  }
}

export async function withLedgerTransaction<T>(
  fn: (client: PoolClient, now: Date) => Promise<T>,
): Promise<T> {
  await ensureRewardLedgerEnabled()
  return withPgClient(async (client) => {
    await client.query('BEGIN')
    const now = new Date()
    try {
      const value = await fn(client, now)
      await client.query('COMMIT')
      return value
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  })
}

export async function getLockedRewardBalance(
  client: PoolClient,
  addressCanonical: string,
): Promise<number> {
  await ensureRewardLedgerEnabled()
  const normalized = normalizeAddress(addressCanonical)
  const balances = await fetchRewardBalances(client, [normalized], { lockRows: true })
  const snapshot = balances.get(normalized)
  return roundPoints(snapshot?.currentBalance ?? 0)
}

export async function getRewardBalanceSnapshot(addressCanonical: string): Promise<number> {
  await ensureRewardLedgerEnabled()
  const normalized = normalizeAddress(addressCanonical)
  return withPgClient(async (client) => {
    const balances = await fetchRewardBalances(client, [normalized], { lockRows: false })
    const snapshot = balances.get(normalized)
    return roundPoints(snapshot?.currentBalance ?? 0)
  })
}

export async function debitRewardPoints(params: LedgerDebitParams): Promise<LedgerDebitResult> {
  if (params.amountRp <= 0 || !Number.isFinite(params.amountRp)) {
    throw new Error('Invalid debit amount')
  }

  const normalized = normalizeAddress(params.addressCanonical)
  const now = params.now ?? new Date()
  const currentBalance = await getLockedRewardBalance(params.client, normalized)
  const desired = roundPoints(params.amountRp)

  if (currentBalance + EPSILON < desired) {
    throw new InsufficientRewardPointsError()
  }

  const entries = [
    {
      address: params.addressCased || params.addressCanonical,
      delta: -desired,
      reason: params.reason,
      metadata: params.metadata || null,
    },
  ] as const

  const ledgerMap = await applyLedgerEntries(
    params.client,
    entries.map((entry) => ({
      address: entry.address,
      delta: entry.delta,
      reason: entry.reason,
      metadata: entry.metadata ?? undefined,
    })),
    { now, updateTokenHolders: true },
  )

  const balanceAfter = roundPoints(ledgerMap.get(normalized) ?? currentBalance - desired)
  return {
    balanceBefore: currentBalance,
    balanceAfter,
  }
}

export async function creditRewardPoints(params: LedgerCreditParams): Promise<LedgerDebitResult> {
  if (params.amountRp <= 0 || !Number.isFinite(params.amountRp)) {
    throw new Error('Invalid credit amount')
  }
  const normalized = normalizeAddress(params.addressCanonical)
  const now = params.now ?? new Date()
  const currentBalance = await getLockedRewardBalance(params.client, normalized)
  const creditAmount = roundPoints(params.amountRp)

  const ledgerMap = await applyLedgerEntries(
    params.client,
    [
      {
        address: params.addressCased || params.addressCanonical,
        delta: creditAmount,
        reason: params.reason,
        metadata: params.metadata ?? undefined,
      },
    ],
    { now, updateTokenHolders: true },
  )

  const balanceAfter = roundPoints(ledgerMap.get(normalized) ?? currentBalance + creditAmount)
  return {
    balanceBefore: currentBalance,
    balanceAfter,
  }
}
