import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { holdersConfig } from '@/src/config/holders'
import { rewardsConfig } from '@/src/config/rewards'
import { solanaConfig } from '@/src/config/solana'

const TREASURY = '4R7w7MmVPXsXeZhBz8RibSECdGFg4NbRCYzyJ8zg51Hi'
const EXTRA = '5ercAfJdewdJGXrvytKBSeH9mPG84FaymZmkpS5edGj4'

const originalBlacklist = [...holdersConfig.special.blacklist]
const originalRewardTreasury = holdersConfig.special.rewardTreasuryAddress
const originalSolTreasury = solanaConfig.treasury.publicKey
const originalLedgerTreasury = rewardsConfig.ledger.treasuryAddress

describe('special holder blacklist', () => {
  beforeEach(() => {
    holdersConfig.special.blacklist = []
    holdersConfig.special.rewardTreasuryAddress = ''
    rewardsConfig.ledger.treasuryAddress = ''
    solanaConfig.treasury.publicKey = ''
  })

  afterEach(() => {
    holdersConfig.special.blacklist = [...originalBlacklist]
    holdersConfig.special.rewardTreasuryAddress = originalRewardTreasury
    rewardsConfig.ledger.treasuryAddress = originalLedgerTreasury
    solanaConfig.treasury.publicKey = originalSolTreasury
  })

  it('collects treasury + custom blacklist entries', async () => {
    solanaConfig.treasury.publicKey = TREASURY
    holdersConfig.special.blacklist = [EXTRA, 'G6nHp3NF44UxS79n4AB5Xv6WSVsnS9BQjz7zuYjpwYjv']
    const mod = await import('@/src/server/holders/specialAddresses')
    mod.__resetSpecialHolderCache()
    const { isSpecialHolder } = mod
    expect(isSpecialHolder(TREASURY, 'sol')).toBe(true)
    expect(isSpecialHolder(EXTRA, 'sol')).toBe(true)
  })

  it('filters buildTokenRowsFromSnapshot entries', async () => {
    solanaConfig.treasury.publicKey = TREASURY
    holdersConfig.special.blacklist = [EXTRA]
    const mod = await import('@/src/server/holders/specialAddresses')
    mod.__resetSpecialHolderCache()
    const { buildTokenRowsFromSnapshot } = await import('@/src/server/holders/supabase')
    const rows = buildTokenRowsFromSnapshot(
      [
        { address: TREASURY, balanceRaw: 1000n },
        { address: EXTRA, balanceRaw: 500n },
        { address: 'Ay7EyQmmk9bJvXzhjk9GpgykgiC2d1Nnh97sSZFxjy64', balanceRaw: 250n },
      ],
      { chainKind: 'sol', thresholdRaw: 0n, nowIso: '2025-11-17T00:00:00Z' },
    )
    const addresses = rows.map((row) => row.address)
    const { tryNormalizeChainAddress } = await import('@/src/server/address')
    const canonicalTreasury = tryNormalizeChainAddress(TREASURY, 'sol')
    const canonicalExtra = tryNormalizeChainAddress(EXTRA, 'sol')
    const canonicalOther = tryNormalizeChainAddress('Ay7EyQmmk9bJvXzhjk9GpgykgiC2d1Nnh97sSZFxjy64', 'sol')
    expect(canonicalTreasury).toBeTruthy()
    expect(canonicalExtra).toBeTruthy()
    expect(canonicalOther).toBeTruthy()
    expect(addresses).not.toContain(canonicalTreasury!)
    expect(addresses).not.toContain(canonicalExtra!)
    expect(addresses).toContain(canonicalOther!)
  })
})
