import { beforeAll, describe, expect, it } from 'vitest'

type ScoreServiceModule = typeof import('@/src/server/gameplay/scoreService')

let scoreTier: ScoreServiceModule['scoreTier']
let maskAddress: ScoreServiceModule['maskAddress']

beforeAll(async () => {
  const scoreModule = await import('@/src/server/gameplay/scoreService')
  scoreTier = scoreModule.scoreTier
  maskAddress = scoreModule.maskAddress
})

describe('scoreTier', () => {
  it('correctly bins tiers', () => {
    expect(scoreTier(0)).toBe('rookie')
    expect(scoreTier(49.99)).toBe('rookie')
    expect(scoreTier(50)).toBe('adventurer')
    expect(scoreTier(249.99)).toBe('adventurer')
    expect(scoreTier(250)).toBe('champion')
    expect(scoreTier(999.99)).toBe('champion')
    expect(scoreTier(1000)).toBe('legend')
  })
})

describe('mask helper', () => {
  it('masks addresses consistently', () => {
    expect(maskAddress('0x1234567890abcdef')).toBe('0x12…cdef')
  })
})
