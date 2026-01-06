import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { storageConfig } from '@/src/config/storage'
import { supaAdmin } from '@/src/server/supa'
import { rateLimiter } from '@/src/server/rateLimit'
import { ensureAiEnv, nbEditImage, briaRemoveBg, fetchBuffer, openaiClient } from '@/src/server/ai'
import { uploadPublic, getPublicUrl } from '@/src/server/storage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    // Internal auth: require CRON_SECRET when set (admin-only route)
    const secret = appConfig.secrets.cron
    if (secret) {
      const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
      if (hdr !== secret) return res.status(403).json({ error: 'forbidden' })
    }
    const ip = req.headers['x-forwarded-for'] as string || 'props'
    const { success } = await rateLimiter.limit(`props:create:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })

    const { type, theme, anchor_x, anchor_y, z, scale, ttl_sec } = req.body || {}
    if (!type) return res.status(400).json({ error: 'missing type' })

    ensureAiEnv()
    const openai = openaiClient()
    const base = 'pixel art prop, centered, no background, high-contrast edges, PNG, no text, no watermark'
    const prompt = theme ? `${base}, theme: ${theme}, ${type}` : `${base}, ${type}`

    // For NB, we need a source; use mascot/source.jpg as neutral base
    const supa = supaAdmin()
    const sourceUrl = getPublicUrl('mascot/source.jpg')
    const nbUrl = await nbEditImage(sourceUrl, prompt)
    let cleanUrl: string
    try { cleanUrl = await briaRemoveBg(nbUrl) } catch { cleanUrl = nbUrl }
    const buf = await fetchBuffer(cleanUrl)

    const key = `props/${Date.now()}_${Math.random().toString(36).slice(2)}.png`
    const cache = storageConfig.cacheControl
    const pubUrl = await uploadPublic({ key, body: buf, contentType: 'image/png', cacheControl: cache, kind: 'persist' })

    const expiresAt = ttl_sec ? new Date(Date.now() + Number(ttl_sec) * 1000).toISOString() : null
    const { data: row, error: insErr } = await supa.from('bloblets').insert({
      entity_type: 'landmark',
      prop_type: String(type),
      avatar_alive_url_256: pubUrl,
      anchor_x: Number(anchor_x || 0), anchor_y: Number(anchor_y || 0), z: Number(z || 0), scale: Number(scale || 1),
      expires_at: expiresAt,
    }).select('*').maybeSingle()
    if (insErr) throw insErr
    return res.status(200).json({ ok: true, prop: row })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'create failed' })
  }
}
