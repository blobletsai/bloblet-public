import { gameplayConfig } from '@/src/config/gameplay'

const ONE_MINUTE_MS = 60 * 1000
const DEFAULT_FAST_FORWARD_BURSTS_PER_DAY = 2
const DEFAULT_FAST_FORWARD_BURST_SIZE = 3

function parseIsoDateMs(value: string | null | undefined): number {
  if (!value) return NaN
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : NaN
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function fastForwardDayKey(date: Date = new Date()): string {
  return toUtcDayKey(date)
}

function normalizeBurstCount(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return 0
  return Math.max(0, Math.floor(num))
}

export type ChargeState = {
  lastChargedAt: string | null
  cooldownEndsAt: string | null
  boostersActiveUntil: string | null
  // Luck accumulator for Energize Drop Law (0..1).
  dropAcc?: number | null
  fastForwardDebtUntil?: string | null
  fastForwardBurstDay?: string | null
  fastForwardBurstsUsed?: number | null
  fastForwardLastRunAt?: string | null
}

export type CareAction = 'charge'
export const CARE_ACTIONS: CareAction[] = ['charge']

export function getFastForwardConfig() {
  const cfg = gameplayConfig.care?.fastForward || {}
  const burstsPerDay = Number.isFinite((cfg as any).burstsPerDay)
    ? Math.max(0, Math.floor(Number((cfg as any).burstsPerDay)))
    : DEFAULT_FAST_FORWARD_BURSTS_PER_DAY
  const burstSize = Number.isFinite((cfg as any).burstSize)
    ? Math.max(1, Math.floor(Number((cfg as any).burstSize)))
    : DEFAULT_FAST_FORWARD_BURST_SIZE
  return {
    enabled: (cfg as any).enabled === true,
    burstsPerDay,
    burstSize,
  }
}

export function resolveFastForwardCounters(state: ChargeState, now: Date, burstsPerDay: number) {
  const dayKey = toUtcDayKey(now)
  const burstDayRaw = typeof (state as any).fastForwardBurstDay === 'string' ? (state as any).fastForwardBurstDay : null
  const dayMatch = burstDayRaw === dayKey
  const burstsUsed = dayMatch ? normalizeBurstCount((state as any).fastForwardBurstsUsed) : 0
  const burstsRemaining = Math.max(0, burstsPerDay - burstsUsed)
  const burstDay = dayMatch ? burstDayRaw : dayKey
  return { burstsUsed, burstsRemaining, burstDay }
}

function effectiveCooldownUntil(state: ChargeState): number {
  const cooldownUntil = parseIsoDateMs(state.cooldownEndsAt)
  const debtUntil = parseIsoDateMs((state as any).fastForwardDebtUntil)
  if (Number.isFinite(cooldownUntil) && Number.isFinite(debtUntil)) return Math.max(cooldownUntil, debtUntil)
  if (Number.isFinite(cooldownUntil)) return cooldownUntil
  if (Number.isFinite(debtUntil)) return debtUntil
  return NaN
}

export type ChargeStatus = {
  state: 'ready' | 'cooldown' | 'covered'
  boosterLevel: number
  boostersActiveUntil: string | null
  cooldownEndsAt: string | null
  lastChargedAt: string | null
  overdue: boolean
  dropAcc: number
  fastForwardEligible: boolean
  fastForwardBurstsUsed: number
  fastForwardBurstsRemaining: number
  fastForwardDebtUntil: string | null
  fastForwardLastRunAt: string | null
  fastForwardIsNewcomer: boolean
}

export function emptyChargeState(): ChargeState {
  return {
    lastChargedAt: null,
    cooldownEndsAt: null,
    boostersActiveUntil: null,
    dropAcc: 0,
    fastForwardDebtUntil: null,
    fastForwardBurstDay: null,
    fastForwardBurstsUsed: 0,
    fastForwardLastRunAt: null,
  }
}

export function parseChargeState(raw: any): ChargeState {
  if (!raw) return emptyChargeState()
  if (typeof raw === 'string') {
    try {
      return parseChargeState(JSON.parse(raw))
    } catch {
      return emptyChargeState()
    }
  }
  if (typeof raw !== 'object') return emptyChargeState()
  const get = (key: string) => {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value !== 'string') return null
    return value.length ? value : null
  }
  return {
    lastChargedAt: get('lastChargedAt'),
    cooldownEndsAt: get('cooldownEndsAt'),
    boostersActiveUntil: get('boostersActiveUntil'),
    dropAcc: typeof (raw as any).dropAcc === 'number' ? Math.max(0, Math.min(0.999999, Number((raw as any).dropAcc))) : 0,
    fastForwardDebtUntil: get('fastForwardDebtUntil'),
    fastForwardBurstDay: get('fastForwardBurstDay'),
    fastForwardBurstsUsed: normalizeBurstCount((raw as any).fastForwardBurstsUsed),
    fastForwardLastRunAt: get('fastForwardLastRunAt'),
  }
}

export function chargeCooldownMs(): number {
  const raw = gameplayConfig.care.cooldownMs
  if (Number.isFinite(raw) && raw > 0) return raw
  const mins = gameplayConfig.care.cooldownMin
  return Math.max(1, mins) * ONE_MINUTE_MS
}

export function boosterWindowMs(): number {
  const raw = gameplayConfig.care.boosterWindowMs
  if (Number.isFinite(raw) && raw > 0) return raw
  const mins = gameplayConfig.care.boosterWindowMin
  return Math.max(1, mins) * ONE_MINUTE_MS
}

export function boosterCap(): number {
  const cap = gameplayConfig.care.boosterMax
  if (!Number.isFinite(cap)) return 3
  return Math.max(0, Math.min(6, Math.floor(cap)))
}

export function careUpkeepDelayMs(): number {
  const raw = gameplayConfig.care.upkeepDelayMs
  if (Number.isFinite(raw) && raw >= 0) return raw
  return 0
}

export function chargeCostPoints(): number {
  const raw = gameplayConfig.care.chargeCostPoints
  if (Number.isFinite(raw) && raw > 0) return raw
  return 5
}

export function buildChargeStatus(
  state: ChargeState,
  now = new Date(),
  options: { fastForward?: { enabled?: boolean; burstsPerDay?: number; isNewcomer?: boolean } } = {},
): ChargeStatus {
  const nowMs = now.getTime()
  const boosterUntil = parseIsoDateMs(state.boostersActiveUntil)
  const cooldownUntil = effectiveCooldownUntil(state)
  const boosterActive = Number.isFinite(boosterUntil) && boosterUntil > nowMs
  const cooldownActive = Number.isFinite(cooldownUntil) && cooldownUntil > nowMs

  let lvl = boosterActive ? boosterCap() : 0
  if (!boosterActive && cooldownActive) lvl = 0

  let status: ChargeStatus['state'] = 'ready'
  if (boosterActive) status = 'covered'
  else if (cooldownActive) status = 'cooldown'

  let overdue = false
  if (Number.isFinite(cooldownUntil)) {
    const grace = careUpkeepDelayMs()
    if (cooldownUntil < nowMs - grace) {
      overdue = true
    }
  }

  const ffCfg = getFastForwardConfig()
  const burstsPerDay = Number.isFinite(options.fastForward?.burstsPerDay)
    ? Math.max(0, Math.floor(Number(options.fastForward?.burstsPerDay)))
    : ffCfg.burstsPerDay
  const isNewcomer = options.fastForward?.isNewcomer === true
  const ffEnabled = options.fastForward?.enabled ?? ffCfg.enabled
  const counters = resolveFastForwardCounters(state, now, burstsPerDay)
  const debtUntil = parseIsoDateMs((state as any).fastForwardDebtUntil)
  const debtActive = Number.isFinite(debtUntil) && debtUntil > nowMs
  const burstsRemaining = ffEnabled && isNewcomer ? counters.burstsRemaining : 0
  const cooldownIso = Number.isFinite(cooldownUntil) ? new Date(cooldownUntil).toISOString() : state.cooldownEndsAt
  const debtIso = Number.isFinite(debtUntil) ? new Date(debtUntil).toISOString() : (state as any).fastForwardDebtUntil ?? null
  const fastForwardEligible = Boolean(ffEnabled && isNewcomer && burstsRemaining > 0 && !debtActive)

  return {
    state: status,
    boosterLevel: lvl,
    boostersActiveUntil: state.boostersActiveUntil,
    cooldownEndsAt: cooldownIso,
    lastChargedAt: state.lastChargedAt,
    overdue,
    dropAcc: typeof state.dropAcc === 'number' ? Math.max(0, Math.min(1, Number(state.dropAcc))) : 0,
    fastForwardEligible,
    fastForwardBurstsUsed: counters.burstsUsed,
    fastForwardBurstsRemaining: burstsRemaining,
    fastForwardDebtUntil: debtIso,
    fastForwardLastRunAt: (state as any).fastForwardLastRunAt ?? null,
    fastForwardIsNewcomer: isNewcomer,
  }
}

export function computeNextChargeState(now: Date, prevState?: ChargeState): ChargeState {
  const base = prevState ?? emptyChargeState()
  const nowIso = now.toISOString()
  const cooldownEndsAt = new Date(now.getTime() + chargeCooldownMs()).toISOString()
  const boostersActiveUntil = new Date(now.getTime() + boosterWindowMs()).toISOString()
  const debtMs = parseIsoDateMs((base as any).fastForwardDebtUntil)
  const debtActive = Number.isFinite(debtMs) && debtMs > now.getTime()
  return {
    ...base,
    lastChargedAt: nowIso,
    cooldownEndsAt,
    boostersActiveUntil,
    dropAcc: 0,
    fastForwardDebtUntil: debtActive ? new Date(debtMs).toISOString() : null,
    fastForwardBurstDay: (base as any).fastForwardBurstDay ?? null,
    fastForwardBurstsUsed: normalizeBurstCount((base as any).fastForwardBurstsUsed),
    fastForwardLastRunAt: (base as any).fastForwardLastRunAt ?? null,
  }
}

export function isChargeReady(state: ChargeState, now = new Date()): boolean {
  const cooldownUntil = effectiveCooldownUntil(state)
  if (!Number.isFinite(cooldownUntil)) return true
  return cooldownUntil <= now.getTime()
}

export function boosterLevel(state: ChargeState, now = new Date()): number {
  const status = buildChargeStatus(state, now)
  return status.boosterLevel
}
