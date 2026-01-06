import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'
import { getSessionFromRequest } from '@/src/server/auth'
import { resolveChainKind } from '@/src/server/chains'
import { resolveEconomyConfig } from '@/src/config/economy'
import { normalizeChainAddress } from '@/src/server/address'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).end('Method not allowed')
    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ error: 'unauthorized' })
    const chainKind = resolveChainKind()
    let address: string
    try {
      address = normalizeChainAddress(sess.address, chainKind)
    } catch {
      return res.status(400).json({ error: 'invalid_address' })
    }
    const supa = supaAdmin()

    // Load config for dynamic price computation
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

    const { data: blobletRow } = await supa
      .from('bloblets')
      .select('social_handle')
      .eq('chain_kind', chainKind)
      .eq('address_canonical', address)
      .maybeSingle()

    const now = new Date().toISOString()
    const { data: ownedRows } = await supa
      .from('bloblets')
      .select('prop_id,prop_type,name,rename_count,landmark_price_rp,expires_at')
      .eq('entity_type', 'landmark')
      .eq('chain_kind', chainKind)
      .eq('last_owner', address)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('prop_id', { ascending: true })

    const owned = (ownedRows || []).map((r: any) => {
      const rc = Math.max(0, Number(r.rename_count || 0))
      const lastPrice = Math.max(0, Number(r.landmark_price_rp || 0))
      const stepPrice = base + step * rc
      const premiumPrice = lastPrice > 0 ? Math.ceil(lastPrice * (1 + premiumPct)) : base
      const currentPrice = Math.max(stepPrice, premiumPrice)
      return {
        id: Number(r.prop_id),
        type: String(r.prop_type || ''),
        name: (String(r.name || '').trim()) || null,
        rename_count: rc,
        current_price: currentPrice,
        last_price: lastPrice,
      }
    })

    const { data: histRows } = await supa
      .from('asset_name_history')
      .select('prop_id,name,price_paid,applied_at')
      .eq('address', address)
      .order('applied_at', { ascending: false })
      .limit(30)

    const history = (histRows || []).map((r: any) => ({
      prop_id: Number(r.prop_id),
      name: String(r.name || ''),
      price_paid: Number(r.price_paid || 0),
      applied_at: String(r.applied_at || ''),
    }))

    return res.status(200).json({
      base,
      step,
      premiumPct,
      owned,
      history,
      social_handle: (blobletRow as any)?.social_handle || null,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'assets_my_failed' })
  }
}
