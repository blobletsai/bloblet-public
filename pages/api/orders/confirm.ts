import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'
import { rateLimiter } from '@/src/server/rateLimit'
import { getSessionFromRequest } from '@/src/server/auth'
import { getChainAdapter, resolveChainKind } from '@/src/server/chains'
import { confirmOrder } from '@/src/server/orders/confirmation'
import { appConfig } from '@/src/config/app'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed')

  const secret = appConfig.secrets.cron
  const internal =
    !!secret &&
    (((req.headers['x-internal-auth'] as string) === secret) ||
      ((req.headers['x-internal-secret'] as string) === secret))

  const session = internal ? null : getSessionFromRequest(req)
  if (!internal && (!session || !session.address)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const ip = (req.headers['x-forwarded-for'] as string) || 'orders'
  const { success } = await rateLimiter.limit(`orders:confirm:${ip}`)
  if (!success) return res.status(429).json({ error: 'rate limited' })

  const body = req.body || {}
  const orderId = Number(body.orderId)
  const txHash = String(body.signature || body.txHash || '').trim()
  if (!orderId || !txHash) return res.status(400).json({ error: 'bad payload' })

  const chainKind = resolveChainKind()
  const chain = getChainAdapter(chainKind)
  const supa = supaAdmin()
  const sessionAddressKey = session?.address ? String(session.address).trim() : null

  const result = await confirmOrder({
    supa,
    chainKind,
    chain,
    orderId,
    txHash,
    internal,
    sessionAddressKey,
  })

  return res.status(result.statusCode).json(result.body)
}
