"use client"

import React from 'react'
import type { RewardSwapEntry } from '@/components/hooks/useRewardsSnapshot'
import { formatDisplayPoints } from '@/src/shared/points'
import { formatTimeAgo } from '@/components/bloblets-world/formatters'

type SupplyDepotPanelProps = {
  rewardsError: string | null
  isLoading: boolean
  hasAddress: boolean
  rewardSwapEntries: RewardSwapEntry[]
  rewardTokenSymbol: string
  walletConnected?: boolean
  isHolder?: boolean
  minTokens?: number | null
}

export const SupplyDepotPanel: React.FC<SupplyDepotPanelProps> = ({
  rewardsError,
  isLoading,
  hasAddress,
  rewardSwapEntries,
  rewardTokenSymbol,
  walletConnected,
  isHolder,
  minTokens,
}) => {
  const showMinTokenNotice =
    walletConnected && !isHolder && typeof minTokens === 'number'

  return (
    <div className="relative rounded-[36px] border-2 border-[rgba(143,247,255,0.65)] bg-[rgba(16,6,40,0.85)] px-4 py-3 shadow-[0_0_60px_rgba(143,247,255,0.55),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(125,255,207,0.3)] overflow-hidden">
      {/* Atmospheric background layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
        {/* Cyan nebula glow */}
        <div className="absolute inset-0 bg-gradient-radial from-[rgba(143,247,255,0.18)] via-[rgba(125,255,207,0.1)] to-transparent opacity-75" />

        {/* Star field - layer 1 (small stars) */}
        <div className="absolute inset-0 opacity-60" style={{
          backgroundImage: 'radial-gradient(1px 1px at 18% 22%, white, transparent), radial-gradient(1px 1px at 72% 28%, white, transparent), radial-gradient(1px 1px at 42% 58%, white, transparent), radial-gradient(1px 1px at 82% 72%, white, transparent), radial-gradient(1px 1px at 14% 48%, white, transparent), radial-gradient(1px 1px at 58% 18%, white, transparent), radial-gradient(1px 1px at 28% 78%, white, transparent)',
          backgroundSize: '250px 250px'
        }} />

        {/* Star field - layer 2 (colored stars) */}
        <div className="absolute inset-0 opacity-45" style={{
          backgroundImage: 'radial-gradient(1.5px 1.5px at 22% 28%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 68% 52%, rgba(125,255,207,0.9), transparent), radial-gradient(1.5px 1.5px at 32% 72%, rgba(255,231,128,0.9), transparent), radial-gradient(1.5px 1.5px at 78% 15%, rgba(143,247,255,0.9), transparent)',
          backgroundSize: '280px 280px'
        }} />

        {/* Atmospheric haze */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(143,247,255,0.08)] via-transparent to-[rgba(125,255,207,0.1)] opacity-40" />
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
        <div className="h-px animate-scan-line bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.3)] to-transparent" />
      </div>

      <div className="relative flex items-center gap-2">
        <span className="text-[14px]" aria-hidden>📦</span>
        <div className="font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#8ff7ff]">Supply Depot</div>
      </div>

      <div className="relative mt-2">
        {rewardsError ? (
        <div className="relative mt-1 rounded-lg border border-[rgba(220,20,60,0.4)] bg-[rgba(48,10,26,0.85)] px-2 py-2 text-center text-[10px] text-[#ff8fab]">
          <div className="text-[16px] mb-0.5 opacity-40">⚠️</div>
          <div>{rewardsError}</div>
        </div>
      ) : hasAddress ? (
        isLoading ? (
          <div className="relative mt-1 rounded-lg border border-[rgba(148,93,255,0.2)] bg-[rgba(26,10,44,0.85)] px-2 py-2 text-center text-[10px] text-fantasy-muted">
            <div className="text-[16px] mb-0.5 opacity-40">⟳</div>
            <div>Loading...</div>
          </div>
        ) : rewardSwapEntries.length ? (
          <ul className="relative space-y-1.5">
            {rewardSwapEntries.map((entry, idx) => {
              const statusColor = entry.status === 'pending' ? '#ffe780' : entry.status === 'failed' ? '#DC143C' : '#7dffcf'

              // Tiered color system based on transaction amount
              const getTierColors = () => {
                const amt = entry.amount
                if (amt >= 6) return {
                  border: 'rgba(143,247,255,0.7)',
                  bg: 'rgba(12,32,46,0.9)',
                  glow: '0 0 18px rgba(143,247,255,0.25), 0 0 36px rgba(143,247,255,0.12)',
                  tier: 'T6+'
                }
                if (amt >= 4) return {
                  border: 'rgba(255,231,128,0.7)',
                  bg: 'rgba(36,28,12,0.9)',
                  glow: '0 0 15px rgba(255,231,128,0.25)',
                  tier: 'T4'
                }
                if (amt >= 2) return {
                  border: 'rgba(125,255,207,0.6)',
                  bg: 'rgba(12,36,28,0.9)',
                  glow: '0 0 12px rgba(125,255,207,0.2)',
                  tier: 'T2'
                }
                return {
                  border: 'rgba(148,93,255,0.4)',
                  bg: 'rgba(19,8,36,0.92)',
                  glow: '0 0 8px rgba(148,93,255,0.15)',
                  tier: 'T1'
                }
              }

              const tierColors = getTierColors()

              return (
                <li
                  key={entry.id}
                  className="relative overflow-hidden rounded-[12px] border-2 px-2 py-1.5 flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
                  style={{
                    animation: `slide-in 0.3s ease-out ${idx * 0.05}s both`,
                    borderColor: tierColors.border,
                    backgroundColor: tierColors.bg,
                    boxShadow: tierColors.glow
                  }}
                >
                  {/* Scan line on most recent entry */}
                  {idx === 0 && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="h-px animate-scan-line bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.4)] to-transparent" />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {/* Status indicator dot */}
                    <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      entry.status === 'pending' ? 'bg-[rgba(255,231,128,0.2)] text-[#ffe780] shadow-[0_0_6px_rgba(255,231,128,0.5)]' :
                      entry.status === 'failed' ? 'bg-[rgba(220,20,60,0.2)] text-[#ff6b9a] shadow-[0_0_6px_rgba(220,20,60,0.5)]' :
                      'bg-[rgba(125,255,207,0.2)] text-[#7dffcf] shadow-[0_0_6px_rgba(125,255,207,0.5)]'
                    }`}>
                      {entry.status === 'pending' ? '⟳' : entry.status === 'failed' ? '✕' : '✓'}
                    </div>
                    <span className="font-mono font-semibold text-[#8ff7ff]">
                      {formatDisplayPoints(entry.amount, entry.amount >= 10 ? { maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })}
                    </span>
                    {/* Tier badge for large transactions */}
                    {entry.amount >= 2 && (
                      <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-mono" style={{
                        borderColor: tierColors.border,
                        backgroundColor: `${tierColors.border}20`,
                        color: tierColors.border
                      }}>
                        {tierColors.tier}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-fantasy-muted font-mono">{formatTimeAgo(entry.createdAt)}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="relative mt-1 rounded-lg border border-[rgba(148,93,255,0.2)] bg-[rgba(26,10,44,0.85)] px-2 py-2 text-center text-[10px] text-fantasy-muted">
            <div className="text-[16px] mb-0.5 opacity-40">📦</div>
            <div>No operations yet</div>
          </div>
        )
      ) : showMinTokenNotice ? (
        <div className="relative mt-1 rounded-lg border border-[rgba(220,20,60,0.4)] bg-[rgba(48,10,26,0.85)] px-2 py-2 text-center text-[10px] text-[#ff8fab]">
          <div className="text-[16px] mb-0.5 opacity-40">⚠️</div>
          <div>Need ≥ {minTokens?.toLocaleString()} {rewardTokenSymbol}</div>
        </div>
      ) : (
        <div className="relative mt-1 rounded-lg border border-[rgba(148,93,255,0.2)] bg-[rgba(26,10,44,0.85)] px-2 py-2 text-center text-[10px] text-fantasy-muted">
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
