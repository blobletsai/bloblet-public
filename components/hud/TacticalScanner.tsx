"use client"

import React from 'react'
import { shortAddress } from '@/src/shared/pvp'
import { BATTLE_TERMS } from '@/src/shared/gameplay/status'

export type TacticalScannerProps = {
  address: string
  meta: {
    balance: number | null
    stakeReady: boolean
    minStake: number | null
    balanceKnown: boolean
  }
  cooldownUntil: number | null
  onLaunch: (address: string) => void
  onClose: () => void
  onFocus: (address: string) => void
}

const formatCooldown = (msRemaining: number) => {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) return 'a few seconds'
  const totalSeconds = Math.ceil(msRemaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : `${seconds}s`
}

export const TacticalScanner: React.FC<TacticalScannerProps> = ({
  address,
  meta,
  cooldownUntil,
  onLaunch,
  onClose,
  onFocus,
}) => {
  const now = Date.now()
  const cooldownActive = Boolean(cooldownUntil && cooldownUntil > now)
  const stakeBlocked = Boolean(meta.balanceKnown && !meta.stakeReady)
  const engageDisabled = stakeBlocked || cooldownActive

  return (
    <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-2xl bg-[rgba(16,6,40,0.95)] shadow-2xl backdrop-blur-xl">
      {/* Header / Scanner Status */}
      <div className="relative border-b border-[rgba(148,93,255,0.3)] bg-[rgba(30,10,60,0.6)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-combat-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-combat-red"></span>
            </div>
            <span className="font-game text-[10px] uppercase tracking-[0.2em] text-combat-red">
              Target Locked
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>
        {/* Scan line decoration */}
        <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-combat-red to-transparent opacity-50" />
      </div>

      {/* Target Visual / Data */}
      <div className="flex-1 space-y-4 p-4">
        {/* Avatar Placeholder / Identity */}
        <div className="relative flex items-center gap-4 rounded-xl border border-fantasy-border/30 bg-fantasy-card/40 p-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black/40 text-2xl">
            👾
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[14px] font-bold text-white truncate">
              {shortAddress(address)}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-fantasy-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-combat-orange"></span>
              <span>Hostile</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-fantasy-muted">Win Prob</div>
            <div className="font-mono text-lg font-bold text-combat-cyan">--%</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-fantasy-muted">Reward</div>
            <div className="font-mono text-lg font-bold text-fantasy-accent">
              {meta.minStake ? `~${meta.minStake}` : '?'}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {stakeBlocked && (
          <div className="rounded-lg border border-combat-red/40 bg-combat-red/10 px-3 py-2 text-[10px] text-combat-red">
            ⚠️ {BATTLE_TERMS.rewardDeficit.label}: Target needs more BC.
          </div>
        )}
        {cooldownActive && cooldownUntil && (
          <div className="rounded-lg border border-combat-orange/40 bg-combat-orange/10 px-3 py-2 text-[10px] text-combat-orange">
            ⏳ Rematch ready in {formatCooldown(cooldownUntil - now)}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="mt-auto border-t border-white/10 bg-black/20 p-4 space-y-2">
        <button
          onClick={() => onLaunch(address)}
          disabled={engageDisabled}
          className={`
            group relative w-full overflow-hidden rounded-system-sm py-3 font-game text-xs-game uppercase tracking-wider transition-all
            ${engageDisabled 
              ? 'bg-white/5 text-white/30 cursor-not-allowed' 
              : 'bg-combat-red text-white hover:brightness-110 shadow-[0_0_20px_rgba(255,45,45,0.4)]'}
          `}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <span>⚔️</span>
            <span>Attack Target</span>
          </span>
        </button>
        
        <button
          onClick={() => onFocus(address)}
          className="w-full rounded-system-sm border border-white/10 bg-white/5 py-2 font-mono text-[10px] uppercase tracking-wider text-fantasy-muted hover:bg-white/10 hover:text-white"
        >
          Locate on Map
        </button>
      </div>
    </div>
  )
}
