"use client"

import { useEffect } from 'react'

import { useGameplayRealtime } from '@/src/client/realtime/gameplay'
import type { UseOrderOptions } from './controllerTypes'
import { useOrderControllerPolling } from './useOrderControllerPolling'
import type { OrderController } from './orderControllerCore'
import { isTerminalStatus } from './orderTypes'

export { isOrderLocked, deriveOrderPhase, canCancelOrder } from './orderControllerCore'
export type { OrderController } from './orderControllerCore'

export function useOrderController(options: UseOrderOptions): OrderController {
  const controller = useOrderControllerPolling(options)
  const gameplay = useGameplayRealtime()

  const { ingestSnapshot, addressCanonical, state } = controller

  useEffect(() => {
    if (!addressCanonical || !state.orderId) return
    const order = gameplay.orders.get(state.orderId)
    if (!order) return
    const orderAddress = order.address ? String(order.address).trim() : ''
    if (orderAddress && orderAddress !== addressCanonical) return

    const nextStatus = typeof order.status === 'string' && order.status.length ? order.status : state.status
    const nextSignature = order.txHash ?? state.signature
    const nextQuote =
      order.quoteAmount != null ? Number(order.quoteAmount) : state.quote
    const nextReason = order.reason ?? state.reason
    const nextAlive = order.previewAliveUrl ?? state.previewAliveUrl
    const nextType = order.type ?? state.type ?? null
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

    ingestSnapshot({
      id: order.id,
      status: nextStatus,
      quote_amount: nextQuote,
      quoteAmount: nextQuote,
      reason: nextReason,
      preview_alive_url: nextAlive,
      previewAliveUrl: nextAlive,
      signature: nextSignature,
      tx_hash: nextSignature,
      type: nextType,
      created_at: nextCreatedAt ?? undefined,
      createdAt: nextCreatedAt ?? undefined,
      updated_at: order.updatedAt ?? undefined,
      updatedAt: order.updatedAt ?? undefined,
    })
  }, [
    addressCanonical,
    gameplay.orders,
    ingestSnapshot,
    state.createdAt,
    state.orderId,
    state.previewAliveUrl,
    state.quote,
    state.reason,
    state.signature,
    state.status,
    state.type,
  ])

  useEffect(() => {
    if (!addressCanonical || state.orderId) return
    const cached = gameplay.ordersByAddress.get(addressCanonical)
    if (!cached || !cached.id) return
    const nextStatus = typeof cached.status === 'string' ? cached.status : ''
    if (!nextStatus || isTerminalStatus(nextStatus)) return

    ingestSnapshot({
      id: cached.id,
      status: nextStatus,
      quote_amount: cached.quoteAmount,
      quoteAmount: cached.quoteAmount,
      reason: cached.reason,
      preview_alive_url: cached.previewAliveUrl,
      previewAliveUrl: cached.previewAliveUrl,
      signature: cached.txHash,
      tx_hash: cached.txHash,
      type: cached.type,
      created_at: cached.createdAt ?? undefined,
      createdAt: cached.createdAt ?? undefined,
      updated_at: cached.updatedAt ?? undefined,
      updatedAt: cached.updatedAt ?? undefined,
    })
  }, [addressCanonical, gameplay.ordersByAddress, ingestSnapshot, state.orderId])

  return controller
}
