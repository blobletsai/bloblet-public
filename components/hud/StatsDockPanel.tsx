"use client"

import React, { useEffect, useMemo, useState } from 'react'

import { usePlayerStatus } from '@/src/client/hooks/usePlayerStatus'
import { formatDisplayPoints } from '@/src/shared/points'
import type { RewardSummaryCardProps } from './RewardSummaryCard'
import { MyEnergizeStats } from './MyEnergizeStats'

type StatsDockPanelProps = {
  rewardSummary: RewardSummaryCardProps
}

function formatIso(iso: string | null | undefined) {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function useRemaining(targetIso: string | null | undefined): string | null {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  if (!targetIso) return null
  const target = Date.parse(targetIso)
  if (!Number.isFinite(target)) return null
  const ms = Math.max(0, target - now)
  const s = Math.floor(ms / 1000)
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

function formatGearLine(name?: string | null, rarity?: string | null) {
  if (!name) return 'None equipped'
  if (!rarity) return name
  return `${name} · ${rarity.toUpperCase()}`
}

type TabId = 'combat' | 'energize'

export const StatsDockPanel: React.FC<StatsDockPanelProps> = ({ rewardSummary }) => {
  const [activeTab, setActiveTab] = useState<TabId>('combat')
  const { data, loading, refreshing, error, refresh } = usePlayerStatus({ refreshIntervalMs: 45_000 })

  const scoreLine = useMemo(() => {
    if (!data?.score) return loading ? 'Loading score…' : 'Score unavailable'
    const balance = formatDisplayPoints(data.score.balance)
    const tier = data.score.tier ? data.score.tier.toUpperCase() : 'ROOKIE'
    const rank = data.score.rank != null ? `#${data.score.rank}` : 'Unranked'
    return `${balance} BC · ${tier} · ${rank}`
  }, [data?.score, loading])

  const coveredRem = useRemaining(data?.care?.boostersActiveUntil)
  const cooldownRem = useRemaining(data?.care?.cooldownEndsAt)
  const boosterLine = useMemo(() => {
    if (!data?.care) return loading ? 'Checking boosters…' : '—'
    const level = data.care.boosterLevel ?? 0
    if (data.care.state === 'covered' && coveredRem) {
      return `Boosters active · lvl ${level} · ${coveredRem}`
    }
    if (cooldownRem) {
      return `Cooldown · lvl ${level} · ${cooldownRem}`
    }
    return `Boosters lvl ${level}`
  }, [coveredRem, cooldownRem, data?.care, loading])

  const weaponLine = formatGearLine(
    data?.gear?.equipped.weapon?.name ?? null,
    data?.gear?.equipped.weapon?.rarity ?? null,
  )
  const shieldLine = formatGearLine(
    data?.gear?.equipped.shield?.name ?? null,
    data?.gear?.equipped.shield?.rarity ?? null,
  )

  const recentBattleLine = useMemo(() => {
    if (!data?.recentBattle) return 'No recent battles logged.'
    const { outcome, opponentMasked, transfer, occurredAt } = data.recentBattle
    const direction = outcome === 'win' ? 'Won vs' : 'Lost vs'
    const transferUi =
      transfer && Number.isFinite(transfer) ? `${formatDisplayPoints(transfer)} BC swing` : 'No transfer'
    return `${direction} ${opponentMasked} · ${transferUi} · ${formatIso(occurredAt)}`
  }, [data?.recentBattle])

  return (
    <div className="w-[340px] max-w-[calc(100vw-160px)] space-y-4" data-hud-interactive="true">
      <div className="relative overflow-hidden rounded-[36px] border-2 border-[rgba(148,93,255,0.65)] bg-[rgba(16,6,40,0.85)] px-5 py-4 shadow-[0_0_60px_rgba(148,93,255,0.65),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(143,247,255,0.3)]">
        {/* Atmospheric background layers */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
          {/* Purple nebula glow */}
          <div className="absolute inset-0 bg-gradient-radial from-[rgba(148,93,255,0.25)] via-[rgba(255,45,215,0.15)] to-transparent opacity-75" />

          {/* Star field - layer 1 (small stars) */}
          <div className="absolute inset-0 opacity-65" style={{
            backgroundImage: 'radial-gradient(1px 1px at 20% 15%, white, transparent), radial-gradient(1px 1px at 75% 35%, white, transparent), radial-gradient(1px 1px at 45% 60%, white, transparent), radial-gradient(1px 1px at 85% 80%, white, transparent), radial-gradient(1px 1px at 10% 45%, white, transparent), radial-gradient(1px 1px at 60% 25%, white, transparent), radial-gradient(1px 1px at 30% 85%, white, transparent), radial-gradient(1px 1px at 95% 50%, white, transparent), radial-gradient(1px 1px at 12% 72%, white, transparent), radial-gradient(1px 1px at 55% 8%, white, transparent), radial-gradient(1px 1px at 88% 42%, white, transparent), radial-gradient(1px 1px at 35% 28%, white, transparent), radial-gradient(1px 1px at 68% 92%, white, transparent), radial-gradient(1px 1px at 22% 55%, white, transparent), radial-gradient(1px 1px at 78% 12%, white, transparent)',
            backgroundSize: '250px 250px'
          }} />

          {/* Star field - layer 2 (medium stars) */}
          <div className="absolute inset-0 opacity-45" style={{
            backgroundImage: 'radial-gradient(2px 2px at 40% 40%, white, transparent), radial-gradient(2px 2px at 65% 75%, white, transparent), radial-gradient(2px 2px at 15% 70%, white, transparent), radial-gradient(2px 2px at 80% 20%, white, transparent), radial-gradient(2px 2px at 50% 90%, white, transparent), radial-gradient(2px 2px at 28% 18%, white, transparent)',
            backgroundSize: '300px 300px'
          }} />

          {/* Star field - layer 3 (bright colored stars) */}
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: 'radial-gradient(1.5px 1.5px at 18% 25%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 62% 48%, rgba(255,231,128,0.9), transparent), radial-gradient(1.5px 1.5px at 35% 72%, rgba(125,255,207,0.9), transparent), radial-gradient(1.5px 1.5px at 78% 15%, rgba(148,93,255,0.9), transparent), radial-gradient(1.5px 1.5px at 45% 88%, rgba(255,157,225,0.9), transparent)',
            backgroundSize: '280px 280px'
          }} />

          {/* Atmospheric haze */}
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(148,93,255,0.1)] via-transparent to-[rgba(148,93,255,0.15)] opacity-40" />

          {/* Floating particles/debris layer */}
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: 'radial-gradient(3px 3px at 22% 18%, rgba(255,231,128,0.6), transparent), radial-gradient(2px 2px at 68% 32%, rgba(143,247,255,0.5), transparent), radial-gradient(4px 4px at 85% 55%, rgba(255,231,128,0.4), transparent), radial-gradient(3px 3px at 12% 72%, rgba(143,247,255,0.6), transparent)',
            backgroundSize: '350px 350px'
          }} />
        </div>

        {/* Corner markers (tactical brackets) */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-4 w-4 border-l-[3px] border-t-[3px] border-[rgba(143,247,255,0.85)]" />
          <div className="absolute right-0 top-0 h-4 w-4 border-r-[3px] border-t-[3px] border-[rgba(143,247,255,0.85)]" />
          <div className="absolute bottom-0 left-0 h-4 w-4 border-b-[3px] border-l-[3px] border-[rgba(143,247,255,0.85)]" />
          <div className="absolute bottom-0 right-0 h-4 w-4 border-b-[3px] border-r-[3px] border-[rgba(143,247,255,0.85)]" />
        </div>

        {/* Scan line effect */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="h-px animate-scan-line bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.4)] to-transparent" />
        </div>

        {/* Tab Navigation */}
        <div className="relative flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('combat')}
            className={`group relative flex items-center gap-2 overflow-hidden rounded-full border-2 px-4 py-2 text-[11px] font-semibold transition-all duration-300 ${
              activeTab === 'combat'
                ? 'border-[rgba(255,157,225,0.8)] bg-[rgba(100,20,80,0.9)] text-white shadow-[0_0_20px_rgba(255,157,225,0.5)] hover:scale-105 hover:shadow-[0_0_30px_rgba(255,157,225,0.7)]'
                : 'border-[rgba(148,93,255,0.3)] bg-[rgba(20,8,50,0.6)] text-[#c7b5ff] hover:scale-105 hover:border-[rgba(148,93,255,0.5)] hover:bg-[rgba(28,12,64,0.8)]'
            }`}
          >
            {activeTab === 'combat' && (
              <div className="absolute inset-0 animate-pulse-subtle bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.2)] to-transparent" />
            )}
            <span className="relative z-10 text-[14px]">⚔️</span>
            <span className="relative z-10">Combat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('energize')}
            className={`group relative flex items-center gap-2 overflow-hidden rounded-full border-2 px-4 py-2 text-[11px] font-semibold transition-all duration-300 ${
              activeTab === 'energize'
                ? 'border-[rgba(255,157,225,0.8)] bg-[rgba(100,20,80,0.9)] text-white shadow-[0_0_20px_rgba(255,157,225,0.5)] hover:scale-105 hover:shadow-[0_0_30px_rgba(255,157,225,0.7)]'
                : 'border-[rgba(148,93,255,0.3)] bg-[rgba(20,8,50,0.6)] text-[#c7b5ff] hover:scale-105 hover:border-[rgba(148,93,255,0.5)] hover:bg-[rgba(28,12,64,0.8)]'
            }`}
          >
            {activeTab === 'energize' && (
              <div className="absolute inset-0 animate-pulse-subtle bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.2)] to-transparent" />
            )}
            <span className="relative z-10 text-[14px]">💎</span>
            <span className="relative z-10">Nourish</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-3 h-px bg-gradient-to-r from-transparent via-[rgba(148,93,255,0.45)] to-transparent shadow-[0_0_8px_rgba(148,93,255,0.3)]" />

        {/* Tab Content */}
        {activeTab === 'combat' && (
          <div className="relative animate-fade-in">
            {/* Combat Tab Header */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-pressstart pixel-tiny uppercase tracking-[0.28em] text-[#ffe780]">
                  📊 Arcade Score
                </div>
                <div className="mt-1 text-[10px] leading-tight text-[#c7b5ff]">
                  Your competitive standing and battle readiness
                </div>
              </div>
              <button
                type="button"
                className="group relative overflow-hidden rounded-full border-2 border-[rgba(148,93,255,0.7)] bg-[rgba(60,20,100,0.8)] px-3 py-1.5 text-[10px] text-white shadow-[0_0_15px_rgba(148,93,255,0.5)] transition-all duration-300 hover:scale-105 hover:border-[rgba(148,93,255,0.9)] hover:shadow-[0_0_25px_rgba(148,93,255,0.7)] disabled:opacity-60"
                onClick={() => refresh().catch(() => {})}
                disabled={loading || refreshing}
              >
                {refreshing ? '↻' : '↻'}
              </button>
            </div>

        {/* Score Card */}
        <div className="relative mt-4 rounded-[20px] border-2 border-[rgba(148,93,255,0.5)] bg-[rgba(12,4,26,0.9)] px-4 py-3 shadow-[0_0_20px_rgba(148,93,255,0.2)]">
          <div className="font-mono text-[17px] font-bold text-white">{scoreLine}</div>
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-gradient-to-r from-transparent via-[rgba(148,93,255,0.45)] to-transparent shadow-[0_0_8px_rgba(148,93,255,0.3)]" />

        {/* Booster Status Card */}
        <div className="relative overflow-hidden rounded-[20px] border-2 border-[rgba(125,255,207,0.4)] bg-[rgba(12,4,26,0.9)] px-4 py-3 shadow-[0_0_20px_rgba(125,255,207,0.15)]">
          {/* Status indicator */}
          <div className={`absolute -left-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full ${data?.care?.state === 'covered' ? 'bg-[rgba(125,255,207,0.2)] text-[#7dffcf] shadow-[0_0_10px_rgba(125,255,207,0.5)]' : 'bg-[rgba(148,93,255,0.2)] text-[#945dff]'}`}>
            {data?.care?.state === 'covered' ? '✓' : '○'}
          </div>
          <div className="flex items-center gap-2 pl-4">
            <span className="text-[16px]">🛡️</span>
            <div>
              <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#7dffcf]">Boosters</div>
              <div className="mt-0.5 font-mono text-[13px] text-white">
                {data?.care?.state === 'covered' && coveredRem ? (
                  <span className="animate-breathe text-[#8ff7ff] drop-shadow-[0_0_8px_rgba(143,247,255,0.6)]">{boosterLine}</span>
                ) : (
                  boosterLine
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gear Section */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="relative overflow-hidden rounded-[12px] border-2 border-[rgba(255,231,128,0.4)] bg-[rgba(12,4,26,0.8)] px-3 py-2 shadow-[0_0_15px_rgba(255,231,128,0.1)]">
            {/* Corner markers */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-0 top-0 h-3 w-3 border-l-[2px] border-t-[2px] border-[rgba(255,231,128,0.7)]" />
              <div className="absolute right-0 bottom-0 h-3 w-3 border-r-[2px] border-b-[2px] border-[rgba(255,231,128,0.7)]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">⚔️</span>
              <div className="flex-1 overflow-hidden">
                <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#ffe780]">Weapon</div>
                <div className="mt-0.5 truncate text-[11px] text-white/85">{weaponLine}</div>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[12px] border-2 border-[rgba(125,255,207,0.4)] bg-[rgba(12,4,26,0.8)] px-3 py-2 shadow-[0_0_15px_rgba(125,255,207,0.1)]">
            {/* Corner markers */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-0 top-0 h-3 w-3 border-l-[2px] border-t-[2px] border-[rgba(125,255,207,0.7)]" />
              <div className="absolute right-0 bottom-0 h-3 w-3 border-r-[2px] border-b-[2px] border-[rgba(125,255,207,0.7)]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">🛡️</span>
              <div className="flex-1 overflow-hidden">
                <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#7dffcf]">Shield</div>
                <div className="mt-0.5 truncate text-[11px] text-white/85">{shieldLine}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest Battle Card */}
        {data?.recentBattle && (
          <div
            className={`relative mt-3 overflow-hidden rounded-[20px] border-2 ${
              data.recentBattle.outcome === 'win'
                ? 'border-[rgba(125,255,207,0.6)] bg-[rgba(12,46,36,0.6)]'
                : 'border-[rgba(220,20,60,0.6)] bg-[rgba(46,14,20,0.6)]'
            } px-3 py-2.5`}
            style={{
              boxShadow: data.recentBattle.outcome === 'win'
                ? '0 0 25px rgba(125,255,207,0.3), 0 0 50px rgba(125,255,207,0.15)'
                : '0 0 25px rgba(220,20,60,0.3), 0 0 50px rgba(220,20,60,0.15)'
            }}
          >
            {/* Corner markers */}
            <div className="pointer-events-none absolute inset-0">
              <div className={`absolute left-0 top-0 h-3 w-3 border-l-[2px] border-t-[2px] ${data.recentBattle.outcome === 'win' ? 'border-[rgba(125,255,207,0.9)]' : 'border-[rgba(220,20,60,0.9)]'}`} />
              <div className={`absolute right-0 top-0 h-3 w-3 border-r-[2px] border-t-[2px] ${data.recentBattle.outcome === 'win' ? 'border-[rgba(125,255,207,0.9)]' : 'border-[rgba(220,20,60,0.9)]'}`} />
              <div className={`absolute bottom-0 left-0 h-3 w-3 border-b-[2px] border-l-[2px] ${data.recentBattle.outcome === 'win' ? 'border-[rgba(125,255,207,0.9)]' : 'border-[rgba(220,20,60,0.9)]'}`} />
              <div className={`absolute bottom-0 right-0 h-3 w-3 border-b-[2px] border-r-[2px] ${data.recentBattle.outcome === 'win' ? 'border-[rgba(125,255,207,0.9)]' : 'border-[rgba(220,20,60,0.9)]'}`} />
            </div>
            {/* Scan line for recent battle */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className={`h-px animate-scan-line ${data.recentBattle.outcome === 'win' ? 'bg-gradient-to-r from-transparent via-[rgba(125,255,207,0.6)] to-transparent' : 'bg-gradient-to-r from-transparent via-[rgba(220,20,60,0.6)] to-transparent'}`} />
            </div>
            <div className="relative flex items-start gap-2">
              <span className="text-[16px]">{data.recentBattle.outcome === 'win' ? '🏆' : '💀'}</span>
              <div className="flex-1">
                <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#8ff7ff]">Latest Battle</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-white/90">{recentBattleLine}</div>
              </div>
            </div>
          </div>
        )}

        {error ? (
          <div className="mt-3 rounded-[20px] border border-red-400/40 bg-red-900/40 px-3 py-2 text-[11px] text-red-100">
            {error.message || 'Failed to load player status.'}
          </div>
        ) : null}
          </div>
        )}

        {/* Energize Tab Content */}
        {activeTab === 'energize' && (
          <div className="relative animate-fade-in">
            <MyEnergizeStats />
          </div>
        )}
      </div>

      {/* Tab transition animation */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
