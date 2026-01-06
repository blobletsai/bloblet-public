import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { getPlayerStatus } from '@/src/server/gameplay/playerStatusService'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const session = getSessionFromRequest(req)
    if (!session || !session.address) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const status = await getPlayerStatus(session.address, { readOnly: true })
    return res.status(200).json({ ok: true, status })
  } catch (err) {
    console.error('[player/status] failed', err)
    return res.status(500).json({ error: 'player_status_failed' })
  }
}
