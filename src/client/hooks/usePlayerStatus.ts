"use client"

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { PlayerStatus as ServerPlayerStatus } from '@/src/server/gameplay/playerStatusService'
import { appConfig } from '@/src/config/app'
import { getSessionSnapshot } from '@/src/client/session/sessionManager'

export type PlayerStatus = ServerPlayerStatus

type Options = {
  refreshIntervalMs?: number
}

type PlayerStatusHook = {
  data: PlayerStatus | null
  loading: boolean
  refreshing: boolean
  error: Error | null
  refresh: () => Promise<PlayerStatus | null>
  setData: Dispatch<SetStateAction<PlayerStatus | null>>
}

const AUTH_REQUIRED_ERROR = 'player_status_requires_session'

// ----- Singleton manager (dedupe + TTL) ------------------------------------
type Manager = {
  data: PlayerStatus | null
  error: Error | null
  lastFetchedAt: number
  inFlight: Promise<PlayerStatus> | null
  intervalId: ReturnType<typeof setInterval> | null
  subscribers: number
  intervalMs: number
}

const TTL_MS = appConfig.tuning.statusTtlMs
const DEFAULT_INTERVAL_MS = 60_000
const mgr: Manager = {
  data: null,
  error: null,
  lastFetchedAt: 0,
  inFlight: null,
  intervalId: null,
  subscribers: 0,
  intervalMs: DEFAULT_INTERVAL_MS,
}

function isVisible() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

export async function fetchPlayerStatusSnapshot(): Promise<PlayerStatus> {
  const session = getSessionSnapshot()
  if (!session.verified || !session.address) {
    throw new Error(AUTH_REQUIRED_ERROR)
  }
  const resp = await fetch('/api/player/status', { credentials: 'same-origin' })
  if (!resp.ok) {
    const payload = await resp.text().catch(() => '')
    throw new Error(`player status failed (${resp.status}) ${payload}`)
  }
  const json = await resp.json().catch(() => null)
  const status = json?.status ?? json?.result ?? null
  if (!status) {
    throw new Error('player status missing payload')
  }
  return status as PlayerStatus
}

type Listener = () => void
const listeners = new Set<Listener>()

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // ignore listener errors to keep others firing
    }
  })
}

export function primePlayerStatusCache(status: PlayerStatus, fetchedAt = Date.now()) {
  mgr.data = status
  mgr.error = null
  mgr.lastFetchedAt = fetchedAt
  notifyListeners()
}

function ensureInterval() {
  if (mgr.intervalId || mgr.subscribers <= 0) return
  mgr.intervalId = setInterval(() => {
    if (!isVisible()) return
    // Respect TTL — if recent fetch done, skip
    if (Date.now() - mgr.lastFetchedAt < mgr.intervalMs) return
    void loadOnce()
  }, Math.max(10000, mgr.intervalMs))
}

function clearIntervalIfIdle() {
  if (mgr.subscribers > 0) return
  if (mgr.intervalId) {
    clearInterval(mgr.intervalId)
    mgr.intervalId = null
  }
}

async function loadOnce(): Promise<PlayerStatus> {
  const now = Date.now()
  if (mgr.inFlight) return mgr.inFlight
  if (now - mgr.lastFetchedAt < TTL_MS && mgr.data) return mgr.data
  if (!isVisible()) {
    if (!mgr.inFlight) {
      mgr.inFlight = fetchPlayerStatusSnapshot()
        .then((status) => {
          primePlayerStatusCache(status)
          return status
        })
        .finally(() => {
          mgr.inFlight = null
        })
    }
    return mgr.inFlight
  }
  mgr.inFlight = fetchPlayerStatusSnapshot()
    .then((status) => {
      primePlayerStatusCache(status)
      return status
    })
    .catch((e: any) => {
      const err = e instanceof Error ? e : new Error(String(e))
      if (err.message === AUTH_REQUIRED_ERROR) {
        mgr.error = null
      } else {
        mgr.error = err
      }
      throw err
    })
    .finally(() => {
      mgr.inFlight = null
    })
  return mgr.inFlight
}

export function usePlayerStatus(options: Options = {}): PlayerStatusHook {
  const { refreshIntervalMs = 60_000 } = options
  const [data, setData] = useState<PlayerStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)
  const initializedRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const status = await loadOnce()
      if (!mountedRef.current) return null
      setData(status)
      setError(null)
      initializedRef.current = true
      return status
    } catch (err) {
      if (!mountedRef.current) return null
      const errorObj = err instanceof Error ? err : new Error(String(err))
      if (errorObj.message === AUTH_REQUIRED_ERROR) {
        setError(null)
        initializedRef.current = false
        return null
      } else {
        setError(errorObj)
        throw errorObj
      }
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!initializedRef.current) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      return await load()
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [load])

  useEffect(() => {
    mountedRef.current = true
    mgr.subscribers += 1
    // adopt the shortest requested interval among subscribers
    mgr.intervalMs = Math.min(Math.max(10000, refreshIntervalMs || DEFAULT_INTERVAL_MS), mgr.intervalMs || DEFAULT_INTERVAL_MS)
    ensureInterval()
    const listener = () => {
      if (!mountedRef.current) return
      if (mgr.data) {
        setData(mgr.data)
        initializedRef.current = true
      }
      if (mgr.error) {
        setError(mgr.error)
      } else {
        setError(null)
      }
    }

    listeners.add(listener)

    setLoading(true)
    load()
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      })

    return () => {
      mountedRef.current = false
      mgr.subscribers = Math.max(0, mgr.subscribers - 1)
      if (mgr.subscribers === 0) {
        clearIntervalIfIdle()
        mgr.intervalMs = DEFAULT_INTERVAL_MS
      }
      listeners.delete(listener)
    }
  }, [load, refreshIntervalMs])

  return {
    data,
    loading,
    refreshing,
    error,
    refresh,
    setData,
  }
}
