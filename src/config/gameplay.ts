/**
 * Gameplay Configuration
 * Centralizes World dimensions, PVP mechanics, and Care settings.
 */

const DEFAULT_CARE_DROP_PROBABILITY = 0.2

function valNum(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function valNumFirst(keys: string[], fallback: number): number {
  for (const key of keys) {
    const raw = process.env[key]
    if (raw === undefined || raw === null || raw === '') continue
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function valStr(v: string | undefined, fallback: string): string {
  return (v || fallback).trim()
}

function valBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback
  const normalized = String(v).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function readNumericEnv(key: string): number | null {
  const raw = process.env[key]
  if (raw === undefined || raw === null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function clampInt(value: number, fallback: number, min = 0, max = 1_000_000): number {
  if (!Number.isFinite(value)) return fallback
  const normalized = Math.floor(value)
  if (normalized < min) return min
  if (normalized > max) return max
  return normalized
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CARE_DROP_PROBABILITY
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function readCareDropProbability(): number {
  const fromBps = readNumericEnv('CARE_DROP_CHANCE_BPS')
  if (fromBps != null) return clampProbability(fromBps / 10_000)
  const rawChance = readNumericEnv('CARE_DROP_CHANCE')
  if (rawChance != null) return clampProbability(rawChance)
  const fallbackChance = readNumericEnv('CARE_DROP_PROB')
  if (fallbackChance != null) return clampProbability(fallbackChance)
  const base = readNumericEnv('CARE_DROP_BASE')
  if (base != null) return clampProbability(base)
  return DEFAULT_CARE_DROP_PROBABILITY
}

export const gameplayConfig = {
  world: {
    width: valNum(process.env.NEXT_PUBLIC_WORLD_W, 9000),
    height: valNum(process.env.NEXT_PUBLIC_WORLD_H, 5600),
    keepOutWidth: valNum(process.env.NEXT_PUBLIC_KEEP_OUT_W, 2200),
    keepOutHeight: valNum(process.env.NEXT_PUBLIC_KEEP_OUT_H, 1350),
    seed: valStr(process.env.NEXT_PUBLIC_WORLD_SEED, 'blob:world:default'),
    spritePx: valNum(process.env.NEXT_PUBLIC_SPRITE_PX_WORLD, 48),
    maxZoom: valNum(process.env.NEXT_PUBLIC_CANVAS_MAX_ZOOM || process.env.CANVAS_MAX_ZOOM, 12),
  },
  pvp: {
    pairCooldownMin: valNum(process.env.PVP_PAIR_COOLDOWN_MIN || process.env.PAIR_COOLDOWN_MIN, 60),
    luckVariance: valNum(process.env.PVP_LUCK_VARIANCE, 0.2),
    tieBand: valNum(process.env.PVP_TIE_BAND, 0.2),
    criticalChance: valNum(process.env.PVP_CRITICAL_CHANCE, 0.05),
    defenderGlobalCooldownMin: valNum(process.env.PVP_DEFENDER_GLOBAL_COOLDOWN_MIN, 0),
    pairFreqLimit1h: valNum(process.env.PVP_PAIR_FREQ_LIMIT_1H, 0),
    pairHouseSurchargeBps: valNum(process.env.PVP_PAIR_HOUSE_SURCHARGE_BPS, 0),
  },
  care: {
    cooldownMs: valNum(process.env.CARE_COOLDOWN_MS || process.env.CHARGE_COOLDOWN_MS, 0),
    cooldownMin: valNum(process.env.CARE_COOLDOWN_MIN || process.env.CHARGE_COOLDOWN_MIN, 60),
    boosterWindowMs: valNum(process.env.CARE_BOOSTER_WINDOW_MS || process.env.BOOSTER_WINDOW_MS, 0),
    boosterWindowMin: valNum(process.env.CARE_BOOSTER_WINDOW_MIN || process.env.BOOSTER_WINDOW_MIN, 60),
    boosterMax: valNum(process.env.CARE_BOOSTER_MAX || process.env.BOOSTER_MAX, 3),
    upkeepDelayMs: valNum(process.env.CARE_UPKEEP_DELAY_MS, 0),
    upkeepPoints: Math.max(0, valNumFirst(['CARE_UPKEEP_POINTS', 'CARE_UPKEEP_BONUS'], 1)),
    chargeCostPoints: valNum(process.env.CARE_CHARGE_COST_POINTS || process.env.CARE_PRICE_BLOBLET || process.env.CARE_PRICE_POINTS, 0),
    drop: {
      baseProbability: readCareDropProbability(),
      accumulatorEnabled: valBool(process.env.CARE_DROP_ACCUM_ENABLED, true),
      shieldFirstBias: valBool(process.env.CARE_DROP_BIAS_SHIELD_FIRST, true),
    },
    fastForward: {
      enabled: valBool(
        process.env.CARE_FAST_FORWARD_ENABLED
          || process.env.FAST_FORWARD_ENABLED
          || process.env.NEXT_PUBLIC_CARE_FAST_FORWARD_ENABLED,
        false,
      ),
      burstSize: clampInt(
        valNumFirst(['CARE_FAST_FORWARD_BURST_SIZE', 'FAST_FORWARD_BURST_SIZE'], 3),
        3,
        1,
        10,
      ),
      burstsPerDay: clampInt(
        valNumFirst(['CARE_FAST_FORWARD_BURSTS_PER_DAY', 'FAST_FORWARD_BURSTS_PER_DAY'], 2),
        2,
        0,
        10,
      ),
    },
  },
}
