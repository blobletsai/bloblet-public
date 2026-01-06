import { describe, expect, it } from 'vitest'
import { computeRanksPercents } from '../src/server/simulator'

describe('computeRanksPercents', () => {
  it('sorts holders by balance and annotates rank/percent', () => {
    const holders = [
      { address: 'a', balanceRaw: 5n },
      { address: 'b', balanceRaw: 15n },
      { address: 'c', balanceRaw: 10n }
    ]

    const result = computeRanksPercents(holders)

    expect(result.map(r => r.address)).toEqual(['b', 'c', 'a'])
    expect(result[0]).toMatchObject({ rank: 1 })
    expect(result[1]).toMatchObject({ rank: 2 })
    expect(result[2]).toMatchObject({ rank: 3 })
    const totalPct = result.reduce((sum, r) => sum + r.percent, 0)
    expect(totalPct).toBeGreaterThan(99.9)
    expect(totalPct).toBeLessThanOrEqual(100)
  })
})
