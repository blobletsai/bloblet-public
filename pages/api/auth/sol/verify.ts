import type { NextApiRequest, NextApiResponse } from 'next'
import { getCookies, resolveSessionCookieDomain, setSessionCookie, signJwt } from '@/src/server/auth'
import { getChainAdapter } from '@/src/server/chains'
import { meetsGateRequirement, gateUnits } from '@/src/server/chains/gate'
import { refreshGateBalance } from '@/src/server/chains/gateCache'
import { getSolanaAddressContext } from '@/src/shared/address/solana'
import { rewardLedgerDecimals, tokenAmountToLedgerPoints } from '@/src/shared/points'
import { hasSupabaseJwtSecret, signSupabaseJwt } from '@/src/server/supabaseAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    const chain = getChainAdapter('sol')
    const body = req.body || {}
    const addressInput = String(body.address || '').trim()
    const signature = String(body.signature || '').trim()
    const clientMessage = String(body.message || '')
    if (!addressInput || !signature || !clientMessage) return res.status(400).json({ error: 'bad payload' })

    const addressCtx = (() => {
      try { return getSolanaAddressContext(addressInput) } catch { return null }
    })()
    if (!addressCtx) return res.status(400).json({ error: 'invalid address' })

    const cookies = getCookies(req)
    const nonce = cookies['blob_nonce']
    if (!nonce) return res.status(400).json({ error: 'nonce missing' })

    const msg = clientMessage.replace(/\r\n/g, '\n')
    const nonceMatch = msg.match(/Nonce:\s*([A-Za-z0-9]+)/i)
    if (!nonceMatch || nonceMatch[1] !== nonce) return res.status(400).json({ error: 'nonce mismatch' })

    // Address line must match
    if (!msg.includes(addressCtx.canonical)) return res.status(400).json({ error: 'address mismatch' })

    const ok = await chain.verifySignature({ address: addressCtx.canonical, message: msg, signature })
    if (!ok) return res.status(401).json({ error: 'signature verification failed' })

    let balRaw = 0n
    let decimals = chain.metadata.tokenDecimals
    try {
      const balance = await chain.fetchGateBalance(addressCtx.canonical)
      balRaw = balance.raw
      if (Number.isFinite(balance.decimals)) decimals = Math.max(0, Math.floor(balance.decimals))
    } catch (err) {
      console.error('[sol-verify] balance lookup failed', err)
      return res.status(503).json({ error: 'balance_unavailable' })
    }
    const { isHolder } = meetsGateRequirement(balRaw, decimals)

    let refreshedSnapshot = null
    try {
      refreshedSnapshot = await refreshGateBalance(addressCtx.canonical, {
        balance: { raw: balRaw, decimals },
      })
      if (refreshedSnapshot) {
        // cache now mirrors latest verification payload
      }
    } catch (err) {
      console.warn('[sol-verify] gate cache refresh failed', err)
    }

    const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : undefined
    const cookieDomain = resolveSessionCookieDomain(hostHeader)
    const jwt = signJwt({ address: addressCtx.canonical, isHolder, ttlSec: 60 * 60 * 24 * 7 })
    setSessionCookie(res, jwt, { domain: cookieDomain })
    // Return token balance info for UI clarity (no secrets, purely public chain data)
    const minTokens = gateUnits()
    let tokenDecimals = decimals
    let tokenBalance = tokenAmountToLedgerPoints(balRaw, tokenDecimals, rewardLedgerDecimals())
    if (refreshedSnapshot) {
      tokenBalance = refreshedSnapshot.tokenBalance
      tokenDecimals = refreshedSnapshot.decimals
    }
    if (!hasSupabaseJwtSecret()) {
      console.error('[sol-verify] SUPABASE_JWT_SECRET is missing; cannot issue Supabase token')
      return res.status(500).json({ error: 'missing_supabase_jwt_secret' })
    }
    const supabaseJwt = signSupabaseJwt(addressCtx.canonical, { isHolder })
    if (!supabaseJwt) {
      return res.status(500).json({ error: 'supabase_jwt_unavailable' })
    }
    res.status(200).json({
      ok: true,
      address: addressCtx.canonical,
      isHolder,
      minTokens,
      tokenBalance,
      tokenDecimals,
      supabaseAccessToken: supabaseJwt?.token || null,
      supabaseTokenExpiresAt: supabaseJwt?.expiresAt || null,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'verify failed' })
  }
}
