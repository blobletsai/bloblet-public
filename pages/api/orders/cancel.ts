import type { NextApiRequest, NextApiResponse } from 'next'

import { supaAdmin } from '@/src/server/supa'
import { getSessionFromRequest } from '@/src/server/auth'
import { rateLimiter } from '@/src/server/rateLimit'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'

const TERMINAL_STATUSES = new Set(['applied', 'expired', 'rejected'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')

    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ error: 'unauthorized' })

    const ip = (req.headers['x-forwarded-for'] as string) || 'orders'
    const { success } = await rateLimiter.limit(`orders:cancel:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })

    const body = req.body || {}
    const orderId = Number(body.orderId)
    if (!orderId || !Number.isFinite(orderId)) return res.status(400).json({ error: 'invalid order' })

    const supa = supaAdmin()
    const chainKind = resolveChainKind()
    let addressCanonical: string
    try {
      addressCanonical = normalizeChainAddress(sess.address, chainKind)
    } catch {
      return res.status(400).json({ error: 'invalid_address' })
    }

    const { data: order } = await supa
      .from('orders')
      .select('id,address_canonical,status,reason,tx_hash')
      .eq('chain_kind', chainKind)
      .eq('id', orderId)
      .maybeSingle()

    if (!order) return res.status(404).json({ error: 'not found' })
    if (String(order.address_canonical || '') !== addressCanonical) return res.status(403).json({ error: 'forbidden' })

    const statusLower = String(order.status || '').toLowerCase()
    if (TERMINAL_STATUSES.has(statusLower)) {
      return res.status(400).json({ error: 'order already finalized' })
    }

    const cancelledReason = 'cancelled_by_user'
    const { error } = await supa
      .from('orders')
      .update({ status: 'expired', reason: cancelledReason })
      .eq('chain_kind', chainKind)
      .eq('id', orderId)

    if (error) {
      console.error('[orders.cancel] failed to cancel order', { orderId, error: error.message })
      return res.status(500).json({ error: 'cancel failed' })
    }

    return res.status(200).json({ ok: true, status: 'expired', reason: cancelledReason })
  } catch (err: any) {
    console.error('[orders.cancel] unexpected', err)
    return res.status(500).json({ error: err?.message || 'cancel failed' })
  }
}
