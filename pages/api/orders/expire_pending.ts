import type { NextApiRequest, NextApiResponse } from 'next'

import { supaAdmin } from '@/src/server/supa'
import { resolveChainKind } from '@/src/server/chains'
import { appConfig } from '@/src/config/app'
import { ordersConfig } from '@/src/config/orders'

function isCronRequest(req: NextApiRequest) {
  if (req.headers['x-vercel-cron']) return true
  const host = String(req.headers.host || '').toLowerCase()
  if (!host) return false
  const allowed = ordersConfig.cron.allowedHosts
  return allowed.includes(host)
}

function isAuthorized(req: NextApiRequest) {
  const secret = appConfig.secrets.cron
  if (!secret) return true
  if (isCronRequest(req)) return true
  const header =
    (req.headers['x-internal-auth'] as string) ||
    (req.headers['x-internal-secret'] as string) ||
    ''
  return header === secret
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const isCron = isCronRequest(req)
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST')
      return res.status(405).end('Method not allowed')
    }
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    if (req.method === 'GET' && !isCron) {
      res.setHeader('Allow', 'POST')
      return res.status(405).end('Method not allowed')
    }
    const supa = supaAdmin()
    const chainKind = resolveChainKind()
    const nowIso = new Date().toISOString()
    const batchSize = ordersConfig.cron.expireBatchSize

    const { data: rows, error: fetchErr } = await supa
      .from('orders')
      .select('id')
      .eq('status', 'pending')
      .eq('chain_kind', chainKind)
      .lt('expires_at', nowIso)
      .order('expires_at', { ascending: true })
      .limit(batchSize)

    if (fetchErr) throw fetchErr

    const ids = (rows || [])
      .map((row: any) => Number(row?.id || 0))
      .filter((id) => Number.isFinite(id) && id > 0)

    if (!ids.length) {
      return res.status(200).json({ expired: 0 })
    }

    const { data: expiredRows, error: updateErr } = await supa
      .from('orders')
      .update({ status: 'expired', reason: 'expired_by_cron' })
      .in('id', ids)
      .select('id')

    if (updateErr) throw updateErr

    const expiredCount = Array.isArray(expiredRows) ? expiredRows.length : ids.length
    console.log('[orders.expire_pending] expired pending orders', {
      count: expiredCount,
      chainKind,
    })
    return res.status(200).json({ expired: expiredCount })
  } catch (err: any) {
    console.error('[orders.expire_pending] failed', err)
    return res.status(500).json({ error: err?.message || 'expire pending failed' })
  }
}
