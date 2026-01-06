/**
 * Orders / marketplace configuration
 * Centralizes worker tuning, cron limits, and intent expirations.
 */

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === null) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function readBoolean(key: string, fallback = false): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === null) return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function readCsv(key: string, fallback: string[]): string[] {
  const raw = process.env[key]
  if (!raw) return fallback
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

const DEFAULT_ALLOWED_HOSTS = ['bloblet.vercel.app', 'bloblets.ai']

export const ordersConfig = {
  worker: {
    maxRetries: Math.max(1, Math.floor(readNumber('AVATAR_WORKER_MAX_RETRIES', 3))),
    retryDelayMs: Math.max(5_000, readNumber('AVATAR_WORKER_RETRY_DELAY_MS', 15_000)),
    propTtlSec: Math.max(60, readNumber('ORDER_PROP_TTL_SEC', 3600)),
  },
  intent: {
    orderExpirationMinutes: Math.max(1, readNumber('ORDER_EXP_MINUTES', 10)),
    avatarAutoFinalizeMinutes: Math.max(1, readNumber('AVATAR_AUTO_FINALIZE_MINUTES', 10)),
  },
  cron: {
    allowedHosts: readCsv('CRON_ALLOWED_HOSTS', DEFAULT_ALLOWED_HOSTS),
    expireBatchSize: Math.max(1, Math.floor(readNumber('ORDER_EXPIRE_BATCH', 500))),
  },
  flags: {
    allowTestConfirmations: readBoolean('ALLOW_TEST_CONFIRMATIONS', false),
    requireHolder: readBoolean('GATE_REQUIRE_HOLDER', false),
  },
}
