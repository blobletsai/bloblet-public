import type { NextApiRequest, NextApiResponse } from 'next'
import { uploadPublic } from '@/src/server/storage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    const body = req.body || {}
    const dataUrl: string = String(body.dataUrl || '')
    if (!dataUrl.startsWith('data:image/png;base64,')) return res.status(400).json({ error: 'invalid_payload' })
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const buf = Buffer.from(base64, 'base64')
    if (!buf.length || buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'too_large' })
    const key = `snapshots/${new Date().toISOString().replace(/[:.]/g,'-')}_${Math.random().toString(36).slice(2)}.png`
    const url = await uploadPublic({ key, body: buf, contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable', kind: 'persist' })
    return res.status(200).json({ ok: true, url })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'snapshot_failed' })
  }
}
