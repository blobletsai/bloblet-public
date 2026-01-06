import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

const PERSISTENT_TYPES = new Set([
  'tree', 'house', 'playground',
  'shop:salon', 'shop:grocery', 'shop:mall', 'shop:cafe',
])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const minX = Number(req.query.minX ?? Number.NaN)
    const maxX = Number(req.query.maxX ?? Number.NaN)
    const minY = Number(req.query.minY ?? Number.NaN)
    const maxY = Number(req.query.maxY ?? Number.NaN)
    const supa = supaAdmin()
    let q = supa.from('bloblets').select('prop_id,prop_type,anchor_x,anchor_y,z,scale,expires_at')
      .eq('entity_type', 'landmark')
      .is('expires_at', null)
    if (Number.isFinite(minX) && Number.isFinite(maxX)) {
      q = q.gte('anchor_x', minX).lte('anchor_x', maxX) as any
    }
    if (Number.isFinite(minY) && Number.isFinite(maxY)) {
      q = (q as any).gte('anchor_y', minY).lte('anchor_y', maxY)
    }
    // Fetch and filter types in app (supabase doesn't support IN with local Set directly here)
    const { data, error } = await q.limit(1000)
    if (error) return res.status(500).json({ error: error.message })
    const rows = (data || []).filter((r: any) => PERSISTENT_TYPES.has(String(r.prop_type || '')))
    return res.status(200).json({ ok: true, objects: rows })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'objects failed' })
  }
}

