import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'
import { getSessionFromRequest } from '@/src/server/auth'
import { rateLimiter } from '@/src/server/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    // Require session and add rate limit to avoid abuse
    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ error: 'unauthorized' })
    const ip = (req.headers['x-forwarded-for'] as string) || 'diag'
    const { success } = await rateLimiter.limit(`diag:log:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })
    const { url, kind, note } = req.body || {}
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'missing_url' })
    const supa = supaAdmin()
    const { error } = await supa.from('events').insert({ type: 'snapshot', payload: { url, kind: kind || 'unknown', note: note || null } } as any)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'diag_log_failed' })
  }
}
