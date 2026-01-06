"use client"

import React from 'react'

import { useLifeHub } from './LifeHubProvider'
import { EnergizePanel } from './EnergizePanel'

type LifeHubModalProps = {
  onClose: () => void
  inline?: boolean
}

export const LifeHubModal: React.FC<LifeHubModalProps> = ({
  onClose,
  inline = false,
}) => {
  const lifeHub = useLifeHub()
  if (!lifeHub) {
    throw new Error('LifeHubModal must be rendered within a LifeHubProvider')
  }

  const containerClasses = inline
    ? 'w-full rounded-[28px] border border-[rgba(148,93,255,0.35)] bg-[rgba(16,6,40,0.94)] px-5 py-5 shadow-[0_24px_64px_rgba(12,2,28,0.55)]'
    : 'w-[920px] max-w-[calc(100vw-72px)] rounded-lg border-2 border-[rgba(0,255,247,0.4)] bg-[rgba(10,2,23,0.95)] px-6 py-5 shadow-[0_0_30px_rgba(0,255,247,0.3)]'

  return (
    <div className={containerClasses}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-pressstart text-[12px] uppercase tracking-[0.2em] text-[#7af0ff]">
            ⚔ LIFE PANEL
          </div>
          <div className="mt-2 text-[11px] text-[#c7b5ff]/85">
            Energize to refresh boosters and keep your bloblet in fighting shape
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 border border-[#7af0ff]/50 bg-[rgba(0,255,247,0.1)] text-[#7af0ff] font-pressstart text-[9px] hover:bg-[rgba(0,255,247,0.2)] transition-all rounded"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <EnergizePanel
        energizeCost={lifeHub.energizeCost}
        rewardBalance={lifeHub.rewardBalance}
        errorMessage={lifeHub.errorMessage}
        needsTopUp={lifeHub.needsTopUp}
      />
    </div>
  )
}
