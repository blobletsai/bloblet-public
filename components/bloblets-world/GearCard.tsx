"use client"

import React from 'react'
import type { LoadoutCard } from './loadoutSelectors'

type Props = {
  card: LoadoutCard
  variant?: 'hero' | 'compact'
  boosterLevel?: number
  coveredUntil?: string | null
  isBroken?: boolean
}

export const GearCard: React.FC<Props> = ({ card, variant = 'hero', boosterLevel = 0, coveredUntil = null, isBroken = false }) => {
  // Booster indicators are threaded from parent to avoid duplicate status fetches
  const equipped = card.equipped

  // Broken state overrides normal equipped colors
  const baseClass = isBroken
    ? 'border-[rgba(255,107,154,0.65)] bg-[rgba(46,14,20,0.96)] animate-threat-pulse'
    : equipped
      ? 'border-[rgba(143,247,255,0.55)] bg-[rgba(26,10,62,0.96)]'
      : 'border-[rgba(148,93,255,0.32)] bg-[rgba(20,8,44,0.86)]'

  // Dramatic glow effects based on gear type and equipped state
  const glowEffect = isBroken
    ? 'shadow-[0_0_40px_rgba(255,107,154,0.5),0_0_80px_rgba(255,107,154,0.25)]'
    : equipped && card.kind === 'weapon'
      ? 'shadow-[0_0_30px_rgba(255,231,128,0.8),0_0_60px_rgba(255,231,128,0.45),0_24px_64px_rgba(12,2,28,0.6)]'
      : equipped && card.kind === 'shield'
        ? 'shadow-[0_0_30px_rgba(125,255,207,0.8),0_0_60px_rgba(125,255,207,0.45),0_24px_64px_rgba(12,2,28,0.6)]'
        : 'shadow-[0_24px_64px_rgba(12,2,28,0.6)]'

  const borderThickness = variant === 'hero' && equipped ? 'border-[3px]' : 'border'

  const pad = variant === 'hero' ? 'p-2.5' : 'p-3'
  const radius = variant === 'hero' ? 'rounded-[28px]' : 'rounded-[18px]'
  const titleSize = variant === 'hero' ? 'text-[16px]' : 'text-[14px]'
  const descSize = variant === 'hero' ? 'text-[12px]' : 'text-[11px]'

  return (
    <div className={`relative overflow-hidden ${borderThickness} ${radius} ${pad} text-white transition-all duration-300 ${baseClass} ${glowEffect}`}>
      {/* Broken state overlay */}
      {isBroken && (
        <div className="cracked-glass pointer-events-none absolute inset-0 z-10" />
      )}

      {/* Scan line overlay for equipped items */}
      {equipped && !isBroken && variant === 'hero' && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <div className="animate-scan-line absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.6)] to-transparent" />
        </div>
      )}

      {/* Vertical portrait layout */}
      <div className="relative flex flex-col items-center justify-center space-y-2 py-1.5 text-center">
        {/* Large centered icon at TOP */}
        <div className="mb-1 h-[72px] w-[72px]">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl}
              alt={card.title}
              className="h-full w-full object-contain drop-shadow-[0_0_20px_currentColor]"
              style={{
                imageRendering: 'pixelated',
                color: card.kind === 'weapon' ? 'rgba(255,231,128,0.6)' : 'rgba(125,255,207,0.6)'
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[48px]">
              {card.icon}
            </div>
          )}
        </div>

        {/* Title - centered */}
        <div className="px-2 text-[16px] font-semibold leading-tight text-white">
          {card.title}
        </div>

        {/* Rarity badge - centered */}
        {equipped ? (
          <div className="font-pressstart rounded-full border border-[rgba(143,247,255,0.5)] bg-[rgba(143,247,255,0.2)] px-3 py-1 text-[9px] uppercase text-[#8ff7ff]">
            EQUIPPED
          </div>
        ) : (
          <div className="font-pressstart rounded-full border-2 border-[rgba(255,231,128,0.8)] bg-[rgba(255,231,128,0.1)] px-3 py-1 text-[9px] uppercase text-[#ffe780]">
            {card.rarity}
          </div>
        )}

        {/* Stats - large and centered at bottom */}
        <div className={`mt-1 text-[20px] font-bold ${card.kind === 'weapon' ? 'text-[#ffe780]' : 'text-[#7dffcf]'}`}>
          {card.statValue}
        </div>

        {/* Corner markers */}
        <div className="corner-markers pointer-events-none absolute inset-0">
          <div className={`absolute left-0 top-0 h-4 w-4 border-l-[3px] border-t-[3px] ${card.kind === 'weapon' ? 'border-[rgba(255,231,128,0.85)]' : 'border-[rgba(125,255,207,0.85)]'}`} />
          <div className={`absolute right-0 top-0 h-4 w-4 border-r-[3px] border-t-[3px] ${card.kind === 'weapon' ? 'border-[rgba(255,231,128,0.85)]' : 'border-[rgba(125,255,207,0.85)]'}`} />
          <div className={`absolute bottom-0 left-0 h-4 w-4 border-b-[3px] border-l-[3px] ${card.kind === 'weapon' ? 'border-[rgba(255,231,128,0.85)]' : 'border-[rgba(125,255,207,0.85)]'}`} />
          <div className={`absolute bottom-0 right-0 h-4 w-4 border-b-[3px] border-r-[3px] ${card.kind === 'weapon' ? 'border-[rgba(255,231,128,0.85)]' : 'border-[rgba(125,255,207,0.85)]'}`} />
        </div>

        {/* Booster indicators */}
        {boosterLevel > 0 && (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 text-[10px]">
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(6, boosterLevel) }).map((_, i) => (
                <span key={i} className="inline-block h-2.5 w-2.5 rounded-full bg-[#7dffcf] shadow-[0_0_6px_rgba(125,255,207,0.7)]" />
              ))}
            </div>
            {coveredUntil && (
              <span className="ml-1 rounded-full border border-[rgba(143,247,255,0.35)] bg-[rgba(12,4,26,0.5)] px-1.5 py-0.5 text-[#8ff7ff]">
                Covered
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
