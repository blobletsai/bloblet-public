import { appConfig } from '@/src/config/app'
import { gameplayConfig } from '@/src/config/gameplay'

const DEFAULT_BASE_PROBABILITY = 0.2

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BASE_PROBABILITY
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function resolveBaseProbability(): number {
  const configured = Number(gameplayConfig.care?.drop?.baseProbability)
  if (Number.isFinite(configured)) {
    return clampProbability(configured)
  }
  return DEFAULT_BASE_PROBABILITY
}

export type CareDropConfig = {
  baseProbability: number
  accumulatorEnabled: boolean
  shieldFirstBias: boolean
  law: 'deterministic_accumulator' | 'memoryless'
  guaranteeWithin: number | null
}

let cachedConfig: CareDropConfig | null = null
let cachedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000
const BYPASS_CACHE = appConfig.env === 'test'

export function getCareDropConfig(): CareDropConfig {
  const now = Date.now()
  if (!BYPASS_CACHE && cachedConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedConfig
  }

  const dropConfig = gameplayConfig.care?.drop || {}
  const baseProbability = resolveBaseProbability()
  const accumulatorEnabled = dropConfig.accumulatorEnabled !== false
  const shieldFirstBias = dropConfig.shieldFirstBias !== false
  const law: CareDropConfig['law'] = accumulatorEnabled ? 'deterministic_accumulator' : 'memoryless'
  const guaranteeWithin =
    accumulatorEnabled && baseProbability > 0 ? Math.ceil(1 / baseProbability) : null

  const config: CareDropConfig = { baseProbability, accumulatorEnabled, shieldFirstBias, law, guaranteeWithin }

  if (!BYPASS_CACHE) {
    cachedConfig = config
    cachedAt = now
  }

  return config
}

export function invalidateCareDropConfigCache() {
  cachedConfig = null
  cachedAt = 0
}
