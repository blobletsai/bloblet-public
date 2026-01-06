"use client"

import type { FC } from 'react'

type FaucetReminderBannerProps = {
  status: 'fulfilled' | 'already_claimed'
  remainingMs: number | null
  onManualRefresh?: () => void
  manualRefreshPending?: boolean
}

const HEADING: Record<'fulfilled' | 'already_claimed', string> = {
  fulfilled: 'Bloblet arriving…',
  already_claimed: 'Bloblet already claimed',
}

const MESSAGE: Record<'fulfilled' | 'already_claimed', string> = {
  fulfilled:
    'Tokens are en route — this timer counts down to your automatic badge flip (about 5 minutes). When the clock hits 0, tap “Refresh Bloblet” to check in.',
  already_claimed:
    'This wallet already received the stipend. Leave this reminder open and click “Refresh Bloblet” once the timer completes to verify again.',
}

function formatMs(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const FaucetReminderBanner: FC<FaucetReminderBannerProps> = ({
  status,
  remainingMs,
  onManualRefresh,
  manualRefreshPending,
}) => {
  const showTimer = typeof remainingMs === 'number' && remainingMs > 0
  const showRefresh = typeof remainingMs === 'number' && remainingMs <= 0

  return (
    <div className="flex w-[420px] flex-col gap-3 rounded-3xl border border-[rgba(148,93,255,0.45)] bg-[rgba(8,2,20,0.85)] px-6 py-4 shadow-[0_18px_48px_rgba(18,4,38,0.65)] backdrop-blur">
      <div className="space-y-1">
        <div className="font-pressstart text-[10px] uppercase tracking-[0.18em] text-[#8ff7ff]">
          {HEADING[status]}
        </div>
        <p className="text-[12px] leading-relaxed text-fantasy-muted">{MESSAGE[status]}</p>
        {showTimer && (
          <p className="text-[12px] font-semibold text-[#8ff7ff]">
            Countdown: <span className="font-mono">{formatMs(remainingMs)}</span>
          </p>
        )}
      </div>
      {showRefresh && (
        <p className="text-[12px] text-fantasy-muted">
          Timer finished — please refresh your browser to see your bloblet and holder badge.
        </p>
      )}
    </div>
  )
}
