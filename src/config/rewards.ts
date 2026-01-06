import { solanaConfig } from './solana'

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBoolean(key: string, fallback = false): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === null) return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function readString(key: string): string {
  return (process.env[key] || '').trim()
}

function clampNonNegative(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

function clampMin(value: number, minimum: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(minimum, value)
}

function clampBps(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  if (value < 0) return 0
  if (value > 10_000) return 10_000
  return Math.floor(value)
}

const ledgerEnabled = readBoolean('REWARD_LEDGER_ENABLED', false)
const ledgerTreasuryOverride = readString('REWARD_TREASURY_ADDRESS')

const minPoints = clampMin(readNumber('REDEEM_MIN_POINTS', 10), 0, 10)
const floorPoints = clampNonNegative(readNumber('INPLAY_FLOOR_POINTS', 0))
const cooldownMinutes = clampNonNegative(readNumber('REDEEM_COOLDOWN_MIN', 60), 60)
const dailyCapBps = clampBps(readNumber('REDEEM_DAILY_CAP_BPS', 2000), 2000)
const winLockMinutes = clampNonNegative(readNumber('REDEEM_WIN_LOCK_MIN', 60), 60)

export const rewardsConfig = {
  ledger: {
    enabled: ledgerEnabled,
    treasuryAddress: ledgerTreasuryOverride,
    solanaTreasuryAddress: solanaConfig.treasury.publicKey?.trim() || '',
  },
  redeem: {
    minPoints,
    inPlayFloorPoints: floorPoints,
    cooldownMinutes,
    dailyCapBps,
    winLockMinutes,
  },
}

export type RewardsConfig = typeof rewardsConfig
