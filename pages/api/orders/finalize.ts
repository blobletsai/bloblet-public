import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'
import { getSessionFromRequest } from '@/src/server/auth'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'
import {
  debitRewardPoints,
  withLedgerTransaction,
  InsufficientRewardPointsError,
} from '@/src/server/orders/services/ledgerSpend'
import { appConfig } from '@/src/config/app'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    const secret = appConfig.secrets.cron
    const internal =
      !!secret &&
      (((req.headers['x-internal-auth'] as string) === secret) ||
        ((req.headers['x-internal-secret'] as string) === secret))
    const sess = internal ? null : getSessionFromRequest(req)
    if (!internal && (!sess || !sess.address)) return res.status(401).json({ error: 'unauthorized' })

    const id = Number((req.body as any)?.orderId)
    if (!id) return res.status(400).json({ error: 'bad id' })
    const supa = supaAdmin()
    const chainKind = resolveChainKind()
    const { data: order } = await supa
      .from('orders')
      .select('*')
      .eq('chain_kind', chainKind)
      .eq('id', id)
      .maybeSingle()
    if (!order) return res.status(404).json({ error: 'order not found' })
    const addressStored = String((order as any).address || (order as any).address_canonical || '').trim()
    const addressCanonical =
      String((order as any).address_canonical || addressStored || '').trim() || addressStored
    const addressCased =
      String((order as any).address_cased || addressStored || (order as any).address_canonical || '').trim() ||
      addressCanonical
    if (!internal) {
      let sessionCanonical: string
      try {
        sessionCanonical = normalizeChainAddress(sess?.address || '', chainKind)
      } catch {
        return res.status(400).json({ error: 'invalid_address' })
      }
      if (sessionCanonical !== addressCanonical) {
        return res.status(403).json({ error: 'address mismatch' })
      }
    }
    if (order.status === 'applied') {
      return res.status(200).json({ ok: true, status: 'applied' })
    }
    if (order.status !== 'generated' && order.status !== 'alive_ready') {
      return res.status(400).json({ error: 'not generated' })
    }

    const alive = (order as any).preview_alive_url || null
    if (!alive) return res.status(400).json({ error: 'missing preview' })

    const quoteAmount = Number((order as any).quote_amount || 0)
    if (!Number.isFinite(quoteAmount) || quoteAmount <= 0) {
      return res.status(400).json({ error: 'invalid quote amount' })
    }

    // Debit RP before applying the avatar (payment happens here, not at preview generation)
    try {
      const ledgerResult = await withLedgerTransaction(async (client, now) => {
        return await debitRewardPoints({
          client,
          addressCanonical,
          addressCased,
          amountRp: quoteAmount,
          reason: 'avatar_debit',
          metadata: {
            orderId: id,
            source: 'finalize_endpoint',
          },
          now,
        })
      })

      const variantKey = `custom-${addressCanonical}-${id}`
      const { data: variantRow, error: variantErr } = await supa
        .from('sprite_variants')
        .upsert({
          key: variantKey,
          alive_url: alive,
          alive_url_256: alive,
          active: false,
          weight: 1,
          is_custom: true,
          owner_address: addressCanonical,
          origin_order_id: id,
          created_by: 'orders.finalize',
          notes: 'finalized custom avatar',
        }, { onConflict: 'key' })
        .select('id, alive_url, alive_url_256')
        .single()
      if (variantErr) return res.status(500).json({ error: variantErr.message })
      const variantId = variantRow?.id || null
      const variantAlive256 = variantRow?.alive_url_256 || variantRow?.alive_url || alive

      const nowIso = new Date().toISOString()
      // Apply preview to bloblet
      await supa.from('bloblets').upsert(
        {
          address: addressCased,
          address_cased: addressCased,
          address_canonical: addressCanonical,
          chain_kind: chainKind,
          assigned_variant_id: variantId,
          avatar_alive_url_256: variantAlive256,
          is_custom: true,
        } as any,
        { onConflict: 'address' },
      )
      await supa
        .from('orders')
        .update({ status: 'applied', applied_at: nowIso, retry_count: 0, last_error: null, reason: null })
        .eq('id', id)
        .eq('chain_kind', chainKind)
      return res.status(200).json({
        ok: true,
        status: 'applied',
        balanceBefore: ledgerResult.balanceBefore,
        balanceAfter: ledgerResult.balanceAfter,
        message: `Avatar applied. ${quoteAmount} BC debited. New balance: ${ledgerResult.balanceAfter} BC.`,
      })
    } catch (err: any) {
      if (err instanceof InsufficientRewardPointsError) {
        return res.status(402).json({
          error: 'insufficient_balance',
          quoteAmount,
          message: `Not enough BlobCoin to apply avatar. Need ${quoteAmount} BC.`,
        })
      }
      console.error('[orders.finalize] RP debit failed', {
        orderId: id,
        addressCanonical,
        error: err?.message || String(err),
      })
      return res.status(500).json({ error: err?.message || 'finalize_failed' })
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'finalize failed' })
  }
}
