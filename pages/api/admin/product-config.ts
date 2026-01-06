import type { NextApiRequest, NextApiResponse } from 'next'

import { appConfig } from '@/src/config/app'
import { adminConfig } from '@/src/config/admin'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supa = supaAdmin()
    if (req.method === 'GET') {
      const id = String((req.query?.product_id as string) || '').trim()
      if (!id) return res.status(400).json({ error: 'missing product_id' })
      const { data } = await supa.from('product_configs').select('product_id,params,updated_at').eq('product_id', id).maybeSingle()
      return res.status(200).json({ config: data || null })
    }
    if (req.method === 'POST') {
      const secret = (adminConfig.secrets.cron || '').trim()
      const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
      if ((appConfig.isProduction && !secret) || (secret && hdr !== secret)) return res.status(403).json({ error: 'forbidden' })
      const product_id = String((req.body as any)?.product_id || '').trim()
      const params = (req.body as any)?.params || {}
      if (!product_id || !params || typeof params !== 'object') return res.status(400).json({ error: 'bad payload' })
      const { data, error } = await supa
        .from('product_configs')
        .upsert({ product_id, params, updated_at: new Date().toISOString() } as any, { onConflict: 'product_id' })
        .select('product_id,params,updated_at')
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, config: data })
    }
    return res.status(405).end('Method not allowed')
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'config failed' })
  }
}
