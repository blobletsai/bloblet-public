"use client"

import React from 'react'
import { formatDisplayPoints } from '@/src/shared/points'
import type { EnergizeUiState } from './energizeState'

type LifeHubModalProps = {
  energize: EnergizeUiState
  onEnergize: () => void
  energizing: boolean
  energizeCost?: number | null
  rewardBalance?: number | null
  needsTopUp?: boolean
  onTopUp?: () => void
  disabledReason: string | null
  helperLabel?: string | null
  errorMessage?: string | null
  onClose: () => void
  inline?: boolean
  walletConnected: boolean
  isHolder?: boolean | null
  minTokens?: number | null
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const LifeHubModal: React.FC<LifeHubModalProps> = ({
  energize,
  onEnergize,
  energizing,
  energizeCost,
  rewardBalance,
  needsTopUp = false,
  onTopUp,
  disabledReason,
  helperLabel,
  errorMessage,
  onClose,
  inline = false,
  walletConnected,
  isHolder = null,
  minTokens = null,
}) => {
  const containerClasses = inline
    ? 'w-full rounded-[28px] border border-[rgba(148,93,255,0.35)] bg-[rgba(16,6,40,0.94)] px-5 py-5 shadow-[0_24px_64px_rgba(12,2,28,0.55)]'
    : 'w-[520px] max-w-[calc(100vw-72px)] rounded-[36px] border border-[rgba(148,93,255,0.45)] bg-[rgba(16,6,40,0.96)] px-6 py-6 shadow-[0_36px_96px_rgba(12,2,28,0.6)]'

  const coverageLabel = energize.state === 'covered'
    ? `Boosters active until ${formatTime(energize.boostersActiveUntil)}`
    : energize.state === 'cooldown'
      ? energize.cooldownEndsAt
      ? `Cooling down, ready ${formatTime(energize.cooldownEndsAt)}`
        : 'Cooling down'
      : 'Nourish to activate boosters'

  const lastEnergizeLabel = energize.lastEnergizeAt
    ? formatTime(energize.lastEnergizeAt)
    : 'Not nourished yet'

  const buttonDisabled = energizing || !!disabledReason
  const showTopUp = typeof onTopUp === 'function'
  const energizeCostLabel =
    energizeCost != null && Number.isFinite(energizeCost)
      ? `${formatDisplayPoints(energizeCost)} BC`
      : '—'
  const balanceLabel =
    rewardBalance != null && Number.isFinite(rewardBalance)
      ? `${formatDisplayPoints(rewardBalance)} BC`
      : '—'
  const minTokensLabel = typeof minTokens === 'number' && Number.isFinite(minTokens)
    ? formatDisplayPoints(minTokens, { maximumFractionDigits: minTokens >= 10 ? 0 : 2 })
    : null

  const fallbackHelperLabel = (() => {
    if (!walletConnected) {
      return 'Connect your wallet and use Buy BlobCoin to nourish.'
    }
    if (walletConnected && isHolder === false) {
      return minTokensLabel
        ? `Need ≥ ${minTokensLabel} tokens — Buy BlobCoin to clear the gate.`
        : 'Buy BlobCoin to clear the gate.'
    }
    if (disabledReason) return disabledReason
    if (needsTopUp) return 'Buy BlobCoin to add BlobCoin before nourishing.'
    return 'Nourishing refreshes boosters, rolls for loot, and resets cooldowns.'
  })()

  const resolvedHelperLabel = helperLabel ?? fallbackHelperLabel

  return (
    <div className={containerClasses}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-pressstart pixel-tiny uppercase tracking-[0.32em] text-[#ffe780]">Life Panel</div>
          <div className="mt-2 text-[12px] text-[#c7b5ff]/85">
            Nourish once to refresh all boosters and keep your bloblet in fighting shape.
          </div>
        </div>
        <button
          type="button"
          className="btn-fantasy-ghost px-3 py-1"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mt-6 rounded-[28px] border border-[rgba(148,93,255,0.35)] bg-[rgba(28,12,72,0.82)] px-5 py-4 shadow-[0_24px_64px_rgba(12,2,28,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.26em] text-[#8ff7ff]">Booster Level</div>
            <div className="mt-2 text-[26px] font-semibold text-white">Lv {Math.max(0, energize.boosterLevel)}</div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.26em] text-[#c7b5ff]">Status</div>
            <div className="mt-2 text-[13px] text-white/85">{coverageLabel}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border border-[rgba(141,82,255,0.35)] bg-[rgba(20,8,50,0.85)] px-4 py-3 text-[11px] text-[#f2ecff]/85">
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#ffe780]">Next Nourish</div>
            <div className="mt-2">
              {energize.state === 'cooldown' && energize.cooldownEndsAt
                ? `Ready at ${formatTime(energize.cooldownEndsAt)}`
                : energize.state === 'covered'
                  ? 'Boosters currently active'
                  : 'Ready now'}
            </div>
          </div>
          <div className="rounded-[20px] border border-[rgba(141,82,255,0.35)] bg-[rgba(20,8,50,0.85)] px-4 py-3 text-[11px] text-[#f2ecff]/85">
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#ffe780]">Last Nourish</div>
            <div className="mt-2">{lastEnergizeLabel}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(141,82,255,0.35)] bg-[rgba(20,8,50,0.85)] px-4 py-3 text-[11px] text-[#f2ecff]/85">
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#ffe780]">Nourish Cost</div>
            <div className="mt-2">{energizeCostLabel}</div>
          </div>
          <div className="rounded-[20px] border border-[rgba(141,82,255,0.35)] bg-[rgba(20,8,50,0.85)] px-4 py-3 text-[11px] text-[#f2ecff]/85">
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#ffe780]">BlobCoin Balance</div>
            <div className="mt-2">{balanceLabel}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="button"
            className={`btn-fantasy px-5 py-3 text-[13px] ${buttonDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={buttonDisabled}
            onClick={onEnergize}
          >
            {energizing ? 'Nourishing…' : 'Nourish'}
          </button>
          {showTopUp ? (
            <button
              type="button"
              className="btn-fantasy-ghost px-5 py-3 text-[13px]"
              onClick={onTopUp}
            >
              Buy BlobCoin
            </button>
          ) : null}
          <div className="text-[11px] text-[#c7b5ff]">{resolvedHelperLabel}</div>
        </div>
        {errorMessage ? (
          <div className="mt-3 rounded-[18px] border border-red-400/40 bg-red-900/40 px-4 py-3 text-[11px] text-red-100">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  )
}
