import type { NextApiRequest, NextApiResponse } from 'next'

import { appConfig } from '@/src/config/app'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    const body = req.body || {}
    const type = String(body.type || '')
    const payload = (body.payload ?? {}) as any

    // Optional internal secret gate; if set, require header to match
    const secret = appConfig.secrets.cron
    if (secret) {
      const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
      if (hdr !== secret) return res.status(403).json({ error: 'forbidden' })
    }

    // Allow only small, whitelisted activity types
    const allowed = new Set(['start', 'goal'])
    if (!allowed.has(type)) return res.status(400).json({ error: 'unsupported type' })

    const supa = supaAdmin()
    await supa.from('events').insert({ type: `world:${type}`, payload, severity: 1 } as any)
    return res.status(200).json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'activity failed' })
  }
}
