import type { NextApiRequest, NextApiResponse } from 'next'

import { appConfig } from '@/src/config/app'
import { supaAdmin } from '@/src/server/supa'

const CHUNK = 512
const PERSIST_TYPES = new Set(['tree','house','playground','shop:salon','shop:grocery','shop:mall','shop:cafe'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    const secret = appConfig.secrets.cron
    const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
    if (!secret || hdr !== secret) return res.status(403).json({ error: 'forbidden' })
    const body = req.body || {}
    const kind = String(body.kind || 'add')
    const supa = supaAdmin()
    if (kind === 'add') {
      const type = String(body.type || '')
      if (!PERSIST_TYPES.has(type)) return res.status(400).json({ error: 'invalid type' })
      const x = Number(body.x)
      const y = Number(body.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ error: 'bad coords' })
      const scale = Number(body.scale ?? 1)
      const z = Number(body.z ?? 0)
      const seed = Number.isFinite(Number(body.seed)) ? Number(body.seed) : Math.floor(Math.random() * 2 ** 31)

      // Bounds check from world_state (optional)
      let min_x = -2000, max_x = 2000, min_y = -2000, max_y = 2000
      try {
        const { data: ws } = await supa.from('world_state').select('min_x,max_x,min_y,max_y').eq('prop_id', 1).maybeSingle()
        if (ws) { min_x = Number((ws as any).min_x ?? min_x); max_x = Number((ws as any).max_x ?? max_x); min_y = Number((ws as any).min_y ?? min_y); max_y = Number((ws as any).max_y ?? max_y) }
      } catch {}
      if (x < min_x || x > max_x || y < min_y || y > max_y) return res.status(400).json({ error: 'out of bounds' })

      // Insert as persistent prop (no expires_at)
      const { data, error } = await supa
        .from('bloblets')
        .insert({ entity_type: 'landmark', prop_type: type, avatar_alive_url_256: '', anchor_x: x, anchor_y: y, z, scale, expires_at: null } as any)
        .select('prop_id,prop_type,anchor_x,anchor_y,z,scale')
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })

      // Log op
      try { await supa.from('events').insert({ type: 'world_op', payload: { kind, type, x, y, z, scale, seed } } as any) } catch {}

      return res.status(200).json({ ok: true, object: data })
    }

    if (kind === 'move') {
      const id = Number(body.id)
      const x = Number(body.x)
      const y = Number(body.y)
      if (!id || !Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ error: 'bad payload' })
      const { data, error } = await supa
        .from('bloblets')
        .update({ anchor_x: x, anchor_y: y } as any)
        .eq('prop_id', id)
        .eq('entity_type', 'landmark')
        .select('prop_id,prop_type,anchor_x,anchor_y,z,scale')
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      try { await supa.from('events').insert({ type: 'world_op', payload: { kind, id, x, y } } as any) } catch {}
      return res.status(200).json({ ok: true, object: data })
    }

    if (kind === 'remove') {
      const id = Number(body.id)
      if (!id) return res.status(400).json({ error: 'bad payload' })
      const { error } = await supa.from('bloblets').delete().eq('prop_id', id)
      if (error) return res.status(500).json({ error: error.message })
      try { await supa.from('events').insert({ type: 'world_op', payload: { kind, id } } as any) } catch {}
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'unsupported op' })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'op failed' })
  }
}
