"use client"

import React from 'react'

type ArenaDockPanelProps = {
  battles: React.ReactNode
  onLaunch: () => void
}

export const ArenaDockPanel: React.FC<ArenaDockPanelProps> = ({ battles, onLaunch }) => {
  return (
    <div className="w-[340px] max-w-[calc(100vw-160px)]" data-hud-interactive="true">
      <div className="relative overflow-hidden rounded-[36px] border-2 border-[rgba(148,93,255,0.65)] bg-[rgba(16,6,40,0.85)] px-4 py-3 shadow-[0_0_60px_rgba(148,93,255,0.65),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(255,157,225,0.3)]">
        {/* Atmospheric background layers */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
          {/* Purple nebula glow */}
          <div className="absolute inset-0 bg-gradient-radial from-[rgba(148,93,255,0.25)] via-[rgba(255,45,215,0.15)] to-transparent opacity-75" />

          {/* Star field - layer 1 (small stars) */}
          <div className="absolute inset-0 opacity-65" style={{
            backgroundImage: 'radial-gradient(1px 1px at 20% 15%, white, transparent), radial-gradient(1px 1px at 75% 35%, white, transparent), radial-gradient(1px 1px at 45% 60%, white, transparent), radial-gradient(1px 1px at 85% 80%, white, transparent), radial-gradient(1px 1px at 10% 45%, white, transparent), radial-gradient(1px 1px at 60% 25%, white, transparent), radial-gradient(1px 1px at 30% 85%, white, transparent), radial-gradient(1px 1px at 95% 50%, white, transparent)',
            backgroundSize: '250px 250px'
          }} />

          {/* Star field - layer 2 (medium stars) */}
          <div className="absolute inset-0 opacity-45" style={{
            backgroundImage: 'radial-gradient(2px 2px at 40% 40%, white, transparent), radial-gradient(2px 2px at 65% 75%, white, transparent), radial-gradient(2px 2px at 15% 70%, white, transparent), radial-gradient(2px 2px at 80% 20%, white, transparent)',
            backgroundSize: '300px 300px'
          }} />

          {/* Star field - layer 3 (bright colored stars) */}
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: 'radial-gradient(1.5px 1.5px at 18% 25%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 62% 48%, rgba(255,231,128,0.9), transparent), radial-gradient(1.5px 1.5px at 35% 72%, rgba(125,255,207,0.9), transparent), radial-gradient(1.5px 1.5px at 78% 15%, rgba(148,93,255,0.9), transparent), radial-gradient(1.5px 1.5px at 45% 88%, rgba(255,157,225,0.9), transparent)',
            backgroundSize: '280px 280px'
          }} />

          {/* Atmospheric haze */}
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(148,93,255,0.1)] via-transparent to-[rgba(148,93,255,0.15)] opacity-40" />

          {/* Floating particles/debris layer */}
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: 'radial-gradient(3px 3px at 22% 18%, rgba(255,231,128,0.6), transparent), radial-gradient(2px 2px at 68% 32%, rgba(143,247,255,0.5), transparent), radial-gradient(4px 4px at 85% 55%, rgba(255,231,128,0.4), transparent), radial-gradient(3px 3px at 12% 72%, rgba(143,247,255,0.6), transparent)',
            backgroundSize: '350px 350px'
          }} />
        </div>

        {/* Corner markers (tactical brackets) */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-4 w-4 border-l-[3px] border-t-[3px] border-[rgba(255,157,225,0.85)]" />
          <div className="absolute right-0 top-0 h-4 w-4 border-r-[3px] border-t-[3px] border-[rgba(255,157,225,0.85)]" />
          <div className="absolute bottom-0 left-0 h-4 w-4 border-b-[3px] border-l-[3px] border-[rgba(255,157,225,0.85)]" />
          <div className="absolute bottom-0 right-0 h-4 w-4 border-b-[3px] border-r-[3px] border-[rgba(255,157,225,0.85)]" />
        </div>

        {/* Scan line effect */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="h-px animate-scan-line bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.4)] to-transparent" />
        </div>

        <div className="relative flex items-center justify-between">
          <div className="font-pressstart pixel-tiny uppercase tracking-[0.32em] text-[#ffe780]">Arena Feed</div>
          <button
            type="button"
            onClick={onLaunch}
            className="group relative overflow-hidden rounded-full border-2 border-[rgba(255,157,225,0.8)] bg-[rgba(100,20,80,0.9)] px-4 py-2 text-[10px] text-white shadow-[0_0_20px_rgba(255,157,225,0.5)] transition-all duration-300 hover:scale-105 hover:border-[rgba(255,157,225,1)] hover:shadow-[0_0_30px_rgba(255,157,225,0.7)]"
            data-hud-interactive="true"
          >
            <div className="absolute inset-0 animate-pulse-subtle bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.2)] to-transparent" />
            <span className="relative z-10">🎯 Launch</span>
          </button>
        </div>
        <div className="relative mt-1 text-[10px] uppercase tracking-[0.18em] text-[#c7b5ff]">Latest battles</div>

        {/* Divider */}
        <div className="relative my-2 h-px bg-gradient-to-r from-transparent via-[rgba(148,93,255,0.45)] to-transparent shadow-[0_0_8px_rgba(148,93,255,0.3)]" />

        <div className="relative mt-2 max-h-[56vh] overflow-y-auto pr-1 space-y-2">
          {battles}
        </div>
      </div>
    </div>
  )
}
