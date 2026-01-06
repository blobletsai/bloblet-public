import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { getPlayerStatus } from '@/src/server/gameplay/playerStatusService'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ ok: false })

    const status = await getPlayerStatus(sess.address, { readOnly: true })
    return res.status(200).json({
      ok: true,
      care: status.care,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'care/me failed' })
  }
}
