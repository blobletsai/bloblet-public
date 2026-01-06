"use client"

import React from 'react'

import { useLifeHub } from './LifeHubProvider'

type EnergizeCTAProps = {
  className?: string
}

export const EnergizeCTA: React.FC<EnergizeCTAProps> = ({ className }) => {
  const lifeHub = useLifeHub()
  if (!lifeHub) {
    throw new Error('EnergizeCTA must be rendered within a LifeHubProvider')
  }

  const {
    energizing,
    disabledReason,
    helperLabel,
    onEnergize,
    onTopUp,
    onFastForward,
    fastForwardAvailable,
    fastForwardDisabledReason,
    topUpStatus,
    refreshStatus,
    statusRefreshing,
  } = lifeHub

  const buttonDisabled = energizing || !!disabledReason

  const handleEnergizeClick = () => {
    void onEnergize()
  }

  const handleTopUpClick = () => {
    onTopUp?.()
  }
  
  const handleFastForwardClick = () => {
    onFastForward?.()
  }

  const buyPointsBusy = Boolean(topUpStatus?.active) || topUpStatus?.autoStatus === 'running'
  const buyPointsApplied =
    topUpStatus?.phase === 'applied' || topUpStatus?.status === 'applied'
  const buyPointsLabel = buyPointsBusy
    ? 'Buy BlobCoin (processing…)'
    : buyPointsApplied
    ? 'Buy BlobCoin (credited)'
    : 'Buy BlobCoin'

  const rootClassName = ['mt-6 flex flex-col gap-3 md:flex-row md:items-center', className]
    .filter(Boolean)
    .join(' ')

  const primaryButtonClass = ['btn-fantasy px-5 py-3 text-[13px]', buttonDisabled ? 'cursor-not-allowed opacity-60' : null]
    .filter(Boolean)
    .join(' ')

  const fastForwardDisabled = energizing || Boolean(fastForwardDisabledReason) || !onFastForward

  return (
    <div className={rootClassName}>
      <button
        type="button"
        className={primaryButtonClass}
        disabled={buttonDisabled}
        onClick={handleEnergizeClick}
      >
        {energizing ? 'Nourishing…' : 'Nourish'}
      </button>
      {fastForwardAvailable && typeof onFastForward === 'function' ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="btn-fantasy-ghost px-5 py-3 text-[13px]"
            onClick={handleFastForwardClick}
            disabled={fastForwardDisabled}
          >
            Jump ahead (up to 3 Nourishes now)
          </button>
          <span className="text-[10px] text-[#8ff7ff] opacity-80 px-1">
            Uses normal cost; up to 2 bursts/day · debt: 15–45m
          </span>
        </div>
      ) : null}
      {typeof onTopUp === 'function' ? (
        <button
          type="button"
          className="btn-fantasy-ghost px-5 py-3 text-[13px]"
          onClick={handleTopUpClick}
          disabled={buyPointsBusy}
        >
          {buyPointsLabel}
        </button>
      ) : null}
      <div className="flex flex-col text-[11px] text-[#c7b5ff]">
        <span>{helperLabel ?? 'Nourishing refreshes boosters, rolls for loot, and resets cooldowns.'}</span>
        <button
          type="button"
          className="mt-1 self-start text-[10px] uppercase tracking-[0.2em] text-[#8ff7ff] transition hover:text-white disabled:opacity-60"
          onClick={() => { if (refreshStatus) { void refreshStatus() } }}
          disabled={!refreshStatus || statusRefreshing}
        >
          {statusRefreshing ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>
    </div>
  )
}
