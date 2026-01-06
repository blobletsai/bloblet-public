/**
 * Event / telemetry configuration
 * Centralizes thresholds that drive ingestion pipelines.
 */

interface BuyThresholdConfig {
  minAbs: number
  minPct: number
  topN: number
}

export interface EventsConfig {
  buyThresholds: BuyThresholdConfig
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

export const eventsConfig: EventsConfig = {
  buyThresholds: {
    minAbs: readNumber('BUY_MIN_ABS', 0),
    minPct: readNumber('BUY_MIN_PERCENT', 0),
    topN: Math.max(0, Math.trunc(readNumber('TOP_N_FOR_CHANGES', 5))),
  },
}
