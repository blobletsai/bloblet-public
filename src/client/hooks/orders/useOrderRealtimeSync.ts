import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { GameplayState } from '@/src/client/realtime/gameplay'
import {
  OrderState,
  OrderHistoryItem,
  OrderType,
  isTerminalStatus,
} from './orderTypes'

type PreviewState = { alive: string | null }

type Params = {
  addressCanonical: string
  state: OrderState
  setState: Dispatch<SetStateAction<OrderState>>
  mergeHistory: (orderId: number | null, patch: Partial<OrderHistoryItem>) => void
  lastPreview: PreviewState
  setLastPreview: Dispatch<SetStateAction<PreviewState>>
  resetBackoff: () => void
  clearPollTimer: () => void
  gameplay: GameplayState
  dispatchPreviewEvent: (alive: string | null) => void
  prevStatusRef: MutableRefObject<string | null>
}

export function useOrderRealtimeSync({
  addressCanonical,
  state,
  setState,
  mergeHistory,
  lastPreview,
  setLastPreview,
  resetBackoff,
  clearPollTimer,
  gameplay,
  dispatchPreviewEvent,
  prevStatusRef,
}: Params) {
  useEffect(() => {
    if (!addressCanonical) return
    if (!state.orderId) return
    const order = gameplay.orders.get(state.orderId)
    if (!order) return
    const orderAddress = order.address ? String(order.address).trim() : ''
    if (orderAddress && orderAddress !== addressCanonical) return
    const nextStatus = typeof order.status === 'string' && order.status.length ? order.status : state.status
    const nextSignature = order.txHash ?? state.signature
    const nextQuote = order.quoteAmount != null ? Number(order.quoteAmount) : state.quote
    const nextReason = order.reason ?? state.reason
    const nextAlive = order.previewAliveUrl ?? state.previewAliveUrl
    const nextType = (order.type ?? state.type ?? null) as OrderType | null
    const nextCreatedAt = order.createdAt ?? state.createdAt
    const shouldUpdate =
      nextStatus !== state.status ||
      nextSignature !== state.signature ||
      (nextQuote != null && nextQuote !== state.quote) ||
      nextReason !== state.reason ||
      nextAlive !== state.previewAliveUrl ||
      nextType !== state.type ||
      nextCreatedAt !== state.createdAt

    if (!shouldUpdate) return

    setState((prev) => ({
      ...prev,
      status: nextStatus,
      signature: nextSignature ?? prev.signature,
      quote: nextQuote ?? prev.quote,
      reason: nextReason,
      previewAliveUrl: nextAlive,
      type: nextType,
      createdAt: nextCreatedAt,
    }))
    mergeHistory(state.orderId, {
      status: nextStatus,
      signature: nextSignature ?? undefined,
      quote: nextQuote ?? undefined,
      reason: nextReason,
      type: nextType,
      createdAt: nextCreatedAt ?? undefined,
      updatedAt: order.updatedAt ?? new Date().toISOString(),
    })
    if (nextAlive !== lastPreview.alive) {
      setLastPreview({ alive: nextAlive })
      if (nextAlive) {
        dispatchPreviewEvent(nextAlive)
      }
    }
    prevStatusRef.current = nextStatus
    resetBackoff()
    clearPollTimer()
  }, [
    addressCanonical,
    clearPollTimer,
    gameplay.orders,
    lastPreview.alive,
    mergeHistory,
    resetBackoff,
    setLastPreview,
    setState,
    state.createdAt,
    state.appliedBalance,
    state.appliedPoints,
    state.orderId,
    state.previewAliveUrl,
    state.quote,
    state.reason,
    state.signature,
    state.status,
    state.type,
    dispatchPreviewEvent,
    prevStatusRef,
  ])

  useEffect(() => {
    if (!addressCanonical || state.orderId) return
    const cached = gameplay.ordersByAddress.get(addressCanonical)
    if (!cached || !cached.id) return
    const nextStatus = typeof cached.status === 'string' ? cached.status : ''
    if (!nextStatus || isTerminalStatus(nextStatus)) return
    const orderId = Number(cached.id || 0)
    if (!Number.isFinite(orderId) || orderId <= 0) return
    const quoteAmount = cached.quoteAmount != null ? Number(cached.quoteAmount) : null
    const aliveUrl = cached.previewAliveUrl ?? null
    const reason = cached.reason ?? null
    const createdAt = cached.createdAt ?? new Date().toISOString()
    const type = (cached.type ?? null) as OrderType | null

    setState({
      orderId,
      quote: quoteAmount,
      status: nextStatus,
      reason,
      signature: cached.txHash ?? null,
      previewAliveUrl: aliveUrl,
      confirmations: null,
      type,
      careDrop: null,
      createdAt,
      appliedPoints: state.appliedPoints,
      appliedBalance: state.appliedBalance,
    })
    mergeHistory(orderId, {
      status: nextStatus,
      reason,
      signature: cached.txHash ?? null,
      type,
      quote: quoteAmount,
      createdAt,
      updatedAt: cached.updatedAt ?? createdAt,
    })
    setLastPreview({ alive: aliveUrl })
    if (aliveUrl) {
      dispatchPreviewEvent(aliveUrl)
    }
    prevStatusRef.current = nextStatus
    resetBackoff()
  }, [
    addressCanonical,
    gameplay.ordersByAddress,
    mergeHistory,
    resetBackoff,
    setLastPreview,
    setState,
    state.orderId,
    state.appliedBalance,
    state.appliedPoints,
    dispatchPreviewEvent,
    prevStatusRef,
  ])
}
