// Seed a set of persistent props (trees, campfires) using NB + Bria via FAL
// Admin-only: requires x-internal-auth: CRON_SECRET
import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { assetConfig } from '@/src/config/assets'
import { storageConfig } from '@/src/config/storage'
import { supaAdmin } from '@/src/server/supa'
import { ensureAiEnv, nbEditImage, briaRemoveBg, fetchBuffer } from '@/src/server/ai'
import { uploadPublic, getPublicUrl } from '@/src/server/storage'

type Preset = { type: string; theme?: string; anchor_x: number; anchor_y: number; z?: number; scale?: number; ttl_sec?: number }

const DEFAULT_PRESETS: Preset[] = [
  { type: 'tree', anchor_x: -2200, anchor_y: 900, z: -120, scale: 1.25, theme: 'lush, rounded leaves' },
  { type: 'tree', anchor_x:  1900, anchor_y: 860, z: -120, scale: 1.15, theme: 'tall, rounded crown' },
  { type: 'tree', anchor_x: -1200, anchor_y: -840, z: -120, scale: 1.35, theme: 'bushy, dense leaves' },
  { type: 'tree', anchor_x:  1400, anchor_y: -720, z: -120, scale: 1.20, theme: 'short, wide canopy' },
  { type: 'campfire', anchor_x: 160, anchor_y: 240, z: -110, scale: 1.0, theme: 'small flame, warm glow' },
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const secret = appConfig.secrets.cron
    if (!secret && process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'forbidden' })
    }
    if (secret) {
      const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
      if (hdr !== secret) return res.status(403).json({ error: 'forbidden' })
    }

    const presets: Preset[] = Array.isArray(req.body?.presets) && req.body.presets.length ? req.body.presets : DEFAULT_PRESETS
    const supa = supaAdmin()
    ensureAiEnv()

    // Resolve a neutral source image for NB
    const source = assetConfig.avatars.defaultSource || getPublicUrl('mascot/source.jpg')
    if (!source) throw new Error('Missing DEFAULT_AVATAR_SOURCE_URL or mascot/source.jpg')

    const results: any[] = []
    for (const p of presets) {
      try {
        const base = 'pixel art prop, centered, no background, high-contrast edges, PNG, no text, no watermark'
        const prompt = p.theme ? `${base}, theme: ${p.theme}, ${p.type}` : `${base}, ${p.type}`
        const nbUrl = await nbEditImage(source, prompt)
        let cleanUrl: string
        try { cleanUrl = await briaRemoveBg(nbUrl) } catch { cleanUrl = nbUrl }
        const buf = await fetchBuffer(cleanUrl)
        const key = `props/seed/${Date.now()}_${Math.random().toString(36).slice(2)}.png`
        const cache = storageConfig.cacheControl
        const pubUrl = await uploadPublic({ key, body: buf, contentType: 'image/png', cacheControl: cache, kind: 'persist' })

        const expiresAt = p.ttl_sec ? new Date(Date.now() + Number(p.ttl_sec) * 1000).toISOString() : null
        const { data: row, error: insErr } = await supa.from('bloblets').insert({
          entity_type: 'landmark',
          prop_type: String(p.type),
          avatar_alive_url_256: pubUrl,
          anchor_x: Number(p.anchor_x || 0), anchor_y: Number(p.anchor_y || 0), z: Number(p.z || -100), scale: Number(p.scale || 1),
          expires_at: expiresAt,
        }).select('prop_id,prop_type,avatar_alive_url_256,anchor_x,anchor_y,z,scale').single()
        if (insErr) throw insErr
        results.push({ ok: true, id: row?.prop_id, type: row?.prop_type, url: row?.avatar_alive_url_256 })
      } catch (e: any) {
        results.push({ ok: false, error: String(e?.message || e), type: p.type })
      }
    }

    const ok = results.filter(r => r.ok).length
    return res.status(200).json({ ok: true, created: ok, results })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'seed failed' })
  }
}
