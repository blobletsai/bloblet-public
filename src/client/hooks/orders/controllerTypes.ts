import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type {
  OrderState,
  OrderHistoryItem,
  OrderPhase,
  OrderStatus,
  OrderType,
} from '@/src/client/hooks/orders/orderTypes'

export type UseOrderOptions = {
  address: string | null | undefined
  pollIntervalMs?: number
}

export type CreateOrderResult = {
  ok: boolean
  order: Record<string, any> | null
  paymentRequired: boolean
}

export type PayOrderOptions = {
  tokenAddress: string
  treasuryAddress: string
  tokenDecimals: number
  orderId?: number | null
  quoteAmount?: number | null
}

export type ConfirmOrderResult = {
  ok: boolean
  payload: any
  hash?: string | null
}

export type LastPreview = { alive: string | null }

export type MergeHistoryFn = (orderId: number | null, patch: Partial<OrderHistoryItem>) => void

export type SetStateFn<T> = Dispatch<SetStateAction<T>>

export type OrderCommonDeps = {
  setState: Dispatch<SetStateAction<OrderState>>
  mergeHistory: MergeHistoryFn
  setNotice: Dispatch<SetStateAction<string | null>>
  setReason: (reason: string | null) => void
  prevStatusRef: MutableRefObject<string | null>
  mountedRef: MutableRefObject<boolean>
  resetBackoff: () => void
}

export type OrderStateDeps = OrderCommonDeps & {
  getState: () => OrderState
  getActiveOrderId: () => number | null
  isLocked: () => boolean
  getStatus: () => OrderStatus | null
  addressCanonical: string
  setLoading: (value: boolean) => void
  setConfirming: (value: boolean) => void
  setTransferring: (value: boolean) => void
  setLastPreview: Dispatch<SetStateAction<LastPreview>>
}
