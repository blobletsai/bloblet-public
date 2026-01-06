import type { MutableRefObject } from 'react'

import type {
  OrderState,
  OrderStatus,
  OrderType,
} from '@/src/client/hooks/orders/orderTypes'
import type {
  CreateOrderResult,
  LastPreview,
  MergeHistoryFn,
  SetStateFn,
} from '../controllerTypes'
import { notifySessionUnauthorized } from '@/src/client/session/sessionManager'

type CreateOrderContext = {
  addressCanonical: string
  isLocked: () => boolean
  getActiveOrderId: () => number | null
  getStatus: () => OrderStatus | null
  setState: SetStateFn<OrderState>
  setReason: (reason: string | null) => void
  setNotice: SetStateFn<string | null>
  setLoading: (value: boolean) => void
  mergeHistory: MergeHistoryFn
  resetBackoff: () => void
  setLastPreview: SetStateFn<LastPreview>
  prevStatusRef: MutableRefObject<string | null>
  mountedRef: MutableRefObject<boolean>
}

export async function createOrderAction(
  ctx: CreateOrderContext,
  params: Record<string, any>,
): Promise<CreateOrderResult> {
  if (!ctx.addressCanonical) {
    ctx.setReason('Verify this wallet first')
    return { ok: false, order: null, paymentRequired: true }
  }
  const type: OrderType = 'reward_topup'
  if (ctx.isLocked()) {
    const activeId = ctx.getActiveOrderId()
    const statusLabel = ctx.getStatus() || 'in progress'
    ctx.setReason(
      activeId
        ? `Order #${activeId} is still ${statusLabel}. Wait for it to finish before starting another.`
        : 'An order is still in progress. Wait for it to finish.',
    )
    return { ok: false, order: null, paymentRequired: true }
  }

  ctx.setLoading(true)
  ctx.setReason(null)
  ctx.setNotice(null)
  try {
    const resp = await fetch('/api/orders/intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      // Do not send address; server uses session (canonical casing for Solana)
      body: JSON.stringify({ type, params }),
    })
    const json = await resp.json().catch(() => null)
    if (resp.status === 401) {
      notifySessionUnauthorized(json?.reason)
    }
    if (!resp.ok || !json?.order) {
      ctx.setReason(json?.error || `Order failed (${resp.status})`)
      return { ok: false, order: null, paymentRequired: true }
    }

    const paymentRequired = json?.paymentRequired !== false
    const orderId = Number(json.order.id || 0) || null
    const quoteAmount =
      Number(json.order.quote_amount ?? json.order.quoteAmount ?? 0) || null
    const status = String(json.order.status || 'pending')
    const createdAt =
      typeof json.order.created_at === 'string'
        ? json.order.created_at
        : new Date().toISOString()

    const nextState: OrderState = {
      orderId,
      quote: quoteAmount,
      status,
      reason: null,
      signature: null,
      previewAliveUrl: null,
      confirmations: null,
      type,
      careDrop: null,
      createdAt,
      appliedPoints: null,
      appliedBalance: null,
    }
    ctx.setState(nextState)
    ctx.mergeHistory(orderId, {
      status,
      type,
      quote: quoteAmount,
      signature: null,
      reason: null,
      createdAt,
    })
    ctx.setLastPreview({ alive: null })
    ctx.prevStatusRef.current = status
    ctx.resetBackoff()
    return { ok: true, order: json.order, paymentRequired }
  } catch (err: any) {
    ctx.setReason(err?.message || 'Order failed')
    return { ok: false, order: null, paymentRequired: true }
  } finally {
    if (ctx.mountedRef.current) {
      ctx.setLoading(false)
    }
  }
}
