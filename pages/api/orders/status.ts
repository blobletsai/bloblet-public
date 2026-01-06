import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'
import { getSessionFromRequest } from '@/src/server/auth'
import { rateLimiter } from '@/src/server/rateLimit'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'
import { appConfig } from '@/src/config/app'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Session required + rate limit
    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ error: 'unauthorized' })
    const ip = (req.headers['x-forwarded-for'] as string) || 'orders'
    const { success } = await rateLimiter.limit(`orders:status:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })

    const idRaw = req.query.id
    const supa = supaAdmin()
    const chainKind = resolveChainKind()
    let addressCanonical: string
    try {
      addressCanonical = normalizeChainAddress(sess.address, chainKind)
    } catch {
      return res.status(400).json({ error: 'invalid_address' })
    }

    const TERMINAL_STATUSES = new Set(['applied', 'expired', 'rejected'])

    const toResponse = (row: any) => ({
      id: row.id,
      status: row.status,
      reason: row.reason || null,
      signature: row.tx_hash || null,
      preview_alive_url: row.preview_alive_url || null,
      type: row.type || null,
      quote_amount: row.quote_amount || null,
      created_at: row.created_at || null,
      expires_at: row.expires_at || null,
      retry_count: row.retry_count ?? 0,
      last_error: row.last_error || null,
      alive_ready_at: row.alive_ready_at || null,
    })

    if (!idRaw) {
      const { data } = await supa
        .from('orders')
        .select(
          'id,address_canonical,status,reason,tx_hash,preview_alive_url,type,quote_amount,created_at,expires_at,retry_count,last_error,alive_ready_at',
        )
        .eq('chain_kind', chainKind)
        .eq('address_canonical', addressCanonical)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return res.status(404).json({ error: 'no_active_order' })
      const statusLower = String((data as any).status || '').toLowerCase()
      if (TERMINAL_STATUSES.has(statusLower)) return res.status(404).json({ error: 'no_active_order' })
      return res.status(200).json(toResponse(data))
    }

    const id = Number(idRaw)
    if (!id) return res.status(400).json({ error: 'bad id' })
    const { data } = await supa
      .from('orders')
      .select(
        'id,address,address_canonical,status,reason,tx_hash,preview_alive_url,type,quote_amount,created_at,expires_at,retry_count,last_error,alive_ready_at',
      )
      .eq('chain_kind', chainKind)
      .eq('id', id)
      .maybeSingle()
    if (!data) return res.status(404).json({ error: 'not found' })
    const owner = String((data as any).address_canonical || (data as any).address || '').trim()
    if (owner !== addressCanonical) return res.status(403).json({ error: 'forbidden' })

    // If still pending but we have a tx_hash, attempt an internal confirm to progress state
    try {
      if (String((data as any).status) === 'pending' && (data as any).tx_hash) {
        const secret = appConfig.secrets.internalApi
        const internalBase = appConfig.urls.internalApiBase
        if (secret && internalBase) {
          const base = internalBase.endsWith('/') ? internalBase.slice(0, -1) : internalBase
          await fetch(`${base}/api/orders/confirm`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-internal-auth': secret } as any,
            body: JSON.stringify({ orderId: id, signature: (data as any).tx_hash })
          }).catch(() => {})
          // Re-read after confirm attempt
          const { data: refreshed } = await supa
            .from('orders')
            .select('id,address,address_canonical,status,reason,tx_hash,preview_alive_url')
            .eq('id', id)
            .maybeSingle()
          if (refreshed) {
            const owner2 = String((refreshed as any).address_canonical || (refreshed as any).address || '').trim()
            if (owner2 !== addressCanonical) return res.status(403).json({ error: 'forbidden' })
            return res.status(200).json(toResponse(refreshed))
          }
        }
      }
    } catch {}
    return res.status(200).json(toResponse(data))
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'status failed' })
  }
}
