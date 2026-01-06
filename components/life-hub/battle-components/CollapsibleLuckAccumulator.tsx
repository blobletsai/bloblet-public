"use client"

import React, { useState } from 'react'

import type { EnergizeProgress } from '../useEnergizeProgress'

interface CollapsibleLuckAccumulatorProps {
  progress: EnergizeProgress
  guaranteeWithin: number | null
}

export const CollapsibleLuckAccumulator: React.FC<CollapsibleLuckAccumulatorProps> = ({
  progress,
  guaranteeWithin
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const fillPercent = progress.bucketFillPercent * 100
  const effChancePercent = Math.round(progress.effChance * 100)

  return (
    <div className="w-full">
      {/* Collapsed View - Simple Progress Bar */}
      <div className="flex items-center gap-3">
        <span className="font-pressstart text-[10px] text-[#c7b5ff]">
          Luck Progress
        </span>

        <div className="flex-1 relative h-5 bg-[rgba(20,8,50,0.9)] rounded overflow-hidden border border-[rgba(125,255,207,0.3)]">
          {/* Animated fill */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#7dffcf] via-[#00fff7] to-[#7dffcf] transition-all duration-500 animate-power-flow"
            style={{
              width: `${fillPercent}%`,
              boxShadow: '0 0 12px rgba(125, 255, 207, 0.6)'
            }}
          />

          {/* Pip markers */}
          <div className="absolute inset-0 flex items-center justify-evenly px-1">
            {Array.from({ length: progress.totalPips }).map((_, i) => (
              <div
                key={i}
                className={`
                  w-1 h-3 rounded-sm
                  ${i < progress.filledPips
                    ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
                    : 'bg-[rgba(255,255,255,0.2)]'
                  }
                `}
              />
            ))}
          </div>
        </div>

        <span className="font-pressstart text-[10px] text-[#7dffcf]">
          {Math.round(fillPercent)}%
        </span>

        {/* Toggle button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2 py-1 text-[9px] border border-[#7dffcf]/40 bg-[rgba(125,255,207,0.1)] text-[#7dffcf] font-pressstart hover:bg-[rgba(125,255,207,0.2)] transition-all rounded"
        >
          {isExpanded ? '▲ Hide' : '▼ Details'}
        </button>
      </div>

      {/* Expanded View - Detailed Stats */}
      {isExpanded && (
        <div className="mt-4 p-4 border-2 border-[#7dffcf]/40 bg-[rgba(12,46,38,0.4)] rounded-lg shadow-[0_0_20px_rgba(125,255,207,0.2)]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 border-b border-[#7dffcf]/30 pb-2">
            <span className="text-[16px]">⚡</span>
            <span className="font-pressstart text-[10px] text-[#7dffcf] tracking-wider">
              LUCK ACCUMULATOR SYSTEM
            </span>
          </div>

          {/* Pip display */}
          <div className="flex items-center gap-2 mb-4">
            {Array.from({ length: progress.totalPips }).map((_, i) => (
              <div
                key={i}
                className={`
                  w-8 h-8 rounded border-2
                  flex items-center justify-center
                  font-pressstart text-[10px]
                  transition-all duration-300
                  ${i < progress.filledPips
                    ? 'border-[#7dffcf] bg-[rgba(125,255,207,0.25)] text-[#7dffcf] shadow-[0_0_8px_rgba(125,255,207,0.6)]'
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
          <div className="space-y-2 text-[10px]">
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
            <div className="mt-4 p-3 bg-[rgba(125,255,207,0.15)] border border-[rgba(125,255,207,0.3)] rounded">
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
            <div className="mt-3 p-3 bg-[rgba(255,180,107,0.15)] border border-[rgba(255,180,107,0.4)] rounded">
              <div className="flex items-center gap-2">
                <span className="text-[14px]">🎁</span>
                <span className="font-pressstart text-[8px] text-[#ffb46b]">
                  REWARD PENDING - CLAIM NOW
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
