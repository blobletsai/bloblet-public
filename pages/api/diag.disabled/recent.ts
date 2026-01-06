import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)))
    const supa = supaAdmin()
    const { data, error } = await supa
      .from('events')
      .select('id,created_at,payload')
      .eq('type', 'snapshot')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, snapshots: data || [] })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'diag_recent_failed' })
  }
}

