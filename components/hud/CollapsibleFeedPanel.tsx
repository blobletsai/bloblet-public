"use client"

import React, { useState } from 'react'

type CollapsibleFeedPanelProps = {
  children: React.ReactNode
}

export const CollapsibleFeedPanel: React.FC<CollapsibleFeedPanelProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="pointer-events-auto fixed right-0 top-32 z-30 flex h-12 w-10 items-center justify-center rounded-l-xl border-y border-l border-[rgba(148,93,255,0.35)] bg-[rgba(16,6,40,0.92)] text-2xl shadow-[0_8px_24px_rgba(12,2,28,0.45)] transition hover:w-12 hover:border-[rgba(255,134,230,0.45)] hover:text-white"
        aria-label="Expand battle feed"
        title="Expand Battle Feed"
      >
        <span className="animate-pulse-subtle">📡</span>
      </button>
    )
  }

  return (
    <div className="pointer-events-auto fixed right-4 top-24 z-30 w-[340px] max-w-[calc(100vw-32px)]">
      <div className="relative flex flex-col overflow-hidden rounded-[24px] border border-[rgba(148,93,255,0.35)] bg-[rgba(16,6,40,0.85)] shadow-[0_24px_60px_rgba(12,2,28,0.6)] backdrop-blur-md transition-all duration-300">
        
        {/* Header / Controls */}
        <div className="flex items-center justify-between border-b border-[rgba(148,93,255,0.2)] bg-[rgba(148,93,255,0.1)] px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">📡</span>
            <span className="font-game text-[10px] uppercase tracking-[0.1em] text-[#c7b5ff]">
              Live Feed
            </span>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] text-[#c7b5ff] hover:bg-[rgba(148,93,255,0.2)] hover:text-white"
            aria-label="Minimize feed"
            title="Minimize"
          >
            _
          </button>
        </div>

        {/* Content (The Arena Panel) */}
        <div className="p-1">
           {children}
        </div>
      </div>
    </div>
  )
}
