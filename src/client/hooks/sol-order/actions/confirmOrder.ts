import type { MutableRefObject } from 'react'

import type {
  OrderState,
  OrderStatus,
  OrderType,
} from '@/src/client/hooks/orders/orderTypes'
import type {
  ConfirmOrderResult,
  MergeHistoryFn,
  SetStateFn,
} from '../../orders/controllerTypes'
import { notifySessionUnauthorized } from '@/src/client/session/sessionManager'

type ConfirmOrderContext = {
  state: OrderState
  setState: SetStateFn<OrderState>
  setReason: (reason: string | null) => void
  setNotice: SetStateFn<string | null>
  setConfirming: (value: boolean) => void
  mergeHistory: MergeHistoryFn
  prevStatusRef: MutableRefObject<string | null>
  resetBackoff: () => void
  mountedRef: MutableRefObject<boolean>
  dispatchAppliedEvent: () => void
  rateLimitNotice: string
}

function confirmationNotice(_type: OrderType | null | undefined): string {
  return 'Payment confirmed — crediting your points…'
}

export async function confirmOrderActionSol(
  ctx: ConfirmOrderContext,
  signature: string,
): Promise<ConfirmOrderResult> {
  const currentOrderId = ctx.state.orderId
  if (!currentOrderId) {
    ctx.setReason('Create an order first')
    return { ok: false, payload: null }
  }
  const trimmed = String(signature || '').trim()
  if (!trimmed || trimmed.length < 15) {
    ctx.setReason('Enter a valid transaction signature')
    return { ok: false, payload: null }
  }

  ctx.setConfirming(true)
  ctx.setReason(null)
  ctx.setNotice('Retrying manual confirmation…')
  try {
    const resp = await fetch('/api/orders/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ orderId: currentOrderId, signature: trimmed }),
    })
    const json = await resp.json().catch(() => null)
    if (resp.status === 401) {
      notifySessionUnauthorized(json?.reason)
    }
    if (!resp.ok) {
      ctx.setNotice(null)
      ctx.setReason(json?.error || `Confirm failed (${resp.status})`)
      return { ok: false, payload: json, hash: trimmed }
    }

    const nextStatus: OrderStatus =
      json?.status ? String(json.status) : ctx.state.status
    const confirmations =
      typeof json?.confirmations === 'number' && typeof json?.need === 'number'
        ? { have: Number(json.confirmations), need: Number(json.need) }
        : null

    const pointsCreditedRaw =
      json?.pointsCredited ?? json?.points_credited ?? null
    const balanceAfterRaw =
      json?.balanceAfter ?? json?.balance_after ?? null
    const pointsCredited =
      pointsCreditedRaw != null && Number.isFinite(Number(pointsCreditedRaw))
        ? Number(pointsCreditedRaw)
        : null
    const balanceAfter =
      balanceAfterRaw != null && Number.isFinite(Number(balanceAfterRaw))
        ? Number(balanceAfterRaw)
        : null

    ctx.setState((prev) => ({
      ...prev,
      status: nextStatus,
      reason: null,
      signature: trimmed,
      confirmations,
      careDrop: json?.careDrop ?? prev.careDrop ?? null,
      appliedPoints: pointsCredited ?? prev.appliedPoints,
      appliedBalance: balanceAfter ?? prev.appliedBalance,
    }))
    ctx.mergeHistory(currentOrderId, {
      status: nextStatus,
      signature: trimmed,
      reason: null,
      type: ctx.state.type,
      quote: ctx.state.quote,
    })

    if (nextStatus === 'applied') {
      ctx.dispatchAppliedEvent()
      ctx.setNotice('Order applied ✓')
    } else if (nextStatus === 'confirmed') {
      ctx.setNotice(confirmationNotice(ctx.state.type))
    } else {
      ctx.setNotice((prevNotice) =>
        prevNotice === ctx.rateLimitNotice ? null : prevNotice,
      )
    }
    ctx.prevStatusRef.current = nextStatus || ctx.prevStatusRef.current
    ctx.resetBackoff()
    return { ok: true, payload: json, hash: trimmed }
  } catch (err: any) {
    ctx.setNotice(null)
    ctx.setReason(err?.message || 'Confirm failed')
    return { ok: false, payload: null, hash: trimmed }
  } finally {
    if (ctx.mountedRef.current) {
      ctx.setConfirming(false)
    }
  }
}
