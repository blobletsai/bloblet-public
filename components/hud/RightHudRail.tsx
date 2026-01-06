"use client"

import React, { useState, ReactNode } from 'react'

type RightHudRailProps = {
  feedPanel: ReactNode
  scannerPanel?: ReactNode
  searchPanel?: ReactNode
}

export const RightHudRail: React.FC<RightHudRailProps> = ({
  feedPanel,
  scannerPanel,
  searchPanel,
}) => {
  const [isFeedCollapsed, setIsFeedCollapsed] = useState(false)

  // Active panel logic: Scanner > Search > Feed
  const activeContent = scannerPanel || searchPanel || (!isFeedCollapsed ? feedPanel : null)
  const showCollapseControl = !scannerPanel && !searchPanel // Can't collapse scanner or search

  return (
    <div className="pointer-events-none fixed right-4 top-24 bottom-24 z-30 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-4">
      {/* Main Tactical Display (Top) */}
      <div className="pointer-events-auto relative flex h-full min-h-0 flex-col transition-all duration-300">
        {/* Collapse Toggle (Only for Feed) */}
        {showCollapseControl && (
          <div className="absolute -left-12 top-0 z-10">
            <button
              onClick={() => setIsFeedCollapsed(!isFeedCollapsed)}
              className="flex h-10 w-10 items-center justify-center rounded-l-xl border border-r-0 border-[rgba(148,93,255,0.35)] bg-[rgba(16,6,40,0.92)] text-xl text-[#c7b5ff] shadow-lg transition-all hover:w-12 hover:text-white"
              title={isFeedCollapsed ? "Expand Feed" : "Minimize Feed"}
            >
              {isFeedCollapsed ? '📡' : '_'}
            </button>
          </div>
        )}

        {/* Panel Content - Takes full height now */}
        {activeContent && (
          <div className="flex-1 overflow-hidden rounded-2xl border border-[rgba(148,93,255,0.35)] shadow-[0_24px_60px_rgba(12,2,28,0.6)] backdrop-blur-md">
            {activeContent}
          </div>
        )}
      </div>
    </div>
  )
}
