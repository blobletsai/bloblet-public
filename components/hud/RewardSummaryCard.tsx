"use client"

import React from 'react'

type RewardSummaryCardProps = {
  balanceLabel: string | null
  balance: number | null
  loading: boolean
  hasWallet: boolean
  errorMessage: string | null
  onRefresh: () => void
  onBuyPoints: () => void
  buyDisabled: boolean
}

export const RewardSummaryCard: React.FC<RewardSummaryCardProps> = ({
  balanceLabel,
  balance,
  loading,
  hasWallet,
  errorMessage,
  onRefresh,
  onBuyPoints,
  buyDisabled,
}) => {
  return (
    <div className="pointer-events-auto relative rounded-xl border-2 border-[rgba(148,93,255,0.5)] bg-gradient-to-br from-[rgba(28,10,56,0.96)] to-[rgba(12,4,28,0.94)] px-3 py-2.5 shadow-[0_12px_32px_rgba(12,2,28,0.7)] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: `
          linear-gradient(25deg, transparent 46%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.4) 52%, transparent 54%),
          linear-gradient(70deg, transparent 46%, rgba(0,0,0,0.3) 48%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.3) 52%, transparent 54%),
          linear-gradient(110deg, transparent 46%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.35) 52%, transparent 54%)
        `,
        backgroundSize: '100% 100%',
        mixBlendMode: 'multiply'
      }} />
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(0,0,0,0.4) 0%, transparent 3%),
          radial-gradient(circle at 80% 60%, rgba(0,0,0,0.35) 0%, transparent 4%),
          radial-gradient(circle at 65% 20%, rgba(0,0,0,0.3) 0%, transparent 2.5%),
          radial-gradient(circle at 35% 75%, rgba(0,0,0,0.32) 0%, transparent 3.5%)
        `,
        mixBlendMode: 'multiply'
      }} />
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 3px),
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 3px)
        `,
        backgroundSize: '100% 100%'
      }} />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px]">⚔️</span>
            <span className="text-[28px] font-bold tracking-tight" style={{
              color: '#fff',
              textShadow: '0 0 20px rgba(255,157,225,0.6), 0 2px 8px rgba(0,0,0,0.6)'
            }}>
              {balanceLabel ?? (loading ? '...' : hasWallet ? '--' : '—')}
            </span>
            <span className="text-[9px] text-[#8ff7ff] opacity-70">BC</span>
          </div>
          {hasWallet && (
            <button
              type="button"
              onClick={onRefresh}
              className="btn-fantasy-ghost px-2 py-1 text-[10px]"
              disabled={loading}
            >
              {loading ? '⟳' : '↻'}
            </button>
          )}
        </div>

        {balance != null && balance > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <div className="rounded-full border px-2 py-0.5 text-[8px] font-pressstart pixel-tiny uppercase tracking-[0.12em]" style={{
              borderColor: balance >= 1000 ? '#FFD700' : balance >= 100 ? '#C0C0C0' : '#CD7F32',
              color: balance >= 1000 ? '#FFD700' : balance >= 100 ? '#C0C0C0' : '#CD7F32',
              backgroundColor: balance >= 1000 ? 'rgba(255,215,0,0.15)' : balance >= 100 ? 'rgba(192,192,192,0.15)' : 'rgba(205,127,50,0.15)'
            }}>
              {balance >= 1000 ? '⭐ GOLD' : balance >= 100 ? '✦ SILVER' : '• BRONZE'}
            </div>
            {hasWallet && (
              <span className="text-[8px] text-fantasy-muted">⚔️ Combat Ledger</span>
            )}
          </div>
        )}

        {errorMessage ? (
          <div className="mt-2 rounded-lg border border-[rgba(220,20,60,0.5)] bg-[rgba(48,10,26,0.9)] px-2 py-1.5 text-center text-[10px] text-[#ff8fab]">
            ⚠️ {errorMessage}
          </div>
        ) : null}

        {hasWallet && !errorMessage ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onBuyPoints}
              className="btn-fantasy flex-1 px-2 py-1.5 text-[10px] flex items-center justify-center gap-1"
              disabled={buyDisabled}
            >
              <span>💰</span>
              <span>Buy BlobCoin</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type { RewardSummaryCardProps }
