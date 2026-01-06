import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { GameplayState } from '@/src/client/realtime/gameplay'
import { OrderState, OrderHistoryItem, isTerminalStatus } from './orderTypes'
import { notifySessionUnauthorized } from '@/src/client/session/sessionManager'

type PreviewState = { alive: string | null }

type Params = {
  addressCanonical: string
  state: OrderState
  setState: Dispatch<SetStateAction<OrderState>>
  mergeHistory: (orderId: number | null, patch: Partial<OrderHistoryItem>) => void
  lastPreview: PreviewState
  setLastPreview: Dispatch<SetStateAction<PreviewState>>
  gameplay: GameplayState
  clearPollTimer: () => void
  schedulePoll: (pollFn: () => void, options?: { minDelayMs?: number }) => void
  bumpBackoff: () => void
  resetBackoff: () => void
  setNotice: (value: string | null | ((prev: string | null) => string | null)) => void
  dispatchPreviewEvent: (alive: string | null) => void
  dispatchAppliedEvent: () => void
  rateLimitNotice: string
  prevStatusRef: MutableRefObject<string | null>
}

export function useOrderPollingFallback({
  addressCanonical,
  state,
  setState,
  mergeHistory,
  lastPreview,
  setLastPreview,
  gameplay,
  clearPollTimer,
  schedulePoll,
  bumpBackoff,
  resetBackoff,
  setNotice,
  dispatchPreviewEvent,
    dispatchAppliedEvent,
    rateLimitNotice,
    prevStatusRef,
}: Params) {
  useEffect(() => {
    if (!state.orderId || !addressCanonical) return
    if (gameplay.connection === 'open') {
      clearPollTimer()
      return
    }
    let cancelled = false
    const activeOrderId = state.orderId

    const poll = async () => {
      if (cancelled) return
      let shouldContinue = true
      try {
        const resp = await fetch(`/api/orders/status?id=${activeOrderId}`, { credentials: 'same-origin' })
        if (resp.status === 401) {
          notifySessionUnauthorized('orders_status_fallback')
          return
        }
        if (resp.status === 429) {
          setNotice(rateLimitNotice)
          bumpBackoff()
          return
        }
        if (!resp.ok) {
          bumpBackoff()
          return
        }
        const json = await resp.json().catch(() => null)
        if (!json || cancelled) return

        setNotice((prev) => (prev === rateLimitNotice ? null : prev))

        const nextAliveUrl = json.preview_alive_url || null
        setState((prev) => ({
          ...prev,
          status: typeof json.status === 'string' ? json.status : prev.status,
          reason: (json.reason ?? null) as string | null,
          signature: (json.signature ?? prev.signature) || null,
          previewAliveUrl: nextAliveUrl,
        }))
        const mergedSignature =
          typeof json.signature === 'string' && json.signature
            ? json.signature
            : state.signature || null
        mergeHistory(activeOrderId, {
          status: typeof json.status === 'string' ? json.status : undefined,
          reason: (json.reason ?? null) as string | null,
          signature: mergedSignature,
          type: state.type,
          quote: state.quote,
          createdAt: state.createdAt,
        })

        if (nextAliveUrl !== lastPreview.alive) {
          setLastPreview({ alive: nextAliveUrl })
          if (nextAliveUrl) {
            dispatchPreviewEvent(nextAliveUrl)
          }
        }

        const nextStatus = typeof json.status === 'string' ? json.status : (prevStatusRef.current || state.status)
        if (nextStatus === 'applied') {
          dispatchAppliedEvent()
        }
        if (nextStatus && nextStatus !== prevStatusRef.current) {
          resetBackoff()
          prevStatusRef.current = nextStatus
        } else {
          bumpBackoff()
        }
        if (nextStatus && isTerminalStatus(nextStatus)) {
          shouldContinue = false
          clearPollTimer()
        }
      } catch {
        bumpBackoff()
      } finally {
        if (!cancelled && shouldContinue) {
          schedulePoll(poll, { minDelayMs: 30000 })
        }
      }
    }

    poll()
    return () => {
      cancelled = true
      clearPollTimer()
    }
  }, [
    addressCanonical,
    clearPollTimer,
    gameplay.connection,
    schedulePoll,
    setNotice,
    state.orderId,
    state.signature,
    state.status,
    state.quote,
    state.type,
    state.createdAt,
    bumpBackoff,
    mergeHistory,
    lastPreview.alive,
    setLastPreview,
    resetBackoff,
    setState,
    dispatchPreviewEvent,
    dispatchAppliedEvent,
    rateLimitNotice,
    prevStatusRef,
  ])
}
