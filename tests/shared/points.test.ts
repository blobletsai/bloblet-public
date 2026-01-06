import { describe, expect, it } from 'vitest'

import {
  formatDeltaPoints,
  formatPoints,
  normalizeLedgerPoints,
  rewardPointsToTokenAmountRaw,
  tokenAmountToLedgerPoints,
} from '@/src/shared/points'

describe('shared points helpers', () => {
  it('keeps raw values intact when formatting', () => {
    expect(formatPoints(200)).toBe('200')
    expect(formatPoints(5)).toBe('5.00')
    expect(formatDeltaPoints(150)).toBe('+150')
    expect(formatDeltaPoints(-25)).toBe('-25.0')
  })

  it('normalizes ledger values without scaling', () => {
    expect(normalizeLedgerPoints(123)).toBe(123)
    expect(normalizeLedgerPoints('450')).toBe(450)
  })

  it('converts between Reward Points and token lamports using raw values', () => {
    const lamports = rewardPointsToTokenAmountRaw(200, 6)
    expect(lamports).toBe(200_000_000n)
    expect(tokenAmountToLedgerPoints(lamports, 6)).toBe(200)
  })
})

