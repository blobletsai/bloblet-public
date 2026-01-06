"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useOnlineStatus } from '@/src/client/hooks/useOnlineStatus'
import { getSolanaAddressContext, sanitizeSolanaAddress } from '@/src/shared/address/solana'
import {
  INITIAL_STATE,
  OrderHistoryItem,
  OrderState,
  OrderStatus,
  OrderType,
  isTerminalStatus,
} from './orderTypes'
import {
  MAX_BACKOFF_MS,
  MAX_BACKOFF_STEPS,
  dispatchAppliedEvent,
  dispatchPreviewEvent,
  isOrderLocked,
  mergeHistoryEntries,
  type OrderController,
} from './orderControllerCore'
import { cancelOrderAction } from './actions/cancelOrder'
import { createOrderAction } from './actions/createOrder'
import { confirmOrderActionSol } from '../sol-order/actions/confirmOrder'
import { payOrderActionSol } from '../sol-order/actions/payOrder'
import type { LastPreview, PayOrderOptions, UseOrderOptions } from './controllerTypes'
import { notifySessionUnauthorized } from '@/src/client/session/sessionManager'

const RATE_LIMIT_NOTICE = 'Status endpoint busy — slowing down checks…'
const RESTORE_INTERVAL_MS = 30_000

export function useOrderControllerPolling(options: UseOrderOptions): OrderController {
  const { address, pollIntervalMs = 5000 } = options
  const addressCanonical = useMemo(() => {
    const sanitized = sanitizeSolanaAddress(address || '')
    if (!sanitized) return ''
    try {
      return getSolanaAddressContext(sanitized).canonical
    } catch {
      return sanitized
    }
  }, [address])
  const basePollMs = useMemo(() => Math.max(2500, pollIntervalMs || 5000), [pollIntervalMs])

  const [state, setState] = useState<OrderState>(INITIAL_STATE)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastPreview, setLastPreview] = useState<LastPreview>({ alive: null })
  const [pollDelayMs, setPollDelayMs] = useState(basePollMs)
  const [history, setHistory] = useState<OrderHistoryItem[]>([])

  const mountedRef = useRef(true)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollAttemptRef = useRef(0)
  const prevStatusRef = useRef<string | null>(null)
  const activeOrderIdRef = useRef<number | null>(null)
  const stateRef = useRef(state)

  const isOnline = useOnlineStatus()

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    activeOrderIdRef.current = state.orderId
  }, [state.orderId])

  const bumpBackoff = useCallback(() => {
    pollAttemptRef.current = Math.min(pollAttemptRef.current + 1, MAX_BACKOFF_STEPS)
  }, [])

  const resetBackoff = useCallback(() => {
    pollAttemptRef.current = 0
    if (mountedRef.current) {
      setPollDelayMs(basePollMs)
    }
  }, [basePollMs])

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const schedulePoll = useCallback(
    (pollFn: () => void, options?: { minDelayMs?: number }) => {
      clearPollTimer()
      const minDelay = options?.minDelayMs ?? basePollMs
      const baseDelay = Math.max(basePollMs, minDelay)
      const delay = Math.min(
        MAX_BACKOFF_MS,
        Math.max(minDelay, Math.round(baseDelay * Math.pow(1.5, pollAttemptRef.current))),
      )
      if (mountedRef.current) {
        setPollDelayMs(delay)
      }
      pollTimerRef.current = setTimeout(pollFn, delay)
    },
    [basePollMs, clearPollTimer],
  )

  const mergeHistory = useCallback(
    (orderId: number | null, patch: Partial<OrderHistoryItem>) => {
      if (!orderId) return
      setHistory((prev) => mergeHistoryEntries(prev, orderId, patch))
    },
    [setHistory],
  )

  const ingestSnapshot = useCallback(
    (raw: Record<string, any> | null | undefined) => {
      if (!raw) return false
      const orderId = Number(raw.id ?? raw.orderId ?? 0)
      if (!Number.isFinite(orderId) || orderId <= 0) return false
      const status = typeof raw.status === 'string' ? raw.status : stateRef.current.status
      const quoteAmount =
        raw.quote_amount != null
          ? Number(raw.quote_amount)
          : raw.quoteAmount != null
          ? Number(raw.quoteAmount)
          : stateRef.current.quote
      const reason =
        typeof raw.reason === 'string' || raw.reason === null ? raw.reason : stateRef.current.reason
      const signature =
        typeof raw.signature === 'string' && raw.signature.length
          ? raw.signature
          : typeof raw.tx_hash === 'string' && raw.tx_hash.length
          ? raw.tx_hash
          : stateRef.current.signature
      const previewAliveUrl =
        typeof raw.preview_alive_url === 'string'
          ? raw.preview_alive_url
          : typeof raw.previewAliveUrl === 'string'
          ? raw.previewAliveUrl
          : stateRef.current.previewAliveUrl
      const type =
        typeof raw.type === 'string'
          ? (raw.type as OrderType)
          : (stateRef.current.type as OrderType | null)
      const createdAt =
        typeof raw.created_at === 'string'
          ? raw.created_at
          : typeof raw.createdAt === 'string'
          ? raw.createdAt
          : stateRef.current.createdAt

      setState((prev) => ({
        ...prev,
        orderId,
        quote: quoteAmount,
        status,
        reason,
        signature,
        previewAliveUrl,
        type,
        createdAt,
      }))
      mergeHistory(orderId, {
        status,
        reason,
        signature: signature ?? undefined,
        type,
        quote: quoteAmount ?? undefined,
        createdAt: createdAt ?? undefined,
      })
      setLastPreview({ alive: previewAliveUrl })
      if (previewAliveUrl) {
        dispatchPreviewEvent(previewAliveUrl)
      }
      prevStatusRef.current = status
      resetBackoff()
      clearPollTimer()
      return true
    },
    [clearPollTimer, mergeHistory, resetBackoff],
  )

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
    setHistory([])
    setLoading(false)
    setConfirming(false)
    setTransferring(false)
    setNotice(null)
    setLastPreview({ alive: null })
    prevStatusRef.current = null
    resetBackoff()
    clearPollTimer()
  }, [clearPollTimer, resetBackoff])

  const setReason = useCallback(
    (reason: string | null) => {
      if (activeOrderIdRef.current) {
        mergeHistory(activeOrderIdRef.current, { reason })
      }
      setState((prev) => ({ ...prev, reason }))
    },
    [mergeHistory],
  )

  const setStatus = useCallback(
    (status: OrderStatus) => {
      if (activeOrderIdRef.current) {
        mergeHistory(activeOrderIdRef.current, { status })
      }
      setState((prev) => ({ ...prev, status }))
    },
    [mergeHistory],
  )

  const createOrder = useCallback(
    (params: Record<string, any>) =>
      createOrderAction(
        {
          addressCanonical,
          isLocked: () => isOrderLocked(stateRef.current),
          getActiveOrderId: () => activeOrderIdRef.current,
          getStatus: () => stateRef.current?.status ?? null,
          setState,
          setReason,
          setNotice,
          setLoading,
          mergeHistory,
          resetBackoff,
          setLastPreview,
          prevStatusRef,
          mountedRef,
        },
        params,
      ),
    [
      addressCanonical,
      mergeHistory,
      resetBackoff,
      setReason,
      setNotice,
      setLoading,
      setLastPreview,
    ],
  )

  const confirmOrder = useCallback(
    (txHash: string) => {
      return confirmOrderActionSol(
        {
          state,
          setState,
          setReason,
          setNotice,
          setConfirming,
          mergeHistory,
          prevStatusRef,
          resetBackoff,
          mountedRef,
          dispatchAppliedEvent,
          rateLimitNotice: RATE_LIMIT_NOTICE,
        },
        txHash,
      )
    },
    [mergeHistory, mountedRef, resetBackoff, setNotice, setReason, state],
  )

  // Auto-confirm once a signature exists (Solana path), so users don’t need to click retry.
  const lastAutoConfirmedSigRef = useRef<string | null>(null)
  const pendingConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingConfirmTimer = useCallback(() => {
    if (pendingConfirmTimerRef.current) {
      clearTimeout(pendingConfirmTimerRef.current)
      pendingConfirmTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const sig = state.signature || null
    const status = (state.status || '').toLowerCase()
    const confirmations = state.confirmations

    if (!sig) {
      clearPendingConfirmTimer()
      lastAutoConfirmedSigRef.current = null
      return
    }

    if (status === 'applied' || status === 'confirmed') {
      clearPendingConfirmTimer()
      lastAutoConfirmedSigRef.current = sig
      return
    }

    const need = confirmations?.need ?? 1
    const have = confirmations?.have ?? 0
    if (have >= need) {
      clearPendingConfirmTimer()
      return
    }

    if (!pendingConfirmTimerRef.current) {
      const attemptConfirm = () => {
        pendingConfirmTimerRef.current = null
        confirmOrder(sig).catch(() => {
          // ignore; we'll schedule another attempt below
        })
        pendingConfirmTimerRef.current = setTimeout(attemptConfirm, 10_000)
      }

      // Kick off immediately if no prior attempt, otherwise reuse loop.
      if (lastAutoConfirmedSigRef.current !== sig) {
        lastAutoConfirmedSigRef.current = sig
        confirmOrder(sig).catch(() => {
          /* swallow; timer below will retry */
        })
      }
      pendingConfirmTimerRef.current = setTimeout(attemptConfirm, 10_000)
    }
  }, [clearPendingConfirmTimer, confirmOrder, state.confirmations, state.signature, state.status])

  useEffect(() => () => {
    clearPendingConfirmTimer()
  }, [clearPendingConfirmTimer])

  const cancelOrder = useCallback(
    () =>
      cancelOrderAction({
        state,
        setState,
        setReason,
        setNotice,
        mergeHistory,
        reset,
        mountedRef,
      }),
    [mergeHistory, mountedRef, reset, setNotice, setReason, state],
  )

  const payOrder = useCallback(
    (options: PayOrderOptions) =>
      payOrderActionSol(
        {
          state,
          isTransferring: () => transferring,
          setTransferring,
          setReason,
          setNotice,
          setState,
          mergeHistory,
          resetBackoff,
          prevStatusRef,
          mountedRef,
        },
        options,
      ),
    [mergeHistory, mountedRef, resetBackoff, setReason, setNotice, state, transferring],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearPollTimer()
    }
  }, [clearPollTimer])

  useEffect(() => {
    if (mountedRef.current) {
      setPollDelayMs(basePollMs)
    }
  }, [basePollMs])

  useEffect(() => {
    const status = (state.status || '').toLowerCase()
    let clearTimer: ReturnType<typeof setTimeout> | null = null
    if (status === 'generated') {
      setNotice('Preview ready — finalize to apply.')
    } else if (status === 'applied') {
      setNotice('Order applied ✓')
      clearTimer = setTimeout(() => {
        if (mountedRef.current) {
          setNotice(null)
        }
      }, 3500)
    }
    return () => {
      if (clearTimer) clearTimeout(clearTimer)
    }
  }, [state.status])

  useEffect(() => {
    if (!addressCanonical || state.orderId || !isOnline) return
    let cancelled = false

    const restore = async () => {
      try {
        const resp = await fetch('/api/orders/status?latest=1', { credentials: 'same-origin' })
        if (cancelled) return
        if (resp.status === 401) {
          notifySessionUnauthorized('orders_status_restore')
          return
        }
        if (resp.status === 404) return
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
        // ignore restore errors during polling mode
      }
    }

    restore()
    const timer = window.setInterval(() => {
      if (!cancelled) {
        restore()
      }
    }, RESTORE_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [addressCanonical, isOnline, mergeHistory, resetBackoff, state.orderId])

  useEffect(() => {
    if (!addressCanonical || !state.orderId) return
    let cancelled = false
    const activeOrderId = state.orderId

    const poll = async () => {
      if (cancelled) return
      let shouldContinue = true
      try {
        const resp = await fetch(`/api/orders/status?id=${activeOrderId}`, {
          credentials: 'same-origin',
        })
        if (resp.status === 401) {
          notifySessionUnauthorized('orders_status_poll')
          return
        }
        if (resp.status === 429) {
          setNotice(RATE_LIMIT_NOTICE)
          bumpBackoff()
          schedulePoll(poll, { minDelayMs: 30000 })
          return
        }
        if (!resp.ok) {
          bumpBackoff()
          schedulePoll(poll)
          return
        }
        const json = await resp.json().catch(() => null)
        if (!json || cancelled) return

        setNotice((prev) => (prev === RATE_LIMIT_NOTICE ? null : prev))

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
            : stateRef.current.signature || null
        mergeHistory(activeOrderId, {
          status: typeof json.status === 'string' ? json.status : undefined,
          reason: (json.reason ?? null) as string | null,
          signature: mergedSignature ?? undefined,
          type: stateRef.current.type,
          quote: stateRef.current.quote,
          createdAt: stateRef.current.createdAt ?? undefined,
        })

        if (nextAliveUrl !== lastPreview.alive) {
          setLastPreview({ alive: nextAliveUrl })
          if (nextAliveUrl) {
            dispatchPreviewEvent(nextAliveUrl)
          }
        }

        const nextStatus =
          typeof json.status === 'string' ? json.status : prevStatusRef.current || stateRef.current.status
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
          schedulePoll(poll)
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
    bumpBackoff,
    clearPollTimer,
    lastPreview.alive,
    mergeHistory,
    resetBackoff,
    schedulePoll,
    setNotice,
    state.orderId,
  ])

  return {
    state,
    history,
    notice,
    pollDelayMs,
    loading,
    confirming,
    transferring,
    createOrder,
    payOrder,
    confirmOrder,
    cancelOrder,
    reset,
    setReason,
    setStatus,
    setNotice,
    ingestSnapshot,
    addressCanonical,
  }
}
