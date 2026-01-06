import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'
import { getSessionFromRequest } from '@/src/server/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const supa = supaAdmin()
    const sess = getSessionFromRequest(req)
    const now = new Date().toISOString()
    // Only include last_owner if a session is present (avoid exposing ownership map publicly)
    const cols = sess && sess.address
      ? 'prop_id,prop_type,avatar_alive_url_256 as appearance_url,anchor_x,anchor_y,z,scale,expires_at,name,last_owner'
      : 'prop_id,prop_type,avatar_alive_url_256 as appearance_url,anchor_x,anchor_y,z,scale,expires_at,name'
    const { data, error } = await supa
      .from('bloblets')
      .select(cols as any)
      .eq('entity_type', 'landmark')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('prop_id', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, items: data || [] })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'props_failed' })
  }
}
