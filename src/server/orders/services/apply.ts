import type { SupabaseClient } from '@supabase/supabase-js'
import { appConfig } from '@/src/config/app'
import type { ChainAdapter } from '@/src/server/chains/types'
import { withPgClient } from '@/src/server/pg'
import {
  REWARD_LEDGER_ENABLED,
  applyLedgerEntries,
  roundPoints,
} from '@/src/server/rewards'
import { serializeOrder } from '@/src/server/orders/services/serialization'
import type { ConfirmOrderResult, OrderLogContext } from '@/src/server/orders/types'

interface CommonApplyArgs {
  supa: SupabaseClient
  order: any
  orderId: number
  txHash: string
  log: OrderLogContext
}

interface RenameOrderArgs extends CommonApplyArgs {
  chain: ChainAdapter
  addressCased: string
  addressCanonical: string
}

interface PropNameOrderArgs extends CommonApplyArgs {
  addressCased: string
}

interface RewardTopupOrderArgs extends CommonApplyArgs {
  chain: ChainAdapter
  addressCased: string
  addressCanonical: string
}

export async function applyRenameOrder(args: RenameOrderArgs): Promise<ConfirmOrderResult> {
  const { supa, chain, order, orderId, txHash, addressCased, addressCanonical, log } = args
  const params = (order as any).params || {}
  const name = String(params?.name || '').slice(0, 32)
  const nowIso = new Date().toISOString()

  try {
    try {
      await supa.from('token_holders').upsert(
        {
          address: addressCased,
          address_cased: addressCased,
          address_canonical: addressCanonical,
          chain_kind: chain.metadata.kind,
          updated_at: nowIso,
        } as any,
        { onConflict: 'address' },
      )
    } catch {}

    await supa.from('bloblets').upsert(
      {
        address: addressCased,
        address_cased: addressCased,
        address_canonical: addressCanonical,
        chain_kind: chain.metadata.kind,
        name,
      } as any,
      { onConflict: 'address' },
    )
  } catch (err: any) {
    console.error('[orders.confirm] apply rename failed', {
      ...log,
      error: err?.message || String(err),
    })
    return { statusCode: 500, body: { error: 'apply rename failed' } }
  }

  const { error: updErr } = await supa
    .from('orders')
    .update({
      status: 'applied',
      confirmed_at: nowIso,
      applied_at: nowIso,
      tx_hash: txHash,
    })
    .eq('id', orderId)

  if (updErr) {
    console.error('[orders.confirm] rename order update failed', {
      ...log,
      code: updErr.code,
    })
    return { statusCode: 409, body: { error: 'update failed', code: updErr.code } }
  }

  console.log('[orders.confirm] rename applied', log)
  return {
    statusCode: 200,
    body: {
      ok: true,
      status: 'applied',
      order: serializeOrder(order, {
        status: 'applied',
        confirmedAt: nowIso,
        appliedAt: nowIso,
        txHash,
      }),
    },
  }
}

export async function applyPropNameOrder(args: PropNameOrderArgs): Promise<ConfirmOrderResult> {
  const { supa, order, orderId, txHash, addressCased, log } = args
  const nowIso = new Date().toISOString()
  const propId = Number((order as any).params?.propId || 0)
  const newName = String((order as any).params?.name || '').trim()
  const expectedCount = Number((order as any).params?.renameCount || 0)
  const quotedPrice = Math.max(0, Number((order as any).quote_amount || 0))
  const minPrice = Math.max(0, Number((order as any).params?.minPrice || quotedPrice))

  if (!propId || !newName) {
    console.warn('[orders.confirm] prop name bad params', { ...log, propId })
    return { statusCode: 400, body: { error: 'bad order params' } }
  }

  try {
    const { data: cur } = await supa
      .from('bloblets')
      .select('prop_id,rename_count')
      .eq('prop_id', propId)
      .eq('entity_type', 'landmark')
      .maybeSingle()

    const curCount = Math.max(0, Number((cur as any)?.rename_count || 0))
    if (curCount !== expectedCount) {
      console.warn('[orders.confirm] prop name price mismatch', {
        ...log,
        propId,
        expectedCount,
        current: curCount,
      })
      return { statusCode: 409, body: { error: 'price_changed' } }
    }
    if (quotedPrice + 1e-6 < minPrice) {
      console.warn('[orders.confirm] prop name underbid', {
        ...log,
        propId,
        quotedPrice,
        minPrice,
      })
      return { statusCode: 409, body: { error: 'price_changed' } }
    }

    const { data: upd, error: err } = await supa
      .from('bloblets')
      .update({
        name: newName,
        rename_count: curCount + 1,
        name_updated_at: nowIso,
        last_owner: addressCased,
        landmark_price_rp: quotedPrice,
      } as any)
      .eq('prop_id', propId)
      .eq('entity_type', 'landmark')
      .select('prop_id')
      .maybeSingle()

    if (err || !upd) {
      console.error('[orders.confirm] prop name apply_failed', {
        ...log,
        propId,
        error: err?.message,
      })
      return { statusCode: 500, body: { error: 'apply_failed' } }
    }

    try {
      await supa.from('asset_name_history').insert({
        prop_id: propId,
        address: addressCased,
        name: newName,
        price_paid: Number((order as any).quote_amount || 0),
        applied_at: nowIso,
      } as any)
    } catch {}

    const { error: updErr } = await supa
      .from('orders')
      .update({
        status: 'applied',
        confirmed_at: nowIso,
        applied_at: nowIso,
        tx_hash: txHash,
      })
      .eq('id', orderId)

    if (updErr) {
      console.error('[orders.confirm] prop name order update failed', {
        ...log,
        propId,
        code: updErr.code,
      })
      return { statusCode: 409, body: { error: 'update failed', code: updErr.code } }
    }

    console.log('[orders.confirm] prop name applied', { ...log, propId })
    return {
      statusCode: 200,
      body: {
        ok: true,
        status: 'applied',
        order: serializeOrder(order, {
          status: 'applied',
          confirmedAt: nowIso,
          appliedAt: nowIso,
          txHash,
        }),
      },
    }
  } catch (e: any) {
    console.error('[orders.confirm] prop name apply error', {
      ...log,
      error: e?.message || String(e),
    })
    return { statusCode: 500, body: { error: e?.message || 'prop name apply failed' } }
  }
}

export async function applyRewardTopupOrder(args: RewardTopupOrderArgs): Promise<ConfirmOrderResult> {
  const { supa, order, orderId, txHash, chain, addressCased, addressCanonical, log } = args

  if (!REWARD_LEDGER_ENABLED) {
    console.error('[orders.confirm] reward_topup attempted with ledger disabled', log)
    return { statusCode: 503, body: { error: 'reward_ledger_disabled' } }
  }

  const creditAmount = roundPoints(Number((order as any).quote_amount ?? 0))
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    console.error('[orders.confirm] reward_topup invalid amount', {
      ...log,
      quote: (order as any).quote_amount,
    })
    return { statusCode: 400, body: { error: 'invalid_amount' } }
  }

  const now = new Date()
  const nowIso = now.toISOString()
  let balanceAfter: number | null = null

  try {
    await withPgClient(async (client) => {
      await client.query('BEGIN')
      try {
        const ledgerMap = await applyLedgerEntries(
          client,
          [
            {
              address: addressCased,
              delta: creditAmount,
              reason: 'swap_credit',
              metadata: {
                orderId,
                txHash,
                source: 'reward_topup',
              },
            },
          ],
          { now, updateTokenHolders: true },
        )
        const ledgerValue = ledgerMap.get(addressCanonical)
        balanceAfter = ledgerValue != null ? roundPoints(ledgerValue) : null
        const updateRes = await client.query(
          `update public.orders
              set status = 'applied',
                  confirmed_at = $3,
                  applied_at = $3,
                  tx_hash = $4
            where id = $1
              and chain_kind = $2
              and status in ('pending','confirmed')
            returning id`,
          [orderId, chain.metadata.kind, nowIso, txHash],
        )
        if (!updateRes.rowCount) {
          throw new Error('order_conflict')
        }
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'order_conflict') {
      console.warn('[orders.confirm] reward_topup order conflict', {
        ...log,
        error: message,
      })
      return { statusCode: 409, body: { error: 'order_conflict' } }
    }
    console.error('[orders.confirm] reward_topup apply failed', {
      ...log,
      error: message,
    })
    return { statusCode: 500, body: { error: 'reward_topup_failed' } }
  }

  console.log('[orders.confirm] reward_topup applied', {
    ...log,
    amount: creditAmount,
    balanceAfter,
  })

  return {
    statusCode: 200,
    body: {
      ok: true,
      status: 'applied',
      pointsCredited: creditAmount,
      balanceAfter,
      order: serializeOrder(order, {
        status: 'applied',
        confirmedAt: nowIso,
        appliedAt: nowIso,
        txHash,
        quoteAmount: creditAmount,
      }),
    },
  }
}

export async function confirmCareOrder(args: CommonApplyArgs): Promise<ConfirmOrderResult> {
  const { supa, order, orderId, txHash, log } = args
  const nowIso = new Date().toISOString()

  try {
    const { data: updated, error: updErr } = await supa
      .from('orders')
      .update({
        status: 'confirmed',
        confirmed_at: nowIso,
        tx_hash: txHash,
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (updErr) {
      console.error('[orders.confirm] care order update failed', {
        ...log,
        code: updErr.code,
      })
      return { statusCode: 409, body: { error: 'update failed', code: updErr.code } }
    }

    if (!updated) {
      console.warn('[orders.confirm] care order not updated (status mismatch)', log)
      return { statusCode: 409, body: { error: 'order_not_pending' } }
    }

    console.log('[orders.confirm] care order confirmed', log)
    return {
      statusCode: 200,
      body: {
        ok: true,
        status: 'confirmed',
        order: serializeOrder(order, {
          status: 'confirmed',
          confirmedAt: nowIso,
          txHash,
        }),
      },
    }
  } catch (e: any) {
    console.error('[orders.confirm] care order confirm error', {
      ...log,
      error: e?.message || String(e),
    })
    return { statusCode: 500, body: { error: e?.message || 'care confirm failed' } }
  }
}

export async function confirmUnsupportedBundle(log: OrderLogContext): Promise<ConfirmOrderResult> {
  console.warn('[orders.confirm] care bundle no longer supported', log)
  return { statusCode: 410, body: { error: 'bundle_not_supported' } }
}

export async function confirmGenericOrder(args: CommonApplyArgs): Promise<ConfirmOrderResult> {
  const { supa, order, orderId, txHash, log } = args
  const nowIso = new Date().toISOString()

  await supa
    .from('orders')
    .update({ status: 'confirmed', confirmed_at: nowIso, tx_hash: txHash })
    .eq('id', orderId)

  console.log('[orders.confirm] order confirmed', log)

  try {
    const secret = appConfig.secrets.cron
    const internalBase = appConfig.urls.internalApiBase
    if (secret && internalBase) {
      const baseUrl = internalBase.endsWith('/') ? internalBase.slice(0, -1) : internalBase
      fetch(`${baseUrl}/api/orders/apply`, {
        method: 'POST',
        headers: { 'x-internal-auth': secret, 'content-type': 'application/json' } as any,
        body: JSON.stringify({ orderId }),
      }).catch(() => {})
    }
  } catch (err: any) {
    console.error('[orders.confirm] apply trigger failed', {
      ...log,
      error: err?.message || String(err),
    })
  }

  return {
    statusCode: 200,
    body: {
      ok: true,
      status: 'confirmed',
      order: serializeOrder(order, {
        status: 'confirmed',
        confirmedAt: nowIso,
        txHash,
      }),
    },
  }
}
