import type { SupabaseClient } from '@supabase/supabase-js'

import { chainConfig } from '@/src/config/chains'
import { getChainAdapter } from '@/src/server/chains'
import { meetsGateRequirement } from '@/src/server/chains/gate'
import { supaAdmin } from '@/src/server/supa'
import { getSolanaAddressContext } from '@/src/shared/address/solana'
import { rewardLedgerDecimals, tokenAmountToLedgerPoints } from '@/src/shared/points'

const SUPPORTED_CHAIN = 'sol'

type SupabaseLike = Pick<SupabaseClient, 'from'>

type NumericString = string | number | bigint | null | undefined

export type GateCacheSnapshot = {
  address: string
  balanceRaw: bigint
  decimals: number
  tokenBalance: number
  updatedAt: string | null
  isHolder: boolean
  stale: boolean
}

type CacheOptions = {
  client?: SupabaseLike
}

type RefreshOptions = CacheOptions & {
  balance?: { raw: bigint; decimals?: number | null }
}

function parseBigIntValue(value: NumericString): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0n
    return BigInt(Math.trunc(value))
  }
  const trimmed = String(value || '').trim()
  if (!trimmed) return 0n
  try {
    return BigInt(trimmed)
  } catch {
    return 0n
  }
}

function normalizeDecimals(decimals: number | null | undefined, fallback: number): number {
  if (Number.isFinite(decimals) && (decimals as number) >= 0) {
    return Math.max(0, Math.floor(Number(decimals)))
  }
  return fallback
}

function resolveCanonical(address: string): string | null {
  const trimmed = String(address || '').trim()
  if (!trimmed) return null
  try {
    return getSolanaAddressContext(trimmed).canonical
  } catch {
    return null
  }
}

function supabaseClient(options?: CacheOptions): SupabaseLike {
  if (options?.client) return options.client
  return supaAdmin()
}

function buildSnapshot(
  canonical: string,
  balanceRaw: bigint,
  decimals: number,
  updatedAt: string | null,
): GateCacheSnapshot {
  const ledgerDecimals = rewardLedgerDecimals()
  const tokenBalance = tokenAmountToLedgerPoints(balanceRaw, decimals, ledgerDecimals)
  const { isHolder } = meetsGateRequirement(balanceRaw, decimals)
  const ttlMs = chainConfig.gate.cacheTtlMs
  const updatedTime = updatedAt ? Date.parse(updatedAt) : NaN
  const stale = !Number.isFinite(updatedTime) || ttlMs <= 0 ? true : Date.now() - updatedTime > ttlMs
  return {
    address: canonical,
    balanceRaw,
    decimals,
    tokenBalance,
    updatedAt,
    isHolder,
    stale,
  }
}

export async function getCachedGateBalance(
  address: string,
  options?: CacheOptions,
): Promise<GateCacheSnapshot | null> {
  const canonical = resolveCanonical(address)
  if (!canonical) return null
  const supa = supabaseClient(options)
  const { data, error } = await supa
    .from('token_holders')
    .select('balance,updated_at')
    .eq('address_canonical', canonical)
    .eq('chain_kind', SUPPORTED_CHAIN)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const chain = getChainAdapter(SUPPORTED_CHAIN)
  const decimals = normalizeDecimals(chain.metadata.tokenDecimals, chain.metadata.tokenDecimals)
  const updatedAt = data.updated_at ? new Date(data.updated_at).toISOString() : null
  const balanceRaw = parseBigIntValue(data.balance)
  return buildSnapshot(canonical, balanceRaw, decimals, updatedAt)
}

export async function refreshGateBalance(address: string, options?: RefreshOptions): Promise<GateCacheSnapshot | null> {
  const canonical = resolveCanonical(address)
  if (!canonical) return null
  const chain = getChainAdapter(SUPPORTED_CHAIN)
  const supa = supabaseClient(options)
  let raw = options?.balance?.raw
  let decimals = options?.balance?.decimals
  if (typeof raw !== 'bigint') {
    const balance = await chain.fetchGateBalance(canonical)
    raw = balance.raw
    decimals = balance.decimals
  }
  const normalizedDecimals = normalizeDecimals(decimals, chain.metadata.tokenDecimals)
  const balanceRaw = parseBigIntValue(raw)
  const snapshot = buildSnapshot(canonical, balanceRaw, normalizedDecimals, new Date().toISOString())
  const nowIso = snapshot.updatedAt!
  const tokenPayload = {
    address: canonical,
    address_canonical: canonical,
    address_cased: canonical,
    chain_kind: SUPPORTED_CHAIN,
    balance: balanceRaw.toString(),
    updated_at: nowIso,
  }
  const blobletPayload = {
    address: canonical,
    address_canonical: canonical,
    address_cased: canonical,
    chain_kind: SUPPORTED_CHAIN,
    is_alive: snapshot.isHolder,
    tier: 'bottom',
    last_seen_at: nowIso,
  }
  const tokenResult = await supa.from('token_holders').upsert(tokenPayload as any, {
    onConflict: 'address_canonical,chain_kind',
  })
  if (tokenResult.error) throw tokenResult.error
  const blobResult = await supa.from('bloblets').upsert(blobletPayload as any, {
    onConflict: 'address_canonical,chain_kind',
  })
  if (blobResult.error) throw blobResult.error
  return { ...snapshot, stale: false }
}
