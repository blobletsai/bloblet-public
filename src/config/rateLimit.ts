function readNumber(key: string, fallback: number): number {
  const raw = Number(process.env[key])
  if (!Number.isFinite(raw)) return fallback
  return Math.max(1, Math.floor(raw))
}

function readWindow(key: string, fallback: string): string {
  const value = (process.env[key] || '').trim()
  return value || fallback
}

export const rateLimitConfig = {
  slidingWindow: {
    max: readNumber('UPSTASH_RATE_LIMIT_MAX', 5),
    window: readWindow('UPSTASH_RATE_LIMIT_WINDOW', '1 m'),
  },
}

export type RateLimitConfig = typeof rateLimitConfig
