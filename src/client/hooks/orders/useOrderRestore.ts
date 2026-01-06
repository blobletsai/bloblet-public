import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { GameplayState } from '@/src/client/realtime/gameplay'
import {
  OrderState,
  OrderHistoryItem,
  OrderType,
  isTerminalStatus,
} from './orderTypes'
import { useOnlineStatus } from '@/src/client/hooks/useOnlineStatus'
import { notifySessionUnauthorized } from '@/src/client/session/sessionManager'

type PreviewState = { alive: string | null }

type Params = {
  addressCanonical: string
  state: OrderState
  setState: Dispatch<SetStateAction<OrderState>>
  mergeHistory: (orderId: number | null, patch: Partial<OrderHistoryItem>) => void
  setLastPreview: Dispatch<SetStateAction<PreviewState>>
  dispatchPreviewEvent: (alive: string | null) => void
  resetBackoff: () => void
  gameplay: GameplayState
  prevStatusRef: MutableRefObject<string | null>
}

export function useOrderRestore({
  addressCanonical,
  state,
  setState,
  mergeHistory,
  setLastPreview,
  dispatchPreviewEvent,
  resetBackoff,
  gameplay,
  prevStatusRef,
}: Params) {
  const isOnline = useOnlineStatus()
  useEffect(() => {
    if (!addressCanonical || state.orderId || !isOnline) return
    // Only attempt restore when realtime is not open AND our cache has no active order
    if (gameplay.connection === 'open') return
    if (gameplay.ordersByAddress.has(addressCanonical)) return
    let cancelled = false
    const restore = async () => {
      try {
        const resp = await fetch('/api/orders/status?latest=1', { credentials: 'same-origin' })
        if (cancelled) return
        if (resp.status === 401) {
          notifySessionUnauthorized('orders_restore')
          return
        }
        if (resp.status === 404) return // no active order; suppress noise
        if (!resp.ok) return
        const json = await resp.json().catch(() => null)
        if (!json || cancelled) return
        const nextStatus = typeof json.status === 'string' ? json.status : ''
        if (!json.id || isTerminalStatus(nextStatus)) return
        const orderId = Number(json.id || 0)
        if (!Number.isFinite(orderId) || orderId <= 0) return
        const quoteAmount =
          json.quote_amount !== undefined && json.quote_amount !== null
            ? Number(json.quote_amount)
            : null
        const createdAt =
          typeof json.created_at === 'string'
            ? json.created_at
            : new Date().toISOString()
        const aliveUrl = json.preview_alive_url || null
        const reason = (json.reason ?? null) as string | null
        const signature = (json.signature ?? null) as string | null
        const type = (json.type ?? null) as OrderType | null

        setState({
          orderId,
          quote: quoteAmount,
          status: nextStatus,
          reason,
          signature,
          previewAliveUrl: aliveUrl,
          confirmations: null,
          type,
          careDrop: null,
          createdAt,
          appliedPoints: null,
          appliedBalance: null,
        })
        mergeHistory(orderId, {
          status: nextStatus,
          reason,
          signature,
          type,
          quote: quoteAmount,
          createdAt,
        })
        setLastPreview({ alive: aliveUrl })
        if (aliveUrl) {
          dispatchPreviewEvent(aliveUrl)
        }
        prevStatusRef.current = nextStatus
        resetBackoff()
      } catch {
        // ignore fallback errors during degraded mode
      }
    }
    restore()
    const timer = setInterval(() => {
      if (!cancelled) {
        restore()
      }
    }, 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [
    addressCanonical,
    gameplay.connection,
    gameplay.ordersByAddress,
    mergeHistory,
    resetBackoff,
    setLastPreview,
    setState,
    state.orderId,
    dispatchPreviewEvent,
    prevStatusRef,
    isOnline,
  ])
}
