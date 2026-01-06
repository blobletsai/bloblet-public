import crypto from 'node:crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '../config/app'

type JwtPayload = { address: string; isHolder?: boolean; iat: number; exp: number }

const COOKIE_NAME = 'blob_session'
const DEFAULT_SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input))
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function hmac(data: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(data).digest()
}

export type VerifyJwtFailureReason = 'secret_missing' | 'malformed' | 'invalid_signature' | 'expired'

export type VerifyJwtDetailedResult = {
  payload: JwtPayload | null
  reason?: VerifyJwtFailureReason
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'> & { ttlSec?: number }) {
  const secret = appConfig.secrets.session
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters long')
  }
  const now = Math.floor(Date.now() / 1000)
  const ttl = Math.max(60, Math.min(DEFAULT_SESSION_MAX_AGE, Number(payload.ttlSec || DEFAULT_SESSION_MAX_AGE)))
  // Preserve address casing (Solana addresses are case-sensitive). Downstream callers can lowercase for comparisons when needed.
  const body: JwtPayload = { address: payload.address, isHolder: payload.isHolder, iat: now, exp: now + ttl }
  const header = { alg: 'HS256', typ: 'JWT' }
  const enc = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`
  const sig = b64url(hmac(enc, secret))
  return `${enc}.${sig}`
}

export function verifyJwtDetailed(token: string): VerifyJwtDetailedResult {
  try {
    const secret = appConfig.secrets.session
    if (!secret || secret.length < 32) return { payload: null, reason: 'secret_missing' }
    const parts = token.split('.')
    if (parts.length !== 3) return { payload: null, reason: 'malformed' }
    const h = parts[0] as string
    const p = parts[1] as string
    const s = parts[2] as string
    const sig = b64url(hmac(`${h}.${p}`, secret))
    if (sig !== s) return { payload: null, reason: 'invalid_signature' }
    const payload = JSON.parse(Buffer.from(p, 'base64').toString()) as JwtPayload
    if (!payload || typeof payload.exp !== 'number') return { payload: null, reason: 'malformed' }
    if (Math.floor(Date.now() / 1000) > payload.exp) return { payload: null, reason: 'expired' }
    return { payload }
  } catch {
    return { payload: null, reason: 'malformed' }
  }
}

export function verifyJwt(token: string): JwtPayload | null {
  const { payload } = verifyJwtDetailed(token)
  return payload
}

export type SessionFailureReason = 'missing_cookie' | VerifyJwtFailureReason

export type SessionDiagnostics = {
  session: JwtPayload | null
  reason?: SessionFailureReason
}

export function getSessionDiagnosticsFromRequest(req: Request | NextApiRequest): SessionDiagnostics {
  const cookies = getCookies(req)
  const tok = cookies[COOKIE_NAME]
  if (!tok) return { session: null, reason: 'missing_cookie' }
  const { payload, reason } = verifyJwtDetailed(tok)
  if (!payload) return { session: null, reason }
  return { session: payload }
}

export function getSessionFromRequest(req: Request | NextApiRequest): JwtPayload | null {
  return getSessionDiagnosticsFromRequest(req).session
}

type SessionCookieOptions = {
  domain?: string | null
  maxAgeSec?: number
}

function normalizeCookieDomain(domain?: string | null) {
  if (!domain) return null
  const trimmed = domain.trim().toLowerCase()
  if (!trimmed) return null
  const withoutPort = trimmed.replace(/:\d+$/, '')
  if (!withoutPort || withoutPort === 'localhost') return null
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(withoutPort)) return null
  return withoutPort
}

export function resolveSessionCookieDomain(host?: string | null) {
  const envDomain = normalizeCookieDomain(appConfig.auth.cookieDomain)
  const normalizedHost = normalizeCookieDomain(host)
  // If an explicit cookie domain is configured, honor it to keep cookies scoped consistently
  // across hosts (e.g., custom domains, previews). Fallback to host-scoped when unset.
  if (envDomain) return envDomain
  return normalizedHost
}

export function setSessionCookie(res: NextApiResponse, jwt: string, options: SessionCookieOptions = {}) {
  const prod = appConfig.isProduction
  const maxAge = Number.isFinite(options.maxAgeSec) ? Math.max(60, Math.floor(Number(options.maxAgeSec))) : DEFAULT_SESSION_MAX_AGE
  const cookie = [
    `${COOKIE_NAME}=${jwt}`,
    'Path=/',
    options.domain ? `Domain=${options.domain}` : '',
    'HttpOnly',
    'SameSite=Lax',
    prod ? 'Secure' : '',
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join('; ')
  res.setHeader('Set-Cookie', cookie)
}

export function clearSessionCookie(res: NextApiResponse, options: SessionCookieOptions = {}) {
  const prod = appConfig.isProduction
  const cookie = [
    `${COOKIE_NAME}=; Path=/`,
    options.domain ? `Domain=${options.domain}` : '',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    prod ? 'Secure' : '',
  ].filter(Boolean).join('; ')
  res.setHeader('Set-Cookie', cookie)
}

export function getCookies(req: Request | NextApiRequest): Record<string, string> {
  let raw = ''
  // Fetch API Request
  if (typeof (req as any)?.headers?.get === 'function') {
    raw = ((req as any).headers.get('cookie') as string) || ''
  } else if ((req as any)?.headers) {
    // NextApiRequest
    const hdrs = (req as NextApiRequest).headers as any
    raw = (hdrs?.cookie as string) || ''
  }
  const out: Record<string, string> = {}
  if (!raw) return out
  raw.split(';').forEach((p: string) => {
    const i = p.indexOf('=')
    if (i === -1) return
    const k = p.slice(0, i).trim()
    const v = decodeURIComponent(p.slice(i + 1).trim())
    if (k) out[k] = v
  })
  return out
}

export function randomNonce(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex')
}
