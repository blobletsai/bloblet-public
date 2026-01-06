"use client"

import React from 'react'

type LedgerDockPanelProps = {
  rewardsHistory: React.ReactNode
}

export const LedgerDockPanel: React.FC<LedgerDockPanelProps> = ({ rewardsHistory }) => {
  return (
    <div className="w-[340px] max-w-[calc(100vw-160px)]" data-hud-interactive="true">
      {rewardsHistory}
    </div>
  )
}
