import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { CareError } from '@/src/server/gameplay/careErrors'
import { chargeCare } from '@/src/server/gameplay/careService'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const session = getSessionFromRequest(req)
    if (!session || !session.address) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const body = req.body || {}
    const rawOrderId = body.orderId ?? body.orderID ?? body.order_id
    const orderId =
      rawOrderId == null ? undefined : Number(rawOrderId)
    if (orderId !== undefined && (!Number.isFinite(orderId) || orderId <= 0)) {
      return res.status(400).json({ error: 'invalid_order_id' })
    }

    const result = await chargeCare(session.address, { orderId })
    return res.status(200).json({ ok: true, result })
  } catch (err: unknown) {
    if (err instanceof CareError) {
      return res.status(err.status).json({ error: err.message, details: err.details || null })
    }
    console.error('[care/charge] failed', err)
    return res.status(500).json({ error: 'care_charge_failed' })
  }
}
