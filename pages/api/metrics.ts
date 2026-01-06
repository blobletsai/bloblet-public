import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supa = supaAdmin()
    // Last scene
    const { data: last } = await supa
      .from('events')
      .select('id,type,payload,created_at')
      .eq('type', 'scene_trigger')
      .order('created_at', { ascending: false })
      .limit(1)

    // Counts by kind (last 24h)
    const sinceISO = new Date(Date.now() - 24*60*60*1000).toISOString()
    const { data: rows } = await supa
      .from('events')
      .select('payload,created_at')
      .eq('type', 'scene_trigger')
      .gte('created_at', sinceISO)
      .limit(5000)

    const counts: Record<string, number> = {}
    ;(rows||[]).forEach((r: any) => {
      const k = String(r?.payload?.kind || 'unknown').toLowerCase()
      counts[k] = (counts[k] || 0) + 1
    })

    res.status(200).json({
      lastScene: last?.[0] || null,
      counts,
      window: '24h'
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'metrics_failed' })
  }
}

