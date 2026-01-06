"use client"

import React, { useState, useEffect } from 'react'

import { formatDisplayPoints } from '@/src/shared/points'

import type { EnergizeProgress } from '../useEnergizeProgress'
import { BattleStatsCard } from './BattleStatsCard'

interface BattleStatsGridProps {
  energize: {
    state: 'covered' | 'cooldown' | 'ready'
    boosterLevel: number
    boostersActiveUntil: string | null
    cooldownEndsAt: string | null
    overdue: boolean
    lastEnergizeAt: string | null
    energizeCost: number | null
    consumedOrder: { id: number; txHash: string | null } | null
    dropAcc: number
  }
  progress: EnergizeProgress
  resolvedCost: number | null
  resolvedBalance: number | null
}

export const BattleStatsGrid: React.FC<BattleStatsGridProps> = ({
  energize,
  progress,
  resolvedCost,
  resolvedBalance
}) => {
  const [nextStrikeLabel, setNextStrikeLabel] = useState('READY NOW')

  useEffect(() => {
    if (energize.state === 'ready') {
      setNextStrikeLabel('READY NOW')
      return
    }

    const targetTime = energize.state === 'cooldown' ? energize.cooldownEndsAt : energize.boostersActiveUntil

    if (!targetTime) {
      setNextStrikeLabel(energize.state === 'covered' ? 'ACTIVE' : 'READY NOW')
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const target = new Date(targetTime).getTime()
      const diff = Math.max(0, target - now)

      if (diff === 0) {
        setNextStrikeLabel('READY NOW')
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setNextStrikeLabel(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [energize.state, energize.cooldownEndsAt, energize.boostersActiveUntil])

  const chargePercent = energize.state === 'covered'
    ? 100
    : energize.state === 'cooldown'
    ? 30
    : 100

  const attackTone = energize.state === 'ready' ? 'ready' : energize.state === 'covered' ? 'success' : 'cooldown'

  const resourcesReady = (resolvedBalance ?? 0) >= (resolvedCost ?? 0)
  const resourcesTone = resourcesReady ? 'ready' : 'warning'

  return (
    <>
      {/* Combat HUD: Stats Cards positioned around timer */}

      {/* Top-left: Attack Phase */}
      <div className="absolute top-6 left-6 w-[260px] z-10">
        <BattleStatsCard
          title="ATTACK PHASE"
          icon="⚔"
          tone={attackTone}
          stats={[
            {
              label: 'Status',
              value: energize.state.toUpperCase(),
              highlight: true
            },
            {
              label: 'Charge',
              value: `${chargePercent}%`,
              progress: chargePercent
            },
            {
              label: 'Next Strike',
              value: nextStrikeLabel
            }
          ]}
        />
      </div>

      {/* Top-right: Resources */}
      <div className="absolute top-6 right-6 w-[260px] z-10">
        <BattleStatsCard
          title="RESOURCES"
          icon="💰"
          tone={resourcesTone}
          stats={[
            {
              label: 'Energy Cost',
              value: resolvedCost != null ? `${formatDisplayPoints(resolvedCost)} BC` : '—'
            },
            {
              label: 'Available',
              value: resolvedBalance != null ? `${formatDisplayPoints(resolvedBalance)} BC` : '—',
              highlight: true
            },
            {
              label: 'Status',
              value: resourcesReady ? '✓ READY' : '✗ INSUFFICIENT'
            }
          ]}
        />
      </div>

      {/* Middle-right: Drop Chance */}
      <div className="absolute top-[280px] right-6 w-[260px] z-10">
        <BattleStatsCard
          title="DROP CHANCE"
          icon="🎲"
          tone="success"
          stats={[
            {
              label: 'Base Power',
              value: `${Math.round(progress.base * 100)}%`
            },
            {
              label: 'Luck Bonus',
              value: `+${Math.round(progress.bucketContribution * 100)}%`
            },
            {
              label: 'TOTAL CHANCE',
              value: `${Math.round(progress.effChance * 100)}%`,
              highlight: true,
              progress: progress.effChance * 100
            }
          ]}
        />
      </div>
    </>
  )
}
