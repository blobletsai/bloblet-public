import { describe, expect, it, beforeEach, afterEach } from 'vitest'

import { gameplayConfig } from '@/src/config/gameplay'
import { getCareDropConfig, invalidateCareDropConfigCache } from '@/src/server/gameplay/careConfig'

const originalDropConfig = { ...gameplayConfig.care.drop }

function setDropOverrides(overrides: Partial<typeof gameplayConfig.care.drop>) {
  Object.assign(gameplayConfig.care.drop, overrides)
}

describe('careConfig', () => {
  beforeEach(() => {
    Object.assign(gameplayConfig.care.drop, originalDropConfig)
    invalidateCareDropConfigCache()
  })

  afterEach(() => {
    Object.assign(gameplayConfig.care.drop, originalDropConfig)
    invalidateCareDropConfigCache()
  })

  it('defaults to 0.2 when config values are missing', () => {
    setDropOverrides({ baseProbability: NaN as unknown as number })
    invalidateCareDropConfigCache()
    const cfg = getCareDropConfig()
    expect(cfg.baseProbability).toBeCloseTo(0.2)
  })

  it('uses configured base probability when provided', () => {
    setDropOverrides({ baseProbability: 0.35 })
    invalidateCareDropConfigCache()
    const cfg = getCareDropConfig()
    expect(cfg.baseProbability).toBeCloseTo(0.35)
  })

  it('clamps values greater than 1 down to 1', () => {
    setDropOverrides({ baseProbability: 5 as unknown as number })
    invalidateCareDropConfigCache()
    const cfg = getCareDropConfig()
    expect(cfg.baseProbability).toBe(1)
  })

  it('clamps negative values up to 0', () => {
    setDropOverrides({ baseProbability: -2 as unknown as number })
    invalidateCareDropConfigCache()
    const cfg = getCareDropConfig()
    expect(cfg.baseProbability).toBe(0)
  })

  it('honors accumulator/bias flags', () => {
    setDropOverrides({ accumulatorEnabled: false, shieldFirstBias: false })
    invalidateCareDropConfigCache()
    const cfg = getCareDropConfig()
    expect(cfg.accumulatorEnabled).toBe(false)
    expect(cfg.shieldFirstBias).toBe(false)
    expect(cfg.law).toBe('memoryless')
  })
})
