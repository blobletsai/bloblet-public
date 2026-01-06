import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const since = String(req.query.since || '').trim()
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)))
    const supa = supaAdmin()
    let q = supa.from('events').select('id,type,payload,created_at').order('id', { ascending: false }).limit(limit)
    if (since) {
      // Support numeric id or ISO timestamp
      const idNum = Number(since)
      if (Number.isFinite(idNum) && idNum > 0) {
        q = q.gt('id', idNum)
      } else {
        q = q.gt('created_at', since)
      }
    }
    const { data, error } = await q
    if (error) return res.status(500).json({ error: 'select_failed' })
    return res.status(200).json({ events: data || [] })
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || 'failed' })
  }
}

