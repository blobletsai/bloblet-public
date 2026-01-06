"use client"

import React from 'react'

import HudTooltip from '../HudTooltip'

type RewardBadgeProps = {
  tooltip: string
  balanceLabel: string
  onBuyPoints: () => void
  buyDisabled?: boolean
  walletButton: React.ReactNode
}

export const RewardBadge: React.FC<RewardBadgeProps> = ({
  tooltip,
  balanceLabel,
  onBuyPoints,
  buyDisabled = false,
  walletButton,
}) => {
  return (
    <div className="pointer-events-none absolute right-6 top-6 z-50">
      <div className="pointer-events-auto flex items-center gap-system-sm">
        <HudTooltip content={tooltip} side="bottom" align="end">
          {/* Mission Control - Resource Display */}
          <div
            className="relative flex items-center gap-2 overflow-hidden clip-tactical-badge border border-[rgba(148,93,255,0.45)] bg-[rgba(20,8,48,0.92)] px-3.5 py-1.5 shadow-[0_18px_46px_rgba(12,2,28,0.45)] backdrop-blur-sm transition-all duration-300 hover:border-[rgba(148,93,255,0.65)] hover:shadow-[0_20px_50px_rgba(12,2,28,0.6),0_8px_16px_rgba(148,93,255,0.25)]"
            aria-label={tooltip}
          >
            {/* Scan line overlay - tactical display effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.2)] to-transparent blur-[0.5px] animate-scan-line" />
            </div>

            <span aria-hidden className="relative z-10 text-sm transition-transform duration-200 hover:scale-125">🪙</span>
            <span className="relative z-10 font-game text-xs-game uppercase tracking-[0.18em] text-[#8ff7ff]">BC</span>
            <span className="relative z-10 font-mono text-sm-mono font-semibold text-white/90 transition-all duration-200 animate-pulse-subtle">{balanceLabel}</span>

            {/* Refuel Button - Tactical Action */}
            <button
              type="button"
              onClick={onBuyPoints}
              disabled={buyDisabled}
              className="relative z-10 overflow-hidden rounded-system-sm clip-slash-corner-tr border border-[rgba(148,93,255,0.35)] bg-[rgba(34,14,68,0.85)] px-system-sm py-1 font-game text-xs-game uppercase tracking-[0.18em] text-[#c7b5ff] transition-all duration-300 hover:scale-[1.08] hover:border-[#ff9de1] hover:bg-[rgba(44,18,88,0.95)] hover:text-white hover:shadow-[0_8px_20px_rgba(255,157,225,0.3),0_0_12px_rgba(255,157,225,0.2)] disabled:opacity-medium disabled:cursor-not-allowed"
              aria-label="Buy BlobCoin"
            >
              {/* Corner markers on hover */}
              <span className="corner-markers absolute inset-0 opacity-0 hover:opacity-50 transition-opacity duration-300 pointer-events-none" aria-hidden="true" />
              Refuel
            </button>
          </div>
        </HudTooltip>

        {/* Wallet Connection - Tactical Status */}
        <div className="clip-tactical-badge border border-[rgba(148,93,255,0.45)] bg-[rgba(20,8,48,0.92)] px-3 py-1.5 shadow-[0_18px_46px_rgba(12,2,28,0.45)] backdrop-blur-sm transition-all duration-300 hover:border-[rgba(148,93,255,0.65)] hover:shadow-[0_20px_50px_rgba(12,2,28,0.6),0_8px_16px_rgba(148,93,255,0.25)]">
          {walletButton}
        </div>
      </div>
    </div>
  )
}
