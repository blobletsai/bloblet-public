import type { MutableRefObject } from 'react'

import type { OrderState } from '@/src/client/hooks/orders/orderTypes'
import type {
  MergeHistoryFn,
  SetStateFn,
} from '../controllerTypes'
import { notifySessionUnauthorized } from '@/src/client/session/sessionManager'

type CancelOrderContext = {
  state: OrderState
  setState: SetStateFn<OrderState>
  setReason: (reason: string | null) => void
  setNotice: (notice: string | null) => void
  mergeHistory: MergeHistoryFn
  reset: () => void
  mountedRef: MutableRefObject<boolean>
}

export async function cancelOrderAction(
  ctx: CancelOrderContext,
): Promise<{ ok: boolean }> {
  const currentOrderId = ctx.state.orderId
  if (!currentOrderId) return { ok: false }
  try {
    const resp = await fetch('/api/orders/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ orderId: currentOrderId }),
    })
    const json = await resp.json().catch(() => null)
    if (resp.status === 401) {
      notifySessionUnauthorized(json?.reason)
    }
    if (!resp.ok) {
      ctx.setReason(json?.error || `Cancel failed (${resp.status})`)
      return { ok: false }
    }
    const nextStatus = String(json?.status || 'expired')
    const cancelReason = String(json?.reason || 'cancelled_by_user')
    ctx.mergeHistory(currentOrderId, {
      status: nextStatus,
      reason: cancelReason,
      type: ctx.state.type,
      quote: ctx.state.quote,
    })
    if (ctx.mountedRef.current) {
      ctx.setState((prev) => ({
        ...prev,
        status: nextStatus,
        reason: cancelReason,
      }))
      ctx.setNotice('Order cancelled.')
      setTimeout(() => {
        if (ctx.mountedRef.current) {
          ctx.reset()
        }
      }, 600)
    }
    return { ok: true }
  } catch (err: any) {
    ctx.setReason(err?.message || 'Cancel failed')
    return { ok: false }
  }
}
