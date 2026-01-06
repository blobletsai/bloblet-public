"use server"

import { tryNormalizeChainAddress } from '@/src/server/address'
import { resolveChainKind } from '@/src/server/chains'
import { holdersConfig } from '@/src/config/holders'
import { rewardsConfig } from '@/src/config/rewards'
import { solanaConfig } from '@/src/config/solana'
import { ledgerTreasuryAddress } from '@/src/server/rewards'

const DEFAULT_CHAIN = resolveChainKind()
type ChainKey = string

const cache = new Map<ChainKey, Set<string>>()

function normalizeChainKey(value?: string | null): ChainKey {
  return String(value || DEFAULT_CHAIN || 'sol').trim().toLowerCase()
}

function canonicalize(address: string | null | undefined, chainKind: ChainKey): string {
  return tryNormalizeChainAddress(address, chainKind) || ''
}

function gatherRawAddresses(): string[] {
  const list = new Set<string>()
  const rewardTreasury =
    holdersConfig.special.rewardTreasuryAddress ||
    rewardsConfig.ledger.treasuryAddress ||
    ''
  if (rewardTreasury) list.add(rewardTreasury)
  const solTreasury = (solanaConfig.treasury.publicKey || '').trim()
  if (solTreasury) list.add(solTreasury)
  const ledgerAddress = ledgerTreasuryAddress()
  if (ledgerAddress) list.add(ledgerAddress)
  for (const entry of holdersConfig.special.blacklist) {
    list.add(entry)
  }
  return Array.from(list)
}

export function getSpecialHolderSet(chainKind?: string | null): ReadonlySet<string> {
  const key = normalizeChainKey(chainKind)
  const fromCache = cache.get(key)
  if (fromCache) {
    return fromCache
  }
  const result = new Set<string>()
  for (const raw of gatherRawAddresses()) {
    const canonical = canonicalize(raw, key)
    const trimmed = String(raw || '').trim()
    if (canonical) {
      result.add(canonical)
    }
    if (trimmed) {
      result.add(trimmed)
    }
  }
  cache.set(key, result)
  return result
}

export function isSpecialHolder(address: string | null | undefined, chainKind?: string | null): boolean {
  const key = normalizeChainKey(chainKind)
  const canonical = canonicalize(address, key)
  const trimmed = String(address || '').trim()
  const special = getSpecialHolderSet(key)
  if (canonical && special.has(canonical)) return true
  if (trimmed && special.has(trimmed)) return true
  return false
}

export function __resetSpecialHolderCache() {
  cache.clear()
}
