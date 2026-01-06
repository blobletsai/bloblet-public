import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import {
  signJwt,
  verifyJwtDetailed,
  getSessionDiagnosticsFromRequest,
  resolveSessionCookieDomain,
} from '@/src/server/auth'
import { appConfig } from '@/src/config/app'

const SECRET = 'this_is_a_demo_session_secret_value_12345'

describe('auth helpers', () => {
  const originalSecret = appConfig.secrets.session
  const originalCookieDomain = appConfig.auth.cookieDomain

  beforeEach(() => {
    appConfig.secrets.session = SECRET
  })

  afterEach(() => {
    appConfig.secrets.session = originalSecret
    appConfig.auth.cookieDomain = originalCookieDomain
    vi.useRealTimers()
  })

  it('verifies signed tokens and returns payload', () => {
    const token = signJwt({ address: 'SolAddr111', isHolder: true, ttlSec: 120 })
    const result = verifyJwtDetailed(token)
    expect(result.payload).not.toBeNull()
    expect(result.payload?.address).toBe('SolAddr111')
    expect(result.reason).toBeUndefined()
  })

  it('reports expired tokens', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    const token = signJwt({ address: 'SolAddr222', isHolder: false, ttlSec: 30 })
    vi.setSystemTime(new Date('2024-01-01T00:05:00Z'))
    const result = verifyJwtDetailed(token)
    expect(result.payload).toBeNull()
    expect(result.reason).toBe('expired')
  })

  it('indicates missing cookies when diagnostics run without session', () => {
    const req = { headers: {} } as any
    const { session, reason } = getSessionDiagnosticsFromRequest(req)
    expect(session).toBeNull()
    expect(reason).toBe('missing_cookie')
  })

  it('resolves cookie domain from env or host', () => {
    appConfig.auth.cookieDomain = ''
    expect(resolveSessionCookieDomain('bloblets.ai:3000')).toBe('bloblets.ai')
    expect(resolveSessionCookieDomain('localhost:3000')).toBeNull()
    appConfig.auth.cookieDomain = '.custom.dev'
    expect(resolveSessionCookieDomain('ignored.com')).toBe('.custom.dev')
  })
})
