"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useClientEventBus } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

type Summary = { attempts: number; drops: number; rate: number }
type AttemptRow = {
  created_at: string
  base_probability: number | null
  eff_probability: number | null
  acc_before: number | null
  acc_after: number | null
  rng_passed: boolean
  awarded: boolean
}

type ApiResponse = {
  ok: true
  law: 'deterministic_accumulator' | 'memoryless'
  base: number
  guaranteeWithin: number | null
  next: {
    effProbability: number
    bucketContribution: number
    bucketFillPercent: number
    rngPending: boolean
  }
  window: { last24h: Summary }
  wallet: { lifetime: Summary; last: AttemptRow[] }
}

export type EnergizeProgress = {
  loading: boolean
  error: string | null
  base: number
  effChance: number
  bucketContribution: number
  accAfter: number | null
  totalPips: number
  filledPips: number
  bucketFillPercent: number
  lastAt: string | null
  rngPending: boolean
  refresh: () => Promise<void>
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

export function useEnergizeProgress(totalPips = 5, dropAccSeed?: number | null): EnergizeProgress {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resp, setResp] = useState<ApiResponse | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    controllerRef.current?.abort()
    const ctrl = new AbortController()
    controllerRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/pvp/attempts', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
        signal: ctrl.signal,
      })
      if (r.status === 304) return
      if (!r.ok) throw new Error(`attempts_failed_${r.status}`)
      const json = (await r.json()) as ApiResponse
      if (!ctrl.signal.aborted) {
        setResp(json)
      }
    } catch (e: any) {
      if (ctrl.signal.aborted) return
      setError(e?.message || 'failed')
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false)
        controllerRef.current = null
      }
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData().catch(() => {})
    return () => controllerRef.current?.abort()
  }, [fetchData])

  const eventBus = useClientEventBus()

  useEffect(() => {
    if (!eventBus) return
    return eventBus.subscribe(CLIENT_EVENT.ENERGIZE_APPLIED, () => {
      setTimeout(() => {
        fetchData().catch(() => {})
      }, 500)
    })
  }, [eventBus, fetchData])

  return useMemo(() => {
    const base = resp?.base ?? 0.2
    const last = resp?.wallet?.last?.[0] || null
    const telemetryAcc = last?.acc_after != null ? Number(last.acc_after) : null
    const derivedAcc = telemetryAcc != null ? telemetryAcc : dropAccSeed != null ? clamp01(dropAccSeed) : null
    const nextStats = resp?.next
    const fallbackContribution = clamp01(derivedAcc ?? 0)
    const bucketContribution = nextStats ? clamp01(nextStats.bucketContribution) : fallbackContribution
    const bucketFillPercent = nextStats
      ? clamp01(nextStats.bucketFillPercent)
      : (() => {
          const denom = 1 - base
          return derivedAcc != null && denom > 0 ? clamp01(derivedAcc / denom) : 0
        })()
    const filledPips = Math.round(bucketFillPercent * totalPips)
    const effChance = nextStats ? clamp01(nextStats.effProbability) : clamp01(base + bucketContribution)
    const rngPending = nextStats ? nextStats.rngPending : Boolean(last?.rng_passed && !last?.awarded)

    return {
      loading,
      error,
      base,
      effChance,
      bucketContribution,
      accAfter: derivedAcc ?? null,
      totalPips,
      filledPips,
      bucketFillPercent,
      lastAt: last?.created_at ? String(last.created_at) : null,
      rngPending,
      refresh,
    }
  }, [resp, loading, error, totalPips, refresh, dropAccSeed])
}
