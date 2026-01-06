"use client"

import { useMemo } from 'react'

import type {
  OrderHistoryItem,
  OrderPhase,
  OrderState,
  OrderStatus,
} from '@/src/client/hooks/orders/orderTypes'
import type {
  ConfirmOrderResult,
  CreateOrderResult,
  PayOrderOptions,
  UseOrderOptions,
} from './orders/controllerTypes'
import {
  canCancelOrder,
  deriveOrderPhase,
  isOrderLocked,
  type OrderController,
} from './orders/orderControllerCore'
import { useOrderControllerPolling } from './orders/useOrderControllerPolling'

export type UseMarketOrderResult = {
  state: OrderState
  loading: boolean
  confirming: boolean
  transferring: boolean
  notice: string | null
  pollDelayMs: number
  history: OrderHistoryItem[]
  locked: boolean
  canCancel: boolean
  phase: OrderPhase
  createOrder: (params: Record<string, any>) => Promise<CreateOrderResult>
  payOrder: (options: PayOrderOptions) => Promise<{ ok: boolean; hash: string | null }>
  confirmOrder: (txHash: string) => Promise<ConfirmOrderResult>
  cancelOrder: () => Promise<{ ok: boolean }>
  reset: () => void
  setReason: (reason: string | null) => void
  setStatus: (status: OrderStatus) => void
  setNotice: (notice: string | null) => void
  controller: OrderController
}

export function useMarketOrder(options: UseOrderOptions): UseMarketOrderResult {
  const controller = useOrderControllerPolling(options)

  const locked = useMemo(() => isOrderLocked(controller.state), [controller.state])
  const phase = useMemo(
    () => deriveOrderPhase(controller.state, controller.confirming, controller.transferring),
    [controller.state, controller.confirming, controller.transferring],
  )
  const canCancel = useMemo(() => canCancelOrder(controller.state), [controller.state])

  return {
    state: controller.state,
    loading: controller.loading,
    confirming: controller.confirming,
    transferring: controller.transferring,
    notice: controller.notice,
    pollDelayMs: controller.pollDelayMs,
    history: controller.history,
    locked,
    canCancel,
    phase,
    createOrder: controller.createOrder,
    payOrder: controller.payOrder,
    confirmOrder: controller.confirmOrder,
    cancelOrder: controller.cancelOrder,
    reset: controller.reset,
    setReason: controller.setReason,
    setStatus: controller.setStatus,
    setNotice: controller.setNotice,
    controller,
  }
}

export default useMarketOrder
