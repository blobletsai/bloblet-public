"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rewardLedgerDecimals } from '@/src/shared/points'

export type RewardLedgerEntry = {
  id: number
  reason: string
  deltaRaw: number
  delta: number
  balanceAfterRaw: number | null
  balanceAfter: number | null
  createdAt: string
}

export type RewardSwapEntry = {
  id: number
  direction: string
  status: string
  amountRaw: number
  amount: number
  signature: string | null
  createdAt: string
}

export type RewardsSnapshot = {
  decimals: number
  balanceRaw: number
  balance: number
  ledger: RewardLedgerEntry[]
  swaps: RewardSwapEntry[]
  fetchedAt: number
  sourceFetchedAt?: string
}

type RefreshOptions = {
  silent?: boolean
}

type UseRewardsSnapshotOptions = {
  pollIntervalMs?: number
}

const DEFAULT_POLL_INTERVAL = 120_000

export function useRewardsSnapshot(
  enabled: boolean,
  options: UseRewardsSnapshotOptions = {}
) {
  const [snapshot, setSnapshot] = useState<RewardsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const visibilityRef = useRef<'visible' | 'hidden'>(
    typeof document === 'undefined' ? 'visible' : document.visibilityState === 'hidden' ? 'hidden' : 'visible',
  )
  const pollInterval = useMemo(
    () => Math.max(10_000, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL),
    [options.pollIntervalMs],
  )

  useEffect(() => {
    mountedRef.current = true
    if (typeof document !== 'undefined') {
      visibilityRef.current = document.visibilityState === 'hidden' ? 'hidden' : 'visible'
    }
    return () => {
      mountedRef.current = false
      if (pollRef.current) {
        clearTimeout(pollRef.current)
        pollRef.current = null
      }
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  const fetchRewards = useCallback(async (refreshOptions: RefreshOptions = {}) => {
    if (!enabled) {
      if (mountedRef.current) {
        setSnapshot(null)
        setError(null)
        setLoading(false)
      }
      return null
    }

    const { silent } = refreshOptions

    if (!silent && mountedRef.current) {
      setLoading(true)
    }

    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/rewards/me', {
        method: 'GET',
        credentials: 'same-origin',
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        return null
      }

      if (res.status === 401) {
      if (mountedRef.current) {
        setSnapshot(null)
        setError(null)
      }
      return null
    }

      if (res.status === 503) {
        if (mountedRef.current) {
          setError('Reward ledger is temporarily unavailable.')
        }
        return null
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed to load rewards (${res.status})`)
      }

      const payload = await res.json()
      const defaultDecimals = rewardLedgerDecimals()
      const decimalsCandidate = Number(payload?.decimals)
      const decimals = Number.isFinite(decimalsCandidate) ? decimalsCandidate : defaultDecimals
      const normalized: RewardsSnapshot = {
        decimals: Number.isFinite(decimals) ? decimals : 0,
        balanceRaw: Number(payload?.balanceRaw ?? 0) || 0,
        balance: Number(payload?.balance ?? 0) || 0,
        ledger: Array.isArray(payload?.ledger) ? payload.ledger.map((entry: any) => ({
          id: Number(entry?.id || 0),
          reason: String(entry?.reason || 'unknown'),
          deltaRaw: Number(entry?.deltaRaw || entry?.delta || 0) || 0,
          delta: Number(entry?.delta || 0) || 0,
          balanceAfterRaw: entry?.balanceAfterRaw != null ? Number(entry.balanceAfterRaw) : (entry?.balanceAfter != null ? Number(entry.balanceAfter) : null),
          balanceAfter: entry?.balanceAfter != null ? Number(entry.balanceAfter) : (entry?.balanceAfterRaw != null ? Number(entry.balanceAfterRaw) : null),
          createdAt: entry?.createdAt ? String(entry.createdAt) : new Date().toISOString(),
        })) : [],
        swaps: Array.isArray(payload?.swaps) ? payload.swaps.map((entry: any) => ({
          id: Number(entry?.id || 0),
          direction: String(entry?.direction || 'deposit'),
          status: String(entry?.status || 'pending'),
          amountRaw: Number(entry?.amountRaw || entry?.amount_points || 0) || 0,
          amount: Number(entry?.amount || 0) || 0,
          signature: entry?.signature ? String(entry.signature) : null,
          createdAt: entry?.createdAt ? String(entry.createdAt) : new Date().toISOString(),
        })) : [],
        fetchedAt: Date.now(),
        sourceFetchedAt: payload?.fetchedAt ? String(payload.fetchedAt) : undefined,
      }

      if (mountedRef.current) {
        setSnapshot(normalized)
        setError(null)
      }

      return normalized
    } catch (err: any) {
      if (controller.signal.aborted) {
        return null
      }
      if (mountedRef.current) {
        setError(err?.message || 'Failed to load reward balances')
      }
      return null
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [enabled, setError, setLoading, setSnapshot])

  const clearPollTimeout = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const scheduleNextPoll = useCallback(() => {
    clearPollTimeout()
    if (!enabled || visibilityRef.current === 'hidden') {
      return
    }
    pollRef.current = setTimeout(async () => {
      await fetchRewards({ silent: true })
      if (!mountedRef.current) return
      scheduleNextPoll()
    }, pollInterval)
  }, [clearPollTimeout, enabled, fetchRewards, pollInterval])

  useEffect(() => {
    if (!enabled) {
      clearPollTimeout()
      setSnapshot(null)
      setError(null)
      setLoading(false)
      return
    }

    if (visibilityRef.current === 'hidden') {
      clearPollTimeout()
      return
    }

    fetchRewards().catch(() => {})
    scheduleNextPoll()

    return () => {
      clearPollTimeout()
    }
  }, [clearPollTimeout, enabled, fetchRewards, scheduleNextPoll, setError, setLoading, setSnapshot])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibility = () => {
      visibilityRef.current = document.visibilityState === 'hidden' ? 'hidden' : 'visible'
      if (!enabled) {
        clearPollTimeout()
        return
      }
      if (visibilityRef.current === 'hidden') {
        if (abortRef.current) {
          abortRef.current.abort()
          abortRef.current = null
        }
        clearPollTimeout()
        return
      }
      fetchRewards({ silent: true }).catch(() => {})
      scheduleNextPoll()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [clearPollTimeout, enabled, fetchRewards, scheduleNextPoll])

  const refresh = useCallback(async (refreshOptions: RefreshOptions = {}) => {
    return fetchRewards(refreshOptions)
  }, [fetchRewards])

  return {
    snapshot,
    loading,
    error,
    refresh,
    lastUpdated: snapshot?.fetchedAt ?? null,
    initialLoading: loading && !snapshot,
  }
}
