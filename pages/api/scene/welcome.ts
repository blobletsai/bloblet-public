// Trigger welcome formation scene via events table insert
import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const supa = supaAdmin()
    const payload = { kind: 'welcome' as const }
    const { error } = await supa.from('events').insert({ type: 'scene_trigger', payload, severity: 1 } as any)
    if (error) return res.status(500).json({ error: 'insert_failed' })
    return res.status(200).json({ success: true, message: 'welcome scene enqueued' })
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || 'failed' })
  }
}
