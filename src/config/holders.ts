import { appConfig } from '@/src/config/app'

function readString(key: string): string {
  return (process.env[key] || '').trim()
}

function readBoolean(key: string, fallback = false): boolean {
  const raw = readString(key).toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  return fallback
}

type NumberOptions = {
  min?: number
  max?: number
}

function readNumber(key: string, fallback: number, options: NumberOptions = {}): number {
  const raw = Number(process.env[key])
  let value = Number.isFinite(raw) ? raw : fallback
  if (options.min !== undefined) value = Math.max(options.min, value)
  if (options.max !== undefined) value = Math.min(options.max, value)
  return value
}

function readOptionalNumber(key: string): number | null {
  const raw = Number(process.env[key])
  return Number.isFinite(raw) ? raw : null
}

function readList(key: string): string[] {
  const raw = readString(key)
  if (!raw) return []
  return raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export const holdersConfig = {
  enableVercelRefresh: readBoolean('ENABLE_VERCEL_HOLDERS_REFRESH'),
  cronSecret: appConfig.secrets.cron,
  sim: {
    enabled: readBoolean('SIM_MODE'),
    churnRateOverride: readOptionalNumber('SIM_CHURN_RATE'),
    bigBuyDeltaPct: readNumber('SIM_BIGBUY_DELTA_PCT', 0.1, { min: 0.05 }),
    birthOnly: readBoolean('SIM_BIRTH_ONLY'),
  },
  production: {
    birthThreshold: readNumber('PROD_BURST_BIRTHS', 30, { min: 5 }),
    deathThreshold: readNumber('PROD_BURST_DEATHS', 30, { min: 5 }),
    bigBuyDeltaPct: readNumber('PROD_BIGBUY_DELTA_PCT', 0.1, { min: 0.05 }),
  },
  visualTestMode: readString('VISUAL_TEST_MODE').toLowerCase(),
  special: {
    blacklist: readList('SPECIAL_HOLDER_BLACKLIST'),
    rewardTreasuryAddress: readString('REWARD_TREASURY_ADDRESS'),
  },
}

export type HoldersConfig = typeof holdersConfig
