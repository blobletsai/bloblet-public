"use client"

import React from 'react'
import type { RewardLedgerEntry } from '@/components/hooks/useRewardsSnapshot'
import { formatDeltaPoints, formatDisplayPoints } from '@/src/shared/points'
import { formatTimeAgo, ledgerReasonLabel } from '@/components/bloblets-world/formatters'

type CombatLogPanelProps = {
  rewardsError: string | null
  isLoading: boolean
  hasAddress: boolean
  entries: RewardLedgerEntry[]
  expandedIds: Set<number>
  onToggle: (id: number) => void
  rewardTokenSymbol: string
  walletConnected?: boolean
  isHolder?: boolean
  minTokens?: number | null
}

export const CombatLogPanel: React.FC<CombatLogPanelProps> = ({
  rewardsError,
  isLoading,
  hasAddress,
  entries,
  expandedIds,
  onToggle,
  rewardTokenSymbol,
  walletConnected,
  isHolder,
  minTokens,
}) => {
  const showMinTokenNotice =
    walletConnected && !isHolder && typeof minTokens === 'number'

  return (
    <div className="relative overflow-hidden rounded-[36px] border-2 border-[rgba(148,93,255,0.65)] bg-[rgba(16,6,40,0.85)] px-4 py-3 shadow-[0_0_60px_rgba(148,93,255,0.65),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(255,157,225,0.3)] max-w-[320px]">
      {/* Atmospheric background layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
        {/* Purple/Magenta nebula glow */}
        <div className="absolute inset-0 bg-gradient-radial from-[rgba(255,45,215,0.2)] via-[rgba(148,93,255,0.12)] to-transparent opacity-75" />

        {/* Star field - layer 1 (small stars) */}
        <div className="absolute inset-0 opacity-60" style={{
          backgroundImage: 'radial-gradient(1px 1px at 15% 20%, white, transparent), radial-gradient(1px 1px at 70% 30%, white, transparent), radial-gradient(1px 1px at 40% 55%, white, transparent), radial-gradient(1px 1px at 80% 75%, white, transparent), radial-gradient(1px 1px at 12% 50%, white, transparent), radial-gradient(1px 1px at 55% 20%, white, transparent), radial-gradient(1px 1px at 25% 80%, white, transparent), radial-gradient(1px 1px at 90% 45%, white, transparent)',
          backgroundSize: '250px 250px'
        }} />

        {/* Star field - layer 2 (colored stars) */}
        <div className="absolute inset-0 opacity-45" style={{
          backgroundImage: 'radial-gradient(1.5px 1.5px at 20% 25%, rgba(255,157,225,0.9), transparent), radial-gradient(1.5px 1.5px at 65% 50%, rgba(255,231,128,0.9), transparent), radial-gradient(1.5px 1.5px at 30% 75%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 75% 18%, rgba(125,255,207,0.9), transparent)',
          backgroundSize: '280px 280px'
        }} />

        {/* Atmospheric haze */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(255,45,215,0.08)] via-transparent to-[rgba(148,93,255,0.12)] opacity-40" />
      </div>

      {/* Corner markers (tactical brackets) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-4 w-4 border-l-[3px] border-t-[3px] border-[rgba(255,157,225,0.85)]" />
        <div className="absolute right-0 top-0 h-4 w-4 border-r-[3px] border-t-[3px] border-[rgba(255,157,225,0.85)]" />
        <div className="absolute bottom-0 left-0 h-4 w-4 border-b-[3px] border-l-[3px] border-[rgba(255,157,225,0.85)]" />
        <div className="absolute bottom-0 right-0 h-4 w-4 border-b-[3px] border-r-[3px] border-[rgba(255,157,225,0.85)]" />
      </div>

      {/* Scan line effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="h-px animate-scan-line bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.4)] to-transparent" />
      </div>

      <div className="relative flex items-center gap-2">
        <span className="text-[14px]" aria-hidden>💰</span>
        <div className="font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#ff9de1]">
          Recent Battles
        </div>
      </div>
      <div className="mt-3 max-h-[360px] overflow-y-auto pr-1 space-y-2">
        {rewardsError ? (
          <div className="relative rounded-lg border border-[rgba(220,20,60,0.4)] bg-[rgba(48,10,26,0.85)] px-2 py-2 text-center text-[10px] text-[#ff8fab]">
            <div className="text-[16px] mb-0.5 opacity-40">⚠️</div>
            <div>{rewardsError}</div>
          </div>
        ) : hasAddress ? (
          isLoading ? (
            <div className="relative rounded-lg border border-[rgba(148,93,255,0.2)] bg-[rgba(26,10,44,0.85)] px-2 py-2 text-center text-[10px] text-fantasy-muted">
              <div className="text-[16px] mb-0.5 opacity-40">⟳</div>
              <div>Loading...</div>
            </div>
          ) : entries.length ? (
            <ul className="relative space-y-1.5 max-h-[200px] overflow-y-auto pr-1" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(148,93,255,0.4) rgba(10,3,22,0.3)'
            }}>
              {entries.map((entry, idx) => {
                const isWin = entry.reason === 'battle_win'
                const isLoss = entry.reason === 'battle_loss'
                const isPositive = entry.delta > 0
                const absDelta = Math.abs(entry.delta)

                // Tiered color system based on battle importance (point transfer)
                const getTierColors = () => {
                  if (absDelta >= 6) return {
                    border: 'rgba(143,247,255,0.7)',
                    bg: 'rgba(12,32,46,0.9)',
                    glow: '0 0 20px rgba(143,247,255,0.3), 0 0 40px rgba(143,247,255,0.15)',
                    tier: 'T6+'
                  }
                  if (absDelta >= 4) return {
                    border: 'rgba(255,231,128,0.7)',
                    bg: 'rgba(36,28,12,0.9)',
                    glow: '0 0 18px rgba(255,231,128,0.3), 0 0 36px rgba(255,231,128,0.15)',
                    tier: 'T4'
                  }
                  if (absDelta >= 2) return {
                    border: 'rgba(168,85,247,0.6)',
                    bg: 'rgba(28,12,46,0.9)',
                    glow: '0 0 15px rgba(168,85,247,0.25)',
                    tier: 'T2'
                  }
                  return {
                    border: 'rgba(148,93,255,0.4)',
                    bg: 'rgba(18,8,36,0.92)',
                    glow: '0 0 10px rgba(148,93,255,0.15)',
                    tier: 'T1'
                  }
                }

                const tierColors = getTierColors()
                const barColor = isWin ? 'rgba(125,255,207,0.7)' : isLoss ? 'rgba(220,20,60,0.7)' : isPositive ? 'rgba(143,247,255,0.6)' : 'rgba(255,157,225,0.6)'
                const icon = isWin ? '🏆' : isLoss ? '💀' : entry.reason === 'care_upkeep' ? '❤️' : entry.delta > 0 ? '💰' : '💎'
                const isExpanded = expandedIds.has(entry.id)
                const hasBattle = isWin || isLoss

                return (
                  <li
                    key={entry.id}
                    className="relative rounded-[12px] border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
                    style={{
                      borderColor: tierColors.border,
                      backgroundColor: tierColors.bg,
                      boxShadow: tierColors.glow,
                      animation: `slide-in 0.3s ease-out ${idx * 0.05}s both`
                    }}
                  >
                    {/* Left status indicator bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}` }} />

                    {/* Scan line on most recent (first) entry */}
                    {idx === 0 && (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="h-px animate-scan-line bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.5)] to-transparent" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onToggle(entry.id)}
                      className="w-full text-left pl-3 pr-2 py-1.5 hover:bg-[rgba(148,93,255,0.12)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {/* Status indicator dot */}
                          <div className={`flex h-4 w-4 items-center justify-center rounded-full ${isWin ? 'bg-[rgba(125,255,207,0.2)] text-[#7dffcf] shadow-[0_0_6px_rgba(125,255,207,0.5)]' : isLoss ? 'bg-[rgba(220,20,60,0.2)] text-[#ff6b9a] shadow-[0_0_6px_rgba(220,20,60,0.5)]' : 'bg-[rgba(148,93,255,0.2)]'} text-[10px]`}>
                            {isWin ? '✓' : isLoss ? '✕' : '○'}
                          </div>
                          <span className="font-mono font-semibold" style={{
                            color: isPositive ? '#7dffcf' : '#ff9de1'
                          }}>
                            {formatDeltaPoints(entry.delta)}
                          </span>
                          {/* Tier badge for high-value battles */}
                          {absDelta >= 2 && (
                            <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-mono" style={{
                              borderColor: tierColors.border,
                              backgroundColor: `${tierColors.border}20`,
                              color: tierColors.border
                            }}>
                              {tierColors.tier}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-fantasy-muted font-mono">{formatTimeAgo(entry.createdAt)}</span>
                          {hasBattle && <span className="text-[9px] text-fantasy-muted">{isExpanded ? '▼' : '▶'}</span>}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-1.5 pt-1.5 border-t border-[rgba(148,93,255,0.2)] space-y-1">
                          <div className="text-[10px] text-[#c7b5ff]">
                            {ledgerReasonLabel(entry.reason)}
                          </div>
                          {entry.balanceAfter != null && (
                            <div className="text-[9px] text-[#8ff7ff] font-mono">
                              Balance after: {formatDisplayPoints(entry.balanceAfter, entry.balanceAfter >= 10 ? { maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })} BC
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="relative rounded-lg border border-[rgba(148,93,255,0.2)] bg-[rgba(26,10,44,0.85)] px-2 py-2 text-center text-[10px] text-fantasy-muted">
              <div className="text-[16px] mb-0.5 opacity-40">⚔️</div>
              <div>No rewards yet</div>
            </div>
          )
        ) : showMinTokenNotice ? (
          <div className="relative rounded-lg border border-[rgba(220,20,60,0.4)] bg-[rgba(48,10,26,0.85)] px-2 py-2 text-center text-[10px] text-[#ff8fab]">
            <div className="text-[16px] mb-0.5 opacity-40">⚠️</div>
            <div>Need ≥ {minTokens?.toLocaleString()} {rewardTokenSymbol}</div>
          </div>
        ) : (
          <div className="relative rounded-lg border border-[rgba(148,93,255,0.2)] bg-[rgba(26,10,44,0.85)] px-2 py-2 text-center text-[10px] text-fantasy-muted">
            <div className="text-[16px] mb-0.5 opacity-40">🔒</div>
            <div>Connect wallet</div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
