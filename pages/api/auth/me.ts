import type { NextApiRequest, NextApiResponse } from 'next'
import { economyConfig } from '@/src/config/economy'
import { getSessionDiagnosticsFromRequest } from '@/src/server/auth'
import { getCachedGateBalance, refreshGateBalance } from '@/src/server/chains/gateCache'
import type { GateCacheSnapshot } from '@/src/server/chains/gateCache'
import { hasSupabaseJwtSecret, signSupabaseJwt } from '@/src/server/supabaseAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const { session: sess, reason } = getSessionDiagnosticsFromRequest(req)
    if (!sess || !sess.address) {
      const failureReason = reason || 'invalid_session'
      if (failureReason !== 'missing_cookie') {
        console.warn('[auth/me] session missing or invalid', failureReason)
      }
      return res.status(401).json({ ok: false, reason: failureReason })
    }
    const minTokens = economyConfig.gate.minTokens
    let tokenBalance: number | null = null
    let tokenDecimals: number | null = null
    let cacheSnapshot: GateCacheSnapshot | null = null
    let holderStatus = !!sess.isHolder
    try {
      cacheSnapshot = await getCachedGateBalance(sess.address)
      if (!cacheSnapshot) {
        // cache miss; falls back to refresh
      }
    } catch (err) {
      console.warn('[auth/me] gate cache lookup failed', err)
    }
    let snapshot = cacheSnapshot ?? null
    if (!snapshot || snapshot.stale) {
      try {
        const refreshed = await refreshGateBalance(sess.address)
        if (refreshed) snapshot = refreshed
      } catch (err) {
        console.warn('[auth/me] gate cache refresh failed', err)
      }
    }
    if (snapshot) {
      tokenBalance = snapshot.tokenBalance
      tokenDecimals = snapshot.decimals
      holderStatus = snapshot.isHolder
    }
    const sessionExpiresAt = Number.isFinite(sess.exp) ? new Date(sess.exp * 1000).toISOString() : null
    if (!hasSupabaseJwtSecret()) {
      console.error('[auth/me] SUPABASE_JWT_SECRET is missing; cannot issue Supabase token')
      return res.status(500).json({ ok: false, reason: 'missing_supabase_jwt_secret' })
    }
    const supabaseJwt = signSupabaseJwt(sess.address, { isHolder: holderStatus }) || null
    if (!supabaseJwt) {
      return res.status(500).json({ ok: false, reason: 'supabase_jwt_unavailable' })
    }
    return res.status(200).json({
      ok: true,
      address: sess.address,
      isHolder: holderStatus,
      minTokens,
      tokenBalance,
      tokenDecimals,
      sessionExpiresAt,
      supabaseAccessToken: supabaseJwt?.token || null,
      supabaseTokenExpiresAt: supabaseJwt?.expiresAt || null,
    })
  } catch (e: any) {
    console.error('[auth/me] failed', e)
    return res.status(500).json({ error: e?.message || 'me failed' })
  }
}
