import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { rateLimitConfig } from '@/src/config/rateLimit'

const redis = Redis.fromEnv()

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfig.slidingWindow.max, rateLimitConfig.slidingWindow.window as any),
})
