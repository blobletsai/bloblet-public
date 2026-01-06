import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfirmOrderResult } from '@/src/server/orders/types'
import { serializeOrder } from '@/src/server/orders/services/serialization'
import { normalizeChainAddress, tryNormalizeChainAddress } from '@/src/server/address'

export interface LoadOrderArgs {
  supa: SupabaseClient
  chainKind: string
  orderId: number
  txHash: string
  internal?: boolean
  sessionAddressKey?: string | null
}

export interface LoadedOrder {
  order: any
  addressRaw: string
  addressCanonical: string
  addressCased: string
}

export type LoadOrderResult =
  | { kind: 'success'; value: LoadedOrder }
  | { kind: 'response'; response: ConfirmOrderResult }

export async function loadPendingOrder(args: LoadOrderArgs): Promise<LoadOrderResult> {
  const { supa, chainKind, orderId, txHash, internal, sessionAddressKey } = args

  const { data: order, error } = await supa
    .from('orders')
    .select('*')
    .eq('chain_kind', chainKind)
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[orders.confirm] supabase fetch failed', {
      orderId,
      txHash,
      chainKind,
      error: error.message,
    })
    return { kind: 'response', response: { statusCode: 500, body: { error: 'order lookup failed' } } }
  }

  if (!order) {
    console.warn('[orders.confirm] order not found', { orderId, txHash, chainKind })
    return { kind: 'response', response: { statusCode: 404, body: { error: 'order not found' } } }
  }

  let addressRaw = String((order as any).address || (order as any).address_canonical || '')
  if (!addressRaw) {
    console.warn('[orders.confirm] order missing address', { orderId, txHash, chainKind })
    return { kind: 'response', response: { statusCode: 400, body: { error: 'order missing address' } } }
  }

  let addressCanonical = String((order as any).address_canonical || addressRaw).trim()
  let addressCased =
    String((order as any).address_cased || addressRaw || (order as any).address_canonical || '').trim() ||
    addressCanonical

  try {
    const normalized = normalizeChainAddress(addressCased || addressRaw, chainKind)
    addressRaw = normalized
    addressCased = normalized
    addressCanonical = normalized
  } catch (err) {
    console.warn('[orders.confirm] failed to canonicalize order address', {
      orderId,
      txHash,
      chainKind,
      error: (err as any)?.message || String(err),
    })
    return { kind: 'response', response: { statusCode: 400, body: { error: 'invalid order address' } } }
  }

  if (!internal) {
    const sessionAddr = tryNormalizeChainAddress(sessionAddressKey, chainKind)
    if (!sessionAddr || sessionAddr !== addressCanonical) {
      console.warn('[orders.confirm] session address mismatch', {
        orderId,
        txHash,
        chainKind,
        sessionAddr,
        addressCanonical,
      })
      return { kind: 'response', response: { statusCode: 403, body: { error: 'address mismatch' } } }
    }
  }

  if ((order as any).chain_kind && (order as any).chain_kind !== chainKind) {
    console.warn('[orders.confirm] chain mismatch', {
      orderId,
      txHash,
      expected: chainKind,
      actual: (order as any).chain_kind,
    })
    return { kind: 'response', response: { statusCode: 400, body: { error: 'chain mismatch' } } }
  }

  if ((order as any).status && (order as any).status !== 'pending') {
    const existingStatus = String((order as any).status)
    console.log('[orders.confirm] order already processed', {
      orderId,
      txHash,
      status: existingStatus,
    })
    return {
      kind: 'response',
      response: {
        statusCode: 200,
        body: {
          ok: true,
          status: existingStatus,
          order: serializeOrder(order),
        },
      },
    }
  }

  const now = Date.now()
  const expiresAt = (order as any).expires_at ? Date.parse((order as any).expires_at) : 0
  if (expiresAt && now > expiresAt) {
    await supa
      .from('orders')
      .update({ status: 'expired', reason: 'order expired' })
      .eq('id', orderId)
    console.warn('[orders.confirm] order expired', { orderId, txHash, chainKind })
    return { kind: 'response', response: { statusCode: 400, body: { error: 'order expired' } } }
  }

  return {
    kind: 'success',
    value: {
      order,
      addressRaw,
      addressCanonical,
      addressCased,
    },
  }
}
