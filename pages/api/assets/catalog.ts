import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'
import { resolveEconomyConfig } from '@/src/config/economy'

function niceType(t?: string | null) {
  const base = String(t || '').split(':')[0]
  if (!base) return 'Asset'
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const supa = supaAdmin()

    // Load pricing config for prop/asset naming
    const economy = resolveEconomyConfig()
    let base = Math.max(0, Number(economy.pricing.landmarkBaseRp))
    let step = Math.max(0, Number(economy.pricing.landmarkStepRp))
    let premiumPct = Math.max(0, Number(economy.pricing.landmarkPremiumPct ?? 0))
    try {
      const { data: cfg } = await supa
        .from('product_configs')
        .select('params')
        .eq('product_id', 'prop_name')
        .maybeSingle()
      if (cfg && (cfg as any).params) {
        const p = (cfg as any).params
        if (Number.isFinite(Number(p.base))) base = Number(p.base)
        if (Number.isFinite(Number(p.step))) step = Number(p.step)
        if (Number.isFinite(Number(p.premiumPct))) premiumPct = Math.max(0, Number(p.premiumPct))
      }
    } catch {}

    // List active assets (landmarks) with current price
    const now = new Date().toISOString()
    const { data: rows, error } = await supa
      .from('bloblets')
      .select('prop_id,prop_type,name,rename_count,landmark_price_rp,anchor_x,anchor_y,z,scale,expires_at')
      .eq('entity_type', 'landmark')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('prop_id', { ascending: true })
    if (error) throw error

      const items = (rows || []).map((r: any) => {
        const rc = Math.max(0, Number(r.rename_count || 0))
        const category = String(r.prop_type || '').split(':')[0] || 'asset'
        const label = (String(r.name || '').trim()) || `${niceType(r.prop_type)} #${r.prop_id}`
        const lastPrice = Math.max(0, Number(r.landmark_price_rp || 0))
        const stepPrice = base + step * rc
        const premiumPrice = lastPrice > 0 ? Math.ceil(lastPrice * (1 + premiumPct)) : base
        const currentPrice = Math.max(stepPrice, premiumPrice)
        return {
          id: Number(r.prop_id),
          type: String(r.prop_type || ''),
          category,
          name: label,
          rename_count: rc,
          current_price: currentPrice,
          last_price: lastPrice,
        }
      })

    const catMap = new Map<string, number>()
    for (const it of items) { catMap.set(it.category, (catMap.get(it.category) || 0) + 1) }
    const categories = Array.from(catMap.entries()).map(([id, count]) => ({ id, label: niceType(id), count })).sort((a,b)=> a.label.localeCompare(b.label))

    return res.status(200).json({ base, step, categories, items })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'catalog failed' })
  }
}
