"use client"

import React, { useMemo } from 'react'

import { formatDisplayPoints } from '@/src/shared/points'

import { SmartEnergizeButton } from './battle-components/SmartEnergizeButton'
import { CollapsibleLuckAccumulator } from './battle-components/CollapsibleLuckAccumulator'
import { useEnergizeProgress } from './useEnergizeProgress'
import { useLifeHub } from './LifeHubProvider'


type EnergizePanelProps = {
  energizeCost?: number | null
  rewardBalance?: number | null
  errorMessage?: string | null
  needsTopUp?: boolean | null
}

export const EnergizePanel: React.FC<EnergizePanelProps> = ({
  energizeCost,
  rewardBalance,
  errorMessage,
  needsTopUp,
}) => {
  const lifeHub = useLifeHub(true)
  const energize = lifeHub?.energize
  if (!energize) {
    throw new Error('EnergizePanel must be rendered within a LifeHubProvider or supplied with energize data')
  }

  const progress = useEnergizeProgress(5, energize.dropAcc)

  const resolvedCost = energizeCost ?? lifeHub?.energizeCost ?? null
  const resolvedBalance = rewardBalance ?? lifeHub?.rewardBalance ?? null
  const resolvedError = errorMessage ?? lifeHub?.errorMessage ?? null
  const fastForwardAvailable = lifeHub?.fastForwardAvailable === true
  const fastForwardDisabledReason = lifeHub?.fastForwardDisabledReason ?? null
  const fastForwardDisabled =
    !fastForwardAvailable ||
    typeof lifeHub?.onFastForward !== 'function' ||
    Boolean(fastForwardDisabledReason) ||
    lifeHub?.energizing

  const balanceLabel =
    resolvedBalance != null && Number.isFinite(resolvedBalance)
      ? `${formatDisplayPoints(resolvedBalance)} BC`
      : '—'

  const guaranteeWithin = useMemo(() => {
    if (!progress.base || progress.base <= 0) return null
    return Math.max(1, Math.ceil(1 / progress.base))
  }, [progress.base])

  const hasEnoughBalance = (resolvedBalance ?? 0) >= (resolvedCost ?? 0)

  return (
    <div className="w-full py-8 px-6 border-2 border-[rgba(0,255,247,0.3)] bg-[rgba(10,2,23,0.85)] rounded-lg shadow-[0_0_20px_rgba(0,255,247,0.2)]">
      {/* Simplified Layout - Centered */}

      {/* Main Action Button */}
      <div className="flex justify-center mb-6">
        <SmartEnergizeButton
          state={energize.state}
          targetTime={
            energize.state === 'covered' ? energize.boostersActiveUntil :
            energize.state === 'cooldown' ? energize.cooldownEndsAt :
            null
          }
          boosterLevel={energize.boosterLevel}
          energizeCost={resolvedCost}
          balance={resolvedBalance}
        />
      </div>

      {fastForwardAvailable && (
        <div className="flex justify-center mb-4">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              className="btn-fantasy-ghost px-5 py-3 text-[13px]"
              onClick={() => lifeHub?.onFastForward?.()}
              disabled={fastForwardDisabled}
            >
              Jump ahead (up to 3 Nourishes now)
            </button>
            <span className="text-[10px] text-[#8ff7ff] opacity-80 px-1">
              Uses normal cost; up to 2 bursts/day · debt: 15–45m
            </span>
            {fastForwardDisabledReason ? (
              <span className="text-[10px] text-[#ffb46b] opacity-90 px-1">
                {fastForwardDisabledReason}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Info Bar - Balance & Drop Chance */}
      <div className="flex justify-between items-center px-4 py-3 mb-4 border border-[rgba(148,93,255,0.3)] bg-[rgba(28,12,72,0.5)] rounded">
        <div className="flex items-center gap-2">
          <span className="font-pressstart text-[10px] text-[#c7b5ff]">Balance:</span>
          <span className={`font-pressstart text-[11px] ${hasEnoughBalance ? 'text-[#7dffcf]' : 'text-[#ffb46b]'}`}>
            {balanceLabel}
          </span>
          <span className="text-[12px]">{hasEnoughBalance ? '✓' : '✗'}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-pressstart text-[10px] text-[#c7b5ff]">Drop Chance:</span>
          <span className="font-pressstart text-[11px] text-[#7dffcf]">
            {Math.round(progress.effChance * 100)}%
          </span>
        </div>
      </div>

      {/* Collapsible Luck Accumulator */}
      <div className="mb-4">
        <CollapsibleLuckAccumulator
          progress={progress}
          guaranteeWithin={guaranteeWithin}
        />
      </div>

      {/* Error Message */}
      {resolvedError && (
        <div className="mt-4 rounded-lg border border-red-400/40 bg-red-900/40 px-4 py-3 text-[11px] text-red-100">
          {resolvedError}
        </div>
      )}
    </div>
  )
}
