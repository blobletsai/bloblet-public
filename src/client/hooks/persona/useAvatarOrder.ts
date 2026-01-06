"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isTerminalStatus, normalizeStatus } from '@/src/client/hooks/orders/orderTypes'
import { useClientEventPublisher } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

export type AvatarOrderSnapshot = {
  id: number
  status: string | null
  quoteAmount: number | null
  previewAliveUrl: string | null
  reason: string | null
  createdAt: string | null
  updatedAt: string | null
  appliedAt: string | null
  signature: string | null
  retryCount: number
  lastError: string | null
  aliveReadyAt: string | null
}

const ACTIVE_ORDER_POLL_MS = 20000
const MAX_POLLS = 180 // 1 hour at 20 second intervals

function toNumber(value: any): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function parseAvatarOrderSnapshot(raw: any): AvatarOrderSnapshot | null {
  if (!raw) return null
  const id = toNumber(raw.id ?? raw.orderId)
  if (!id || id <= 0) return null

  const status =
    typeof raw.status === 'string'
      ? raw.status
      : typeof raw.orderStatus === 'string'
      ? raw.orderStatus
      : null

  const quoteAmount = toNumber(raw.quote_amount ?? raw.quoteAmount ?? raw.quote)
  const previewAliveUrl = raw.preview_alive_url ?? raw.previewAliveUrl ?? null
  const reason =
    typeof raw.reason === 'string' ? raw.reason : typeof raw.error === 'string' ? raw.error : null
  const createdAt =
    typeof raw.created_at === 'string'
      ? raw.created_at
      : typeof raw.createdAt === 'string'
      ? raw.createdAt
      : null
  const updatedAt =
    typeof raw.updated_at === 'string'
      ? raw.updated_at
      : typeof raw.updatedAt === 'string'
      ? raw.updatedAt
      : createdAt
  const appliedAt =
    typeof raw.applied_at === 'string'
      ? raw.applied_at
      : typeof raw.appliedAt === 'string'
      ? raw.appliedAt
      : null
  const signature =
    typeof raw.signature === 'string'
      ? raw.signature
      : typeof raw.tx_hash === 'string'
      ? raw.tx_hash
      : null
  const retryCountRaw =
    typeof raw.retry_count === 'number'
      ? raw.retry_count
      : typeof raw.retryCount === 'number'
      ? raw.retryCount
      : null
  const retryCount = Number.isFinite(retryCountRaw) ? Math.max(0, Number(retryCountRaw)) : 0
  const lastError =
    typeof raw.last_error === 'string'
      ? raw.last_error
      : typeof raw.lastError === 'string'
      ? raw.lastError
      : null
  const aliveReadyAt =
    typeof raw.alive_ready_at === 'string'
      ? raw.alive_ready_at
      : typeof raw.aliveReadyAt === 'string'
      ? raw.aliveReadyAt
      : null
  return {
    id,
    status,
    quoteAmount,
    previewAliveUrl: previewAliveUrl || null,
    reason,
    createdAt,
    updatedAt,
    appliedAt,
    signature,
    retryCount,
    lastError,
    aliveReadyAt,
  }
}

type UseAvatarOrderOptions = {
  address?: string | null
}

type UseAvatarOrderResult = {
  order: AvatarOrderSnapshot | null
  tracking: boolean
  refreshing: boolean
  beginTracking: (raw: any) => AvatarOrderSnapshot | null
  refreshStatus: () => Promise<AvatarOrderSnapshot | null>
  reset: () => void
}

export function useAvatarOrder({ address }: UseAvatarOrderOptions): UseAvatarOrderResult {
  const [order, setOrder] = useState<AvatarOrderSnapshot | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const pollTimerRef = useRef<number | null>(null)
  const pendingRef = useRef(false)
  const lastStatusRef = useRef<string | null>(null)
  const lastPreviewRef = useRef<string | null>(null)
  const eventPublisher = useClientEventPublisher()

  const addressCanonical = useMemo(
    () => (address ? address.trim() : null),
    [address],
  )

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const stopTracking = useCallback(() => {
    clearPollTimer()
    setOrder(null)
    setRefreshing(false)
    lastStatusRef.current = null
    lastPreviewRef.current = null
  }, [clearPollTimer])

  const updateOrder = useCallback((snapshot: AvatarOrderSnapshot | null) => {
    if (!snapshot) {
      stopTracking()
      return
    }
    setOrder(snapshot)
    const statusNormalized = normalizeStatus(snapshot.status)
    const alive = snapshot.previewAliveUrl ?? null

    if (alive !== lastPreviewRef.current) {
      lastPreviewRef.current = alive
      if (alive) {
        eventPublisher.emit(CLIENT_EVENT.ORDER_PREVIEW, { alive })
      }
    }

    if (statusNormalized === 'applied' && lastStatusRef.current !== 'applied') {
      eventPublisher.emit(CLIENT_EVENT.ORDER_APPLIED, {
        type: 'avatar_custom',
        orderId: snapshot.id,
      })
    }
    lastStatusRef.current = statusNormalized
  }, [eventPublisher, stopTracking])

  const beginTracking = useCallback(
    (raw: any) => {
      const snapshot = parseAvatarOrderSnapshot(raw)
      updateOrder(snapshot)
      return snapshot
    },
    [updateOrder],
  )

  const refreshStatus = useCallback(async () => {
    if (!order || pendingRef.current) return order
    const orderId = order.id
    if (!orderId) return order
    pendingRef.current = true
    setRefreshing(true)
    try {
      const resp = await fetch(`/api/orders/status?id=${orderId}`, { credentials: 'same-origin' })
      if (resp.status === 404) {
        updateOrder(null)
        return null
      }
      if (!resp.ok) return order
      const json = await resp.json().catch(() => null)
      if (!json) return order
      const snapshot = parseAvatarOrderSnapshot(json)
      updateOrder(snapshot)
      return snapshot
    } catch {
      return order
    } finally {
      pendingRef.current = false
      setRefreshing(false)
    }
  }, [order, updateOrder])

  useEffect(() => {
    clearPollTimer()
    if (!addressCanonical) {
      stopTracking()
      return
    }
    // When address changes, do not auto-fetch status; stay idle until user creates or refreshes.
    stopTracking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressCanonical])

  useEffect(() => {
    return () => {
      clearPollTimer()
    }
  }, [clearPollTimer])

  // Reset poll count when order changes
  useEffect(() => {
    setPollCount(0)
  }, [order?.id])

  useEffect(() => {
    clearPollTimer()
    if (!order) return
    if (isTerminalStatus(order.status)) return

    // Stop polling after MAX_POLLS attempts
    if (pollCount >= MAX_POLLS) {
      console.warn('[useAvatarOrder] Max polls reached, order may be stuck:', order.id)
      return
    }

    let cancelled = false

    pollTimerRef.current = window.setTimeout(() => {
      if (!cancelled) {
        setPollCount((c) => c + 1)
        void refreshStatus()
      }
    }, ACTIVE_ORDER_POLL_MS)

    return () => {
      cancelled = true
      clearPollTimer()
    }
  }, [order, clearPollTimer, refreshStatus, pollCount])

  const tracking = useMemo(() => Boolean(order && !isTerminalStatus(order.status)), [order])

  return {
    order,
    tracking,
    refreshing,
    beginTracking,
    refreshStatus,
    reset: stopTracking,
  }
}
