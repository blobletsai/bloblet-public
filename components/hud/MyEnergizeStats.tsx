"use client"

import React, { useEffect, useState } from 'react'
import { useEnergizeProgress } from '@/components/life-hub/useEnergizeProgress'
import { useClientEventBus } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

type Summary = { attempts: number; drops: number; rate: number }
type AttemptRow = {
  created_at: string
  base_probability: number | null
  eff_probability: number | null
  roll: number | null
  awarded: boolean
  acc_before: number | null
  acc_after: number | null
  slot: 'weapon' | 'shield' | null
  item_id: number | null
  item_slug: string | null
  rng_passed: boolean
  fallback_type: string | null
}

type ApiResponse = {
  ok: true
  address: string
  self: boolean
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

function pct(x: number) {
  if (!Number.isFinite(x)) return '—'
  return `${(x * 100).toFixed(1)}%`
}

function ts(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const MyEnergizeStats: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const progress = useEnergizeProgress(5)
  const eventBus = useClientEventBus()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pvp/attempts', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      })
      if (res.status === 304) return
      if (!res.ok) throw new Error('failed')
      const json = (await res.json()) as ApiResponse
      if (!json || (json as any).error) throw new Error((json as any).error || 'failed')
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  // Auto-refresh stats when energize completes
  useEffect(() => {
    if (!eventBus) return
    return eventBus.subscribe(CLIENT_EVENT.ENERGIZE_APPLIED, () => {
      setTimeout(() => {
        load().catch(() => {})
        progress.refresh().catch(() => {})
      }, 500)
    })
  }, [eventBus, progress])

  return (
    <div className="relative">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-pressstart pixel-tiny uppercase tracking-[0.28em] text-[#ffe780]">
            💎 My Nourish Stats
          </div>
          <div className="mt-1 text-[10px] leading-tight text-[#c7b5ff]">
            Luck bucket law active — personal attempts, drops and recent rolls.
          </div>
        </div>
        <button
          type="button"
          className="group relative overflow-hidden rounded-full border-2 border-[rgba(148,93,255,0.7)] bg-[rgba(60,20,100,0.8)] px-3 py-1.5 text-[10px] text-white shadow-[0_0_15px_rgba(148,93,255,0.5)] transition-all duration-300 hover:scale-105 hover:border-[rgba(148,93,255,0.9)] hover:shadow-[0_0_25px_rgba(148,93,255,0.7)] disabled:opacity-60"
          onClick={() => { void Promise.all([load(), progress.refresh()]) }}
          disabled={loading}
        >
          {loading ? '↻' : '↻'}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-[20px] border border-red-400/40 bg-red-900/40 px-3 py-2 text-[11px] text-red-100">{error}</div>
      ) : null}

      {!data && !error ? (
        <div className="mt-4 text-[12px] text-white/80">Loading…</div>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-4 text-[12px] text-white/90">
          <div className="relative overflow-hidden rounded-[20px] border-2 border-[rgba(143,247,255,0.5)] bg-[rgba(12,4,26,0.9)] p-3 shadow-[0_0_20px_rgba(143,247,255,0.2)]">
            {/* Corner markers */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-0 top-0 h-3 w-3 border-l-[2px] border-t-[2px] border-[rgba(143,247,255,0.7)]" />
              <div className="absolute right-0 bottom-0 h-3 w-3 border-r-[2px] border-b-[2px] border-[rgba(143,247,255,0.7)]" />
            </div>
            <div className="relative font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#8ff7ff]">Luck Bucket</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: progress.totalPips }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <span key={i} className={`inline-block h-2.5 w-2.5 rounded-full ${i < progress.filledPips ? 'bg-[#7dffcf] shadow-[0_0_6px_rgba(125,255,207,0.7)]' : 'bg-[rgba(143,247,255,0.22)]'}`} />
                ))}
              </div>
              <div className="text-[#9bd7ff] text-[10px] sm:text-[11px] space-y-1">
                {progress.loading ? '…' : (
                  <>
                    <div>
                      Drop chance <strong>{Math.round(progress.effChance * 100)}%</strong>
                      {' '}(<span className="text-[#80f5ff]">{Math.round(progress.base * 100)}% base</span>
                      {' '}+ <span className="text-[#80f5ff]">{Math.round(progress.bucketContribution * 100)}% bucket</span>)
                    </div>
                    <div className="text-white/70">
                      Bucket fill {Math.round(progress.bucketFillPercent * 100)}% towards guarantee
                    </div>
                    {progress.rngPending && (
                      <div className="text-[#ffb4c2]">
                        Last roll already hit the Luck Bucket — nourish again or swap gear to consume it.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-[12px] border-2 border-[rgba(255,231,128,0.4)] bg-[rgba(12,4,26,0.8)] p-3 shadow-[0_0_15px_rgba(255,231,128,0.1)]">
              {/* Corner markers */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-0 top-0 h-2 w-2 border-l-[2px] border-t-[2px] border-[rgba(255,231,128,0.7)]" />
                <div className="absolute right-0 bottom-0 h-2 w-2 border-r-[2px] border-b-[2px] border-[rgba(255,231,128,0.7)]" />
              </div>
              <div className="relative font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#ffe780]">Lifetime</div>
              <div className="relative mt-1">Attempts: {data.wallet.lifetime.attempts}</div>
              <div className="relative">Drops: {data.wallet.lifetime.drops}</div>
              <div className="relative">Rate: {pct(data.wallet.lifetime.rate)}</div>
            </div>
            <div className="relative overflow-hidden rounded-[12px] border-2 border-[rgba(125,255,207,0.4)] bg-[rgba(12,4,26,0.8)] p-3 shadow-[0_0_15px_rgba(125,255,207,0.1)]">
              {/* Corner markers */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-0 top-0 h-2 w-2 border-l-[2px] border-t-[2px] border-[rgba(125,255,207,0.7)]" />
                <div className="absolute right-0 bottom-0 h-2 w-2 border-r-[2px] border-b-[2px] border-[rgba(125,255,207,0.7)]" />
              </div>
              <div className="relative font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#7dffcf]">Last 24h</div>
              <div className="relative mt-1">Attempts: {data.window.last24h.attempts}</div>
              <div className="relative">Drops: {data.window.last24h.drops}</div>
              <div className="relative">Rate: {pct(data.window.last24h.rate)}</div>
            </div>
          </div>
          <div>
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#c7b5ff]">Recent Nourishes</div>
            <div className="relative mt-2 max-h-[40vh] overflow-y-auto rounded-[12px] border-2 border-[rgba(148,93,255,0.4)] bg-[rgba(12,4,26,0.9)] shadow-[0_0_15px_rgba(148,93,255,0.1)] scrollbar-custom" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(148,93,255,0.4) rgba(10,3,22,0.3)'
            }}>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[#9bd7ff]">
                    <th className="px-2 py-1">Time</th>
                    <th className="px-2 py-1">Eff</th>
                    <th className="px-2 py-1">Roll</th>
                    <th className="px-2 py-1">Awarded</th>
                    <th className="px-2 py-1">RNG</th>
                    <th className="px-2 py-1">Fallback</th>
                    <th className="px-2 py-1">Acc</th>
                    <th className="px-2 py-1">Slot</th>
                    <th className="px-2 py-1">Item</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wallet.last.length === 0 ? (
                    <tr>
                      <td className="px-2 py-2 text-white/70" colSpan={9}>No nourish attempts recorded yet.</td>
                    </tr>
                  ) : (
                    data.wallet.last.map((r, idx) => (
                      <tr key={idx} className="border-t border-[rgba(148,93,255,0.15)] text-white/85">
                        <td className="px-2 py-1">{ts(r.created_at)}</td>
                        <td className="px-2 py-1">{r.eff_probability != null ? pct(r.eff_probability) : '—'}</td>
                        <td className="px-2 py-1">{r.roll != null ? pct(r.roll) : '—'}</td>
                        <td className="px-2 py-1">{r.awarded ? 'Yes' : 'No'}</td>
                        <td className="px-2 py-1">
                          {r.rng_passed ? (r.awarded ? 'Hit+Loot' : 'Hit/No Loot') : 'Miss'}
                        </td>
                        <td className="px-2 py-1">{r.fallback_type ? r.fallback_type.replace(/_/g, ' ') : '—'}</td>
                        <td className="px-2 py-1">{r.acc_before != null || r.acc_after != null ? `${(r.acc_before ?? 0).toFixed(2)}→${(r.acc_after ?? 0).toFixed(2)}` : '—'}</td>
                        <td className="px-2 py-1">{r.slot ?? '—'}</td>
                        <td className="px-2 py-1">{r.item_slug ?? (r.item_id != null ? `#${r.item_id}` : '—')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
