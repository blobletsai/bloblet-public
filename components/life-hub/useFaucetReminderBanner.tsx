"use client"

import { useCallback, useEffect, useState } from 'react'

import { useHolderSession } from '@/src/client/hooks/useHolderSession'
import { getSessionManager } from '@/src/client/session/sessionManager'
import { FaucetReminderBanner } from './FaucetReminderBanner'
import { emitClientEvent, subscribeClientEvent } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT, type FaucetEventPayload } from '@/src/client/events/clientEventMap'

const ARRIVAL_TIMEOUT_MS = 5 * 60 * 1000
const STORAGE_PREFIX = 'blob:faucetTimer:'

type FaucetStatus = 'fulfilled' | 'already_claimed'
type StoredReminder = { status: FaucetStatus; startedAt: number }

function getStorageKey(address: string) {
  return `${STORAGE_PREFIX}${address}`
}

function computeRemaining(startedAt: number) {
  return Math.max(0, ARRIVAL_TIMEOUT_MS - (Date.now() - startedAt))
}

function readReminder(address: string): StoredReminder | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getStorageKey(address))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.startedAt !== 'number') return null
    if (parsed.status !== 'fulfilled' && parsed.status !== 'already_claimed') return null
    return { status: parsed.status, startedAt: parsed.startedAt }
  } catch {
    return null
  }
}

function writeReminder(address: string, payload: StoredReminder) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getStorageKey(address), JSON.stringify(payload))
  } catch {}
}

function clearReminder(address: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(getStorageKey(address))
  } catch {}
}

export function useFaucetReminderBanner() {
  const session = useHolderSession()
  const [status, setStatus] = useState<FaucetStatus | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [, setManualRefreshPending] = useState(false)

  const clearReminderState = useCallback(() => {
    if (!session.address) {
      setStatus(null)
      setStartedAt(null)
      setRemainingMs(null)
      setManualRefreshPending(false)
      return
    }
    clearReminder(session.address)
    setStatus(null)
    setStartedAt(null)
    setRemainingMs(null)
    setManualRefreshPending(false)
  }, [session.address])

  useEffect(() => {
    if (!session.address) {
      setStatus(null)
      setStartedAt(null)
      setRemainingMs(null)
      setManualRefreshPending(false)
      return
    }
    const stored = readReminder(session.address)
    if (stored) {
      setStatus(stored.status)
      setStartedAt(stored.startedAt)
      setRemainingMs(computeRemaining(stored.startedAt))
      setManualRefreshPending(false)
    } else {
      setStatus(null)
      setStartedAt(null)
      setRemainingMs(null)
      setManualRefreshPending(false)
    }
  }, [session.address])

  const beginReminder = useCallback(
    (nextStatus: FaucetStatus, started: number) => {
      if (!session.address) return
      const normalizedStart = Number.isFinite(started) ? started : Date.now()
      setStatus(nextStatus)
      setStartedAt(normalizedStart)
      setRemainingMs(computeRemaining(normalizedStart))
      setManualRefreshPending(false)
      writeReminder(session.address, { status: nextStatus, startedAt: normalizedStart })
    },
    [session.address],
  )

  useEffect(() => {
    if (!session.address) return

    const targetAddress = session.address
    const unsubscribe = subscribeClientEvent(CLIENT_EVENT.FAUCET, (payload: FaucetEventPayload) => {
      const addr = typeof payload.address === 'string' ? payload.address.trim() : ''
      if (!addr || addr !== targetAddress) return
      const nextStatus = payload.faucetClaimStatus
      if (nextStatus === 'fulfilled' || nextStatus === 'already_claimed') {
        const emittedAt = Number(payload.emittedAt)
        const started = Number.isFinite(emittedAt) ? emittedAt : Date.now()
        beginReminder(nextStatus, started)
      }
    })

    return () => {
      try {
        unsubscribe()
      } catch {
        // ignore cleanup failures
      }
    }
  }, [session.address, beginReminder])

  useEffect(() => {
    if (!startedAt || !status) return
    if (typeof window === 'undefined') return

    const updateRemaining = () => {
      setRemainingMs(computeRemaining(startedAt))
    }

    updateRemaining()
    const interval = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(interval)
  }, [startedAt, status])

  const handleManualRefresh = useCallback(async () => {
    await getSessionManager().refresh({ force: true, reason: 'arrival_timer_manual' })
  }, [])

  useEffect(() => {
    if (!status || !session.address) return
    if (!session.isHolder || !session.verified) return
    emitClientEvent(CLIENT_EVENT.VERIFIED, {
      address: session.address,
      isHolder: true,
    })
    clearReminderState()
  }, [status, session.address, session.isHolder, session.verified, clearReminderState])

  if (!status) return null

  return (
    <FaucetReminderBanner
      status={status}
      remainingMs={remainingMs}
      onManualRefresh={handleManualRefresh}
    />
  )
}
