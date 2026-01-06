import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { getScoreForAddress } from '@/src/server/gameplay/scoreService'

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

    const snapshot = await getScoreForAddress(session.address)
    return res.status(200).json({ ok: true, score: snapshot })
  } catch (err) {
    console.error('[score/my] failed', err)
    return res.status(500).json({ error: 'score_fetch_failed' })
  }
}
