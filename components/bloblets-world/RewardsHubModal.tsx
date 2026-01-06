"use client"

import React from 'react'

type RewardsHubModalProps = {
  onClose: () => void
  rewardsCard: React.ReactNode
  rewardsHistory: React.ReactNode
}

export const RewardsHubModal: React.FC<RewardsHubModalProps> = ({
  onClose,
  rewardsCard,
  rewardsHistory,
}) => {
  return (
    <div className="w-[520px] max-w-[calc(100vw-72px)] max-h-[calc(100vh-120px)] rounded-[24px] border border-[rgba(148,93,255,0.45)] bg-[rgba(16,6,40,0.96)] px-4 py-4 shadow-[0_36px_96px_rgba(12,2,28,0.6)] flex flex-col">
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div className="font-pressstart pixel-tiny uppercase tracking-[0.28em] text-[11px] text-[#ffe780]">⚔️ Battle Treasury</div>
        <button type="button" className="btn-fantasy-ghost px-2 py-1 text-[12px]" onClick={onClose}>✕</button>
      </div>
      <div className="relative mt-4 flex-shrink-0">
        {rewardsCard}
      </div>
      <div className="relative mt-4 rounded-2xl border border-[rgba(148,93,255,0.32)] bg-[rgba(24,10,48,0.9)] px-3 py-3 shadow-[0_20px_48px_rgba(12,2,28,0.45)] flex-1 min-h-0">
        <div className="relative h-full overflow-hidden">
          {rewardsHistory}
        </div>
      </div>
    </div>
  )
}
