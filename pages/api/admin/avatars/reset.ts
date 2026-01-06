import type { NextApiRequest, NextApiResponse } from 'next'

import { appConfig } from '@/src/config/app'
import { adminConfig } from '@/src/config/admin'
import { supaAdmin } from '@/src/server/supa'
import { getDefaultSpriteUrl } from '@/src/shared/appearance'

function isAuthorized(req: NextApiRequest) {
  const secret = (adminConfig.secrets.cron || adminConfig.secrets.admin || '').trim()
  if (!secret) return !appConfig.isProduction // require in prod
  const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || (req.query.secret as string) || ''
  return hdr === secret
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'forbidden' })
  if (req.method !== 'POST') return res.status(405).end('Method not allowed')
  try {
    const aliveFallback = getDefaultSpriteUrl(true)

    const supa = supaAdmin()
    const dry = String(req.query.dry || '') === '1'
    const force = String(req.query.force || '') === '1'

    // Update all non-custom bloblets (is_custom=false or null)
    let updated = 0

    if (dry) {
      const { count } = await supa.from('bloblets').select('address', { count: 'exact', head: true })
      updated = count || 0
    } else {
      // Fetch active variants
      const { data: vars } = await supa
        .from('sprite_variants')
        .select('id,alive_url,alive_url_256,is_custom')
        .eq('active', true)
        .or('is_custom.is.null,is_custom.eq.false')
        .order('id', { ascending: true })
      const variants = ((vars || []) as any[]).filter((v) => v?.is_custom !== true)
      const pickVariant = (addr: string) => {
        if (!variants.length) return null
        const s = addr || ''
        let h = 2166136261 >>> 0
        for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619) }
        const idx = Number(h>>>0) % variants.length; return variants[idx]!
      }
      // Fetch addresses in pages and upsert
      const pageSize = 500; let offset = 0; let total = 0
      while (true) {
        const { data: rows } = await supa.from('bloblets').select('address,is_custom').order('address',{ascending:true}).range(offset, offset+pageSize-1)
        if (!rows || !rows.length) break
        const ups = [] as any[]
        for (const r of rows){
          const addr = String((r as any).address||'').trim(); if (!addr) continue
          if ((r as any).is_custom === true && !force) continue
          const v = pickVariant(addr)
          const alive = v?.alive_url_256 || v?.alive_url || aliveFallback
          if (!alive) continue
          ups.push({
            address: addr,
            assigned_variant_id: v?.id || null,
            avatar_alive_url_256: alive,
            is_custom: false,
          })
        }
        if (ups.length) {
          const { error: uErr } = await supa.from('bloblets').upsert(ups as any, { onConflict: 'address' })
          if (uErr) throw uErr
          total += ups.length
        }
        offset += pageSize
      }
      updated = total
    }

    return res.status(200).json({ ok: true, updated, dry, force })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'reset failed' })
  }
}
