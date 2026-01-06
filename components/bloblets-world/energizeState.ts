"use client"

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { fetchPlayerStatusSnapshot, primePlayerStatusCache } from '@/src/client/hooks/usePlayerStatus'
import { emitClientEvent, useClientEventBus } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

export type EnergizeUiState = {
  state: 'covered' | 'cooldown' | 'ready'
  boosterLevel: number
  boostersActiveUntil: string | null
  cooldownEndsAt: string | null
  overdue: boolean
  lastEnergizeAt: string | null
  energizeCost: number | null
  consumedOrder: { id: number; txHash: string | null } | null
  dropAcc: number
  fastForwardEligible: boolean
  fastForwardDebtUntil: string | null
  fastForwardBurstsRemaining: number
  fastForwardIsNewcomer: boolean
}

export type EnergizeAlert = { message: string; until: number } | null

interface EnergizeStateOptions {
  energizeUiRef: MutableRefObject<EnergizeUiState>
  pendingEnergizeActionRef: MutableRefObject<string | null>
  setEnergizeUi: Dispatch<SetStateAction<EnergizeUiState>>
  setEnergizeAlert: Dispatch<SetStateAction<EnergizeAlert>>
  energizeAlert: EnergizeAlert
  enabled?: boolean
}

export function emptyEnergizeUi(): EnergizeUiState {
  return {
    state: 'ready',
    boosterLevel: 0,
    boostersActiveUntil: null,
    cooldownEndsAt: null,
    overdue: false,
    lastEnergizeAt: null,
    energizeCost: null,
    consumedOrder: null,
    dropAcc: 0,
    fastForwardEligible: false,
    fastForwardDebtUntil: null,
    fastForwardBurstsRemaining: 0,
    fastForwardIsNewcomer: false,
  }
}

function parseConsumedOrder(raw: any): { id: number; txHash: string | null } | null {
  if (!raw || typeof raw !== 'object') return null
  const id = Number(raw.id ?? raw.orderId)
  if (!Number.isFinite(id) || id <= 0) return null
  const txHash = raw.txHash != null ? String(raw.txHash || '') || null : null
  return {
    id,
    txHash,
  }
}

export function toEnergizeUiState(raw: any, previous?: EnergizeUiState): EnergizeUiState {
  if (!raw || typeof raw !== 'object') return previous ?? emptyEnergizeUi()
  const status = raw.status && typeof raw.status === 'object' ? raw.status : raw
  const state =
    status.state === 'covered'
      ? 'covered'
      : status.state === 'cooldown'
      ? 'cooldown'
      : 'ready'
  const boostersActiveUntil = status.boostersActiveUntil ?? null
  const cooldownEndsAt = status.cooldownEndsAt ?? null
  const lastEnergizeAt = status.lastEnergizedAt ?? status.lastChargedAt ?? status.lastChargeAt ?? null
  const energizeCostValue =
    typeof raw.chargeCost === 'number'
      ? Number(raw.chargeCost)
      : typeof raw.energizeCost === 'number'
      ? Number(raw.energizeCost)
      : previous?.energizeCost ?? null
  let consumedOrder: { id: number; txHash: string | null } | null =
    raw.consumedOrder !== undefined ? parseConsumedOrder(raw.consumedOrder) : previous?.consumedOrder ?? null
  if (raw.consumedOrder === null) {
    consumedOrder = null
  }

  return {
    state,
    boosterLevel: Number(status.boosterLevel ?? status.booster ?? 0),
    boostersActiveUntil,
    cooldownEndsAt,
    overdue: !!status.overdue,
    lastEnergizeAt,
    energizeCost: energizeCostValue,
    consumedOrder,
    dropAcc: typeof status.dropAcc === 'number'
      ? Math.max(0, Math.min(1, Number(status.dropAcc)))
      : previous?.dropAcc ?? 0,
    fastForwardEligible: Boolean(status.fastForwardEligible),
    fastForwardDebtUntil: status.fastForwardDebtUntil ?? null,
    fastForwardBurstsRemaining: Number.isFinite(status.fastForwardBurstsRemaining) ? Number(status.fastForwardBurstsRemaining) : 0,
    fastForwardIsNewcomer: Boolean(status.fastForwardIsNewcomer),
  }
}

export type RefreshReason = 'init' | 'event' | 'deadline' | 'fallback' | 'heartbeat' | 'manual'
type RefreshStatusFn = (reason?: RefreshReason) => Promise<void>

export function useEnergizePolling({
  energizeUiRef,
  pendingEnergizeActionRef,
  setEnergizeUi,
  setEnergizeAlert,
  energizeAlert,
  enabled = true,
}: EnergizeStateOptions) {
  const eventBus = useClientEventBus()
  const statusControllerRef = useRef<AbortController | null>(null)
  const deadlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshPromiseRef = useRef<Promise<void> | null>(null)
  const refreshFnRef = useRef<RefreshStatusFn>(() => Promise.resolve())
  const [statusRefreshing, setStatusRefreshing] = useState(false)

  const scheduleDeadlineRefresh = useCallback((state: EnergizeUiState | null) => {
    if (!state) {
      if (deadlineTimeoutRef.current) {
        clearTimeout(deadlineTimeoutRef.current)
        deadlineTimeoutRef.current = null
      }
      return
    }
    if (deadlineTimeoutRef.current) {
      clearTimeout(deadlineTimeoutRef.current)
      deadlineTimeoutRef.current = null
    }
    const now = Date.now()
    const deadlines: number[] = []
    if (state.boostersActiveUntil) {
      const ms = Date.parse(state.boostersActiveUntil)
      if (Number.isFinite(ms) && ms > now) deadlines.push(ms)
    }
    if (state.cooldownEndsAt) {
      const ms = Date.parse(state.cooldownEndsAt)
      if (Number.isFinite(ms) && ms > now) deadlines.push(ms)
    }
    if (!deadlines.length) return
    const target = Math.min(...deadlines)
    const delay = Math.max(0, target - now) + 1000
    deadlineTimeoutRef.current = setTimeout(() => {
      deadlineTimeoutRef.current = null
      refreshFnRef.current('deadline').catch(() => {})
    }, delay)
  }, [deadlineTimeoutRef, refreshFnRef])

  const refreshStatus = useCallback(
    async (reason: RefreshReason = 'manual') => {
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current
      }

      const run = (async () => {
        statusControllerRef.current?.abort()
        const ctrl = new AbortController()
        statusControllerRef.current = ctrl
        setStatusRefreshing(true)
        try {
          const status = await fetchPlayerStatusSnapshot()
          if (ctrl.signal.aborted) return
          primePlayerStatusCache(status)
          const energizeState = toEnergizeUiState(status?.care)
          setEnergizeUi(() => energizeState)
          scheduleDeadlineRefresh(energizeState)

          if (pendingEnergizeActionRef.current) {
            pendingEnergizeActionRef.current = null
            let message = 'Nourish complete!'
            if (energizeState.state === 'covered' && energizeState.boostersActiveUntil) {
              const until = new Date(energizeState.boostersActiveUntil)
              const label = Number.isNaN(until.getTime())
                ? energizeState.boostersActiveUntil
                : until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              message = `Boosters refreshed. Active until ${label}.`
            }
            setEnergizeAlert({ message, until: Date.now() + 6000 })
          }

          emitClientEvent(CLIENT_EVENT.PLAYER_STATUS_REFRESHED, {
            reason,
            at: Date.now(),
          })
        } catch {
          // ignore polling failures
        } finally {
          if (statusControllerRef.current === ctrl) {
            statusControllerRef.current = null
          }
        }
      })()

      refreshPromiseRef.current = run
      run
        .catch(() => {})
        .finally(() => {
          if (refreshPromiseRef.current === run) {
            refreshPromiseRef.current = null
            setStatusRefreshing(false)
          }
        })

      return run
    },
    [pendingEnergizeActionRef, scheduleDeadlineRefresh, setEnergizeAlert, setEnergizeUi],
  )

  useEffect(() => {
    refreshFnRef.current = refreshStatus
  }, [refreshStatus])

  useEffect(() => {
    refreshStatus('init').catch(() => {})
    return () => {
      statusControllerRef.current?.abort()
      if (deadlineTimeoutRef.current) {
        clearTimeout(deadlineTimeoutRef.current)
        deadlineTimeoutRef.current = null
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current)
        heartbeatTimeoutRef.current = null
      }
    }
  }, [refreshStatus])

  useEffect(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }

    let cancelled = false
    const interval = enabled ? 120000 : 300000
    const reason: RefreshReason = enabled ? 'fallback' : 'heartbeat'

    const tick = () => {
      if (cancelled) return
      heartbeatTimeoutRef.current = setTimeout(() => {
        heartbeatTimeoutRef.current = null
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          tick()
          return
        }
        refreshStatus(reason).catch(() => {})
        tick()
      }, interval)
    }

    tick()

    return () => {
      cancelled = true
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current)
        heartbeatTimeoutRef.current = null
      }
    }
  }, [enabled, refreshStatus])

  useEffect(() => {
    if (!eventBus) return
    const unsubscribeApplied = eventBus.subscribe(CLIENT_EVENT.ENERGIZE_APPLIED, () => {
      pendingEnergizeActionRef.current = 'energize'
      setEnergizeAlert({
        message: 'Nourishing…',
        until: Date.now() + 3000,
      })
      refreshStatus('event').catch(() => {})
    })
    const unsubscribeVerified = eventBus.subscribe(CLIENT_EVENT.VERIFIED, () => {
      refreshStatus('event').catch(() => {})
    })
    return () => {
      unsubscribeApplied()
      unsubscribeVerified()
    }
  }, [eventBus, pendingEnergizeActionRef, refreshStatus, setEnergizeAlert])

  const reportExternalState = useCallback(
    (state: EnergizeUiState | null) => {
      scheduleDeadlineRefresh(state)
    },
    [scheduleDeadlineRefresh],
  )

  useEffect(() => {
    if (!energizeAlert) return
    const remaining = energizeAlert.until - Date.now()
    if (remaining <= 0) {
      setEnergizeAlert(null)
      return
    }
    const timer = window.setTimeout(() => {
      setEnergizeAlert((current) =>
        current && current.until <= Date.now() ? null : current,
      )
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [energizeAlert, setEnergizeAlert])

  return { refreshStatus, statusRefreshing, reportExternalState }
}

export type EnergizeHudStatus = {
  title: string
  highlight: string
  detail: string
  tone: 'active' | 'next' | 'overdue' | 'idle'
  ready: boolean
}

export function getEnergizeCountdownLabel(energizeUi: EnergizeUiState, nowMs: number = Date.now()): string {
  if (energizeUi.state === 'covered' && energizeUi.boostersActiveUntil) {
    const untilMs = Date.parse(energizeUi.boostersActiveUntil)
    if (Number.isFinite(untilMs)) {
      const diffMs = untilMs - nowMs
      if (diffMs <= 0) return '00:00'
      const mins = Math.floor(diffMs / 60000)
      const secs = Math.floor((diffMs % 60000) / 1000)
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return 'Active'
  }
  if (energizeUi.state === 'cooldown' && energizeUi.cooldownEndsAt) {
    const untilMs = Date.parse(energizeUi.cooldownEndsAt)
    if (Number.isFinite(untilMs)) {
      const diffMs = untilMs - nowMs
      if (diffMs <= 0) return '00:00'
      const mins = Math.floor(diffMs / 60000)
      const secs = Math.floor((diffMs % 60000) / 1000)
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return 'Cooling'
  }
  if (energizeUi.state === 'ready') {
    return 'READY'
  }
  return 'IDLE'
}

export function getEnergizeHudStatus(
  energizeUi: EnergizeUiState,
  coverageCountdownLabel: string,
): EnergizeHudStatus {
  if (energizeUi.state === 'covered' && energizeUi.boostersActiveUntil) {
    const until = new Date(energizeUi.boostersActiveUntil)
    const label = Number.isNaN(until.getTime())
      ? energizeUi.boostersActiveUntil
      : until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return {
      title: 'Coverage Active',
      highlight: coverageCountdownLabel,
      detail: `Boosters locked until ${label}`,
      tone: 'active',
      ready: false,
    }
  }
  if (energizeUi.state === 'cooldown') {
    if (energizeUi.overdue) {
      return {
        title: 'Cycle Overdue',
        highlight: 'Nourish Now',
        detail: 'Start a new cycle to restore coverage',
        tone: 'overdue',
        ready: true,
      }
    }
    const label = energizeUi.cooldownEndsAt
      ? `Ready ${formatTimeLabel(energizeUi.cooldownEndsAt)}`
      : 'Cooling down'
    return {
      title: 'Cooldown Active',
      highlight: coverageCountdownLabel,
      detail: label,
      tone: 'next',
      ready: false,
    }
  }
  return {
    title: 'Cycle Ready',
    highlight: 'NOURISH',
    detail: 'Nourish to refresh boosters, roll for loot, and earn upkeep.',
    tone: 'idle',
    ready: true,
  }
}

export function buildEnergizeToasts(
  energizeAlert: EnergizeAlert,
): Array<{ id: string; icon: string; message: string }> {
  if (!energizeAlert) return []
  return [
    {
      id: `energize-${energizeAlert.until}`,
      icon: '✨',
      message: energizeAlert.message,
    },
  ]
}

function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return 'soon'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
