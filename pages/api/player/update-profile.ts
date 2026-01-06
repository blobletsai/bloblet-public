import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { supaAdmin } from '@/src/server/supa'
import { rateLimiter } from '@/src/server/rateLimit'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    
    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ error: 'unauthorized' })
    
    const ip = (req.headers['x-forwarded-for'] as string) || 'profile'
    const { success } = await rateLimiter.limit(`profile:update:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })

    const body = req.body || {}
    const rawHandle = String(body.handle || '').trim()

    // Validation: Max 32 chars, simple sanitization (no specific charset restriction)
    if (rawHandle.length > 32) {
      return res.status(400).json({ error: 'Handle too long (max 32 chars)' })
    }
    
    // Basic sanitization - allow text but avoid simple injection chars if necessary
    // For now, we just take the string.
    
    const chainKind = resolveChainKind()
    const addressCanonical = normalizeChainAddress(sess.address, chainKind)
    if (!addressCanonical) return res.status(400).json({ error: 'invalid_address' })

    const supa = supaAdmin()

    // Verify ownership (row must exist for this address)
    // If not exist, we can upsert minimal record or fail. Usually upsert minimal.
    const { error } = await supa.from('bloblets').upsert({
      address: addressCanonical, // In simple mode, address is PK
      address_canonical: addressCanonical,
      chain_kind: chainKind,
      social_handle: rawHandle || null
    } as any, { onConflict: 'address' })

    if (error) throw error

    return res.status(200).json({ ok: true, handle: rawHandle || null })
  } catch (err: any) {
    console.error('[api/player/update-profile]', err)
    return res.status(500).json({ error: 'update_failed' })
  }
}
