import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const supa = supaAdmin()
    const { data, error } = await supa
      .from('products')
      .select('id,title,subtitle,is_active,price_mode,amount_tokens,decimals,eta_text,badges,params_schema,sort')
      .eq('is_active', true)
      .order('sort', { ascending: true })
    if (error) throw error
    return res.status(200).json({ products: data || [] })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'products failed' })
  }
}

