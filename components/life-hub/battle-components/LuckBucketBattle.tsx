"use client"

import React from 'react'

import type { EnergizeProgress } from '../useEnergizeProgress'

interface LuckBucketBattleProps {
  progress: EnergizeProgress
  guaranteeWithin: number | null
}

export const LuckBucketBattle: React.FC<LuckBucketBattleProps> = ({
  progress,
  guaranteeWithin
}) => {
  const fillPercent = progress.bucketFillPercent * 100
  const effChancePercent = Math.round(progress.effChance * 100)

  return (
    <div className="
      clip-slash-corner-bl
      border-2 border-[#7dffcf] tech-border
      bg-[rgba(12,46,38,0.6)]
      p-4
      shadow-[0_0_30px_rgba(125,255,207,0.4)]
      relative
      damage-texture
      animate-energy-pulse
    ">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-[#7dffcf]/30 pb-2 relative z-10">
        <span className="text-[18px]">⚡</span>
        <span className="font-pressstart text-[10px] text-[#7dffcf] tracking-wider">
          LUCK ACCUMULATOR SYSTEM
        </span>
        <div className="ml-auto w-2 h-2 border-t-2 border-r-2 border-[#7dffcf] opacity-50" />
      </div>

      {/* Power bar */}
      <div className="mb-3 relative z-10">
        <div className="flex justify-between items-center mb-2">
          <span className="font-pressstart text-[8px] text-[#c7b5ff]">
            POWER LEVEL
          </span>
          <span className="font-pressstart text-[10px] text-[#7dffcf]">
            {Math.round(fillPercent)}%
          </span>
        </div>

        <div className="relative h-6 bg-[rgba(20,8,50,0.9)] clip-slash-corner-tl overflow-hidden border-2 border-[rgba(125,255,207,0.4)]">
          {/* Animated fill */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#7dffcf] via-[#00fff7] to-[#7dffcf] transition-all duration-500 animate-power-flow"
            style={{
              width: `${fillPercent}%`,
              boxShadow: '0 0 16px rgba(125, 255, 207, 0.8)'
            }}
          />

          {/* Pip markers */}
          <div className="absolute inset-0 flex items-center justify-evenly px-1">
            {Array.from({ length: progress.totalPips }).map((_, i) => (
              <div
                key={i}
                className={`
                  w-1 h-4 clip-hexagon
                  ${i < progress.filledPips
                    ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,1)] animate-hologram-flicker'
                    : 'bg-[rgba(255,255,255,0.2)]'
                  }
                `}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pip display */}
      <div className="flex items-center gap-2 mb-4 relative z-10">
        {Array.from({ length: progress.totalPips }).map((_, i) => (
          <div
            key={i}
            className={`
              w-6 h-6 clip-hexagon border-2
              flex items-center justify-center
              font-pressstart text-[8px]
              transition-all duration-300
              ${i < progress.filledPips
                ? 'border-[#7dffcf] bg-[rgba(125,255,207,0.25)] text-[#7dffcf] shadow-[0_0_8px_rgba(125,255,207,0.6)] animate-energy-pulse'
                : 'border-[rgba(125,255,207,0.3)] bg-transparent text-[rgba(125,255,207,0.4)]'
              }
            `}
          >
            {i < progress.filledPips ? '⬢' : '⬡'}
          </div>
        ))}
        <span className="ml-2 font-pressstart text-[9px] text-white">
          {progress.filledPips}/{progress.totalPips} CHARGED
        </span>
      </div>

      {/* Stats */}
      <div className="space-y-2 text-[10px] relative z-10">
        <div className="flex justify-between">
          <span className="text-[#c7b5ff]">Base Drop Rate</span>
          <span className="text-white font-semibold">{Math.round(progress.base * 100)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#c7b5ff]">Accumulated Bonus</span>
          <span className="text-[#7dffcf] font-semibold">+{Math.round(progress.bucketContribution * 100)}%</span>
        </div>
        <div className="flex justify-between border-t border-[rgba(125,255,207,0.2)] pt-2">
          <span className="text-[#c7b5ff]">Effective Chance</span>
          <span className="text-[#7dffcf] font-semibold text-[12px]">{effChancePercent}%</span>
        </div>
      </div>

      {/* Guarantee notice */}
      {guaranteeWithin && (
        <div className="mt-4 p-3 bg-[rgba(125,255,207,0.15)] border-2 border-[rgba(125,255,207,0.4)] clip-slash-corner-tr animate-hazard-blink relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">⚡</span>
            <span className="font-pressstart text-[8px] text-[#7dffcf]">
              GUARANTEED DROP IN ≤ {guaranteeWithin} STRIKES
            </span>
          </div>
        </div>
      )}

      {/* RNG Pending alert */}
      {progress.rngPending && (
        <div className="mt-3 p-3 bg-[rgba(255,180,107,0.15)] border-2 border-[rgba(255,180,107,0.5)] clip-slash-corner-tr animate-threat-pulse relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">🎁</span>
            <span className="font-pressstart text-[8px] text-[#ffb46b]">
              REWARD PENDING - CLAIM NOW
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
