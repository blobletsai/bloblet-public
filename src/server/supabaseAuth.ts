import crypto from 'node:crypto'

type JwtHeader = { alg: 'HS256'; typ: 'JWT' }

type SupabaseJwtClaims = {
  sub: string
  address: string
  wallet: string
  role: 'authenticated'
  aud: 'authenticated'
  isHolder?: boolean
  iat: number
  exp: number
}

export type SupabaseJwt = {
  token: string
  expiresAt: string
}

export function hasSupabaseJwtSecret(): boolean {
  return Boolean((process.env.SUPABASE_JWT_SECRET || '').trim())
}

function getSupabaseJwtSecret(): string | null {
  const secret = (process.env.SUPABASE_JWT_SECRET || '').trim()
  return secret.length ? secret : null
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input))
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function hmac(data: string, secret: string): string {
  return b64url(crypto.createHmac('sha256', secret).update(data).digest())
}

export function signSupabaseJwt(address: string, options: { ttlSec?: number; isHolder?: boolean } = {}): SupabaseJwt | null {
  const secret = getSupabaseJwtSecret()
  if (!secret) return null
  const canonical = (address || '').trim()
  if (!canonical) return null

  const now = Math.floor(Date.now() / 1000)
  const ttl = Math.max(60, Math.min(60 * 60 * 24, Number(options.ttlSec || 60 * 60)))
  const payload: SupabaseJwtClaims = {
    sub: canonical,
    address: canonical,
    wallet: canonical,
    role: 'authenticated',
    aud: 'authenticated',
    isHolder: options.isHolder ?? undefined,
    iat: now,
    exp: now + ttl,
  }
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' }
  const enc = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = hmac(enc, secret)
  return {
    token: `${enc}.${sig}`,
    expiresAt: new Date((now + ttl) * 1000).toISOString(),
  }
}
