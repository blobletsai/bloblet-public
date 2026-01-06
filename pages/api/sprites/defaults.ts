import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const supa = supaAdmin()
    const { data, error } = await supa
      .from('sprite_variants')
      .select('id,alive_url,alive_url_256,is_custom')
      .eq('active', true)
      .or('is_custom.is.null,is_custom.eq.false')
      .order('id', { ascending: true })
      .limit(20)
    if (error) throw error
    const items = (data || [])
      .filter((row: any) => row?.is_custom !== true)
      .map((r: any) => ({ id: r.id, url: r.alive_url_256 || r.alive_url }))
    return res.status(200).json({ items })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'defaults failed' })
  }
}
