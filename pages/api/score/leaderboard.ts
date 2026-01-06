import type { NextApiRequest, NextApiResponse } from 'next'

import { getScoreLeaderboard } from '@/src/server/gameplay/scoreService'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const limitParam = req.query.limit
    const limit =
      typeof limitParam === 'string'
        ? Number(limitParam)
        : Array.isArray(limitParam)
          ? Number(limitParam[0])
          : undefined
    const entries = await getScoreLeaderboard(Number.isFinite(limit) ? Number(limit) : 20)
    return res.status(200).json({ ok: true, leaderboard: entries })
  } catch (err) {
    console.error('[score/leaderboard] failed', err)
    return res.status(500).json({ error: 'leaderboard_fetch_failed' })
  }
}
