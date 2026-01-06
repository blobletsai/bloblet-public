"use client"

import {
  HISTORY_LIMIT,
  OrderHistoryItem,
  OrderPhase,
  OrderState,
  OrderStatus,
  OrderType,
  TERMINAL_STATUSES,
  isTerminalStatus,
  normalizeStatus,
} from './orderTypes'
import type {
  ConfirmOrderResult,
  CreateOrderResult,
  PayOrderOptions,
  UseOrderOptions,
} from './controllerTypes'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

export const MAX_BACKOFF_MS = 60_000
export const MAX_BACKOFF_STEPS = 6

export function dispatchAppliedEvent(): void {
  emitClientEvent(CLIENT_EVENT.ORDER_APPLIED, {})
}

export function dispatchPreviewEvent(alive: string | null): void {
  emitClientEvent(CLIENT_EVENT.ORDER_PREVIEW, { alive: alive === null ? null : alive })
}

export function mergeHistoryEntries(
  history: OrderHistoryItem[],
  orderId: number | null,
  patch: Partial<OrderHistoryItem>,
): OrderHistoryItem[] {
  if (!orderId) return history
  const id = Number(orderId)
  if (!Number.isFinite(id) || id <= 0) return history

  const nowIso = new Date().toISOString()
  const next = [...history]
  const idx = next.findIndex((entry) => entry.id === id)

  if (idx === -1) {
    const status =
      typeof patch.status === 'string' && patch.status.length
        ? (patch.status as OrderStatus)
        : ('pending' as OrderStatus)
    const entry: OrderHistoryItem = {
      id,
      status,
      type: (patch.type ?? null) as OrderType | null,
      quote: patch.quote ?? null,
      signature: patch.signature ?? null,
      reason: patch.reason ?? null,
      createdAt: patch.createdAt ?? nowIso,
      updatedAt: patch.updatedAt ?? nowIso,
    }
    return [entry, ...next].slice(0, HISTORY_LIMIT)
  }

  const existing = next[idx] as OrderHistoryItem
  const updated: OrderHistoryItem = {
    ...existing,
    ...patch,
    status: (patch.status ?? existing.status) as OrderStatus,
    type: (patch.type ?? existing.type) as OrderType | null,
    quote: patch.quote ?? existing.quote,
    signature: patch.signature ?? existing.signature,
    reason: patch.reason !== undefined ? patch.reason : existing.reason,
    createdAt: patch.createdAt ?? existing.createdAt,
    updatedAt: patch.updatedAt ?? nowIso,
  }
  next[idx] = updated
  return next.slice(0, HISTORY_LIMIT)
}

export function deriveOrderPhase(
  state: OrderState,
  confirming: boolean,
  transferring: boolean,
): OrderPhase {
  const statusLower = normalizeStatus(state.status)
  if (statusLower === 'applied') return 'applied'
  if (statusLower === 'applying' || statusLower === 'finalizing') return 'applying'
  if (statusLower === 'generated' || statusLower === 'generating') return 'applying'
  if (statusLower === 'expired') return 'expired'
  if (statusLower === 'rejected') return 'rejected'
  if (statusLower === 'confirmed') return 'confirming_payment'
  if (state.signature || confirming || transferring) {
    return 'confirming_payment'
  }
  return 'awaiting_payment'
}

export function canCancelOrder(state: OrderState): boolean {
  if (!state.orderId) return false
  const status = normalizeStatus(state.status)
  if (TERMINAL_STATUSES.has(status)) return false
  return true
}

export function isOrderLocked(state: OrderState): boolean {
  if (!state.orderId) return false
  return !isTerminalStatus(state.status)
}

export interface OrderController {
  state: OrderState
  history: OrderHistoryItem[]
  notice: string | null
  pollDelayMs: number
  loading: boolean
  confirming: boolean
  transferring: boolean
  createOrder: (params: Record<string, any>, overrideType?: OrderType) => Promise<CreateOrderResult>
  payOrder: (options: PayOrderOptions) => Promise<{ ok: boolean; hash: string | null }>
  confirmOrder: (txHash: string) => Promise<ConfirmOrderResult>
  cancelOrder: () => Promise<{ ok: boolean }>
  reset: () => void
  setReason: (reason: string | null) => void
  setStatus: (status: OrderStatus) => void
  setNotice: (notice: string | null) => void
  ingestSnapshot: (snapshot: Record<string, any> | null | undefined) => boolean
  addressCanonical: string
}

export type OrderControllerFactory = (options: UseOrderOptions) => OrderController
