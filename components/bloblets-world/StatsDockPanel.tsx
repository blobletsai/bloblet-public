"use client"

import React, { useMemo } from 'react'
import { usePlayerStatus } from '@/src/client/hooks/usePlayerStatus'
import { formatDisplayPoints } from '@/src/shared/points'

type StatsDockPanelProps = {
  rewardsCard: React.ReactNode
}

function formatIso(iso: string | null | undefined) {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatGearLine(name?: string | null, rarity?: string | null) {
  if (!name) return 'None equipped'
  if (!rarity) return name
  return `${name} · ${rarity.toUpperCase()}`
}

export const StatsDockPanel: React.FC<StatsDockPanelProps> = ({ rewardsCard }) => {
  const { data, loading, refreshing, error, refresh } = usePlayerStatus({ refreshIntervalMs: 45_000 })

  const scoreLine = useMemo(() => {
    if (!data?.score) return loading ? 'Loading score…' : 'Score unavailable'
    const balance = formatDisplayPoints(data.score.balance)
    const tier = data.score.tier ? data.score.tier.toUpperCase() : 'ROOKIE'
    const rank = data.score.rank != null ? `#${data.score.rank}` : 'Unranked'
    return `${balance} BC · ${tier} · ${rank}`
  }, [data?.score, loading])

  const boosterLine = useMemo(() => {
    if (!data?.care) return loading ? 'Checking boosters…' : '—'
    const level = data.care.boosterLevel ?? 0
    if (data.care.state === 'covered') {
      return `Boosters active · lvl ${level} · Until ${formatIso(data.care.boostersActiveUntil)}`
    }
    if (data.care.cooldownEndsAt) {
      return `Cooldown · lvl ${level} · Ready ${formatIso(data.care.cooldownEndsAt)}`
    }
    return `Boosters lvl ${level}`
  }, [data?.care, loading])

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
      <div className="rounded-[28px] border border-[rgba(148,93,255,0.35)] bg-[rgba(20,10,36,0.92)] px-5 py-5 shadow-[0_18px_44px_rgba(8,2,24,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.28em] text-[#8ff7ff]">Score & Boosters</div>
            <div className="mt-2 text-[12px] text-[#f8f2ff]/85">
              Track your arcade balance and booster uptime so you know when to nourish or jump into battle.
            </div>
          </div>
          <button
            type="button"
            className="btn-fantasy-ghost px-3 py-1 text-[11px]"
            onClick={() => refresh().catch(() => {})}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <dl className="mt-4 space-y-3 text-[12px] text-[#f5ecff]">
          <div>
            <dt className="font-pressstart pixel-tiny uppercase tracking-[0.24em] text-[#ffe780]">Arcade Score</dt>
            <dd className="mt-1 text-[13px] text-white">{scoreLine}</dd>
          </div>
          <div>
            <dt className="font-pressstart pixel-tiny uppercase tracking-[0.24em] text-[#ffe780]">Boosters</dt>
            <dd className="mt-1 text-[13px] text-white">{boosterLine}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="font-pressstart pixel-tiny uppercase tracking-[0.24em] text-[#c7b5ff]">Weapon</dt>
              <dd className="mt-1 text-[12px] text-white/85">{weaponLine}</dd>
            </div>
            <div>
              <dt className="font-pressstart pixel-tiny uppercase tracking-[0.24em] text-[#c7b5ff]">Shield</dt>
              <dd className="mt-1 text-[12px] text-white/85">{shieldLine}</dd>
            </div>
          </div>
          <div>
            <dt className="font-pressstart pixel-tiny uppercase tracking-[0.24em] text-[#8ff7ff]">Latest Battle</dt>
            <dd className="mt-1 text-[12px] text-white/80">{recentBattleLine}</dd>
          </div>
        </dl>
        {error ? (
          <div className="mt-3 rounded-[20px] border border-red-400/40 bg-red-900/40 px-3 py-2 text-[11px] text-red-100">
            {error.message || 'Failed to load player status.'}
          </div>
        ) : null}
      </div>
      {rewardsCard}
    </div>
  )
}
