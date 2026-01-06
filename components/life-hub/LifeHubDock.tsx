"use client"

import React from 'react'
import type { HubTab } from '../bloblets-world/types'
import type { HubTabMeta } from '../bloblets-world/loadoutSelectors'

type LifeHubDockProps = {
  tabs: HubTab[]
  activeTab: HubTab | null
  onToggle: (tab: HubTab) => void
  meta: HubTabMeta
}

const TONE_CLASS: Record<HubTab, string> = {
  life: 'from-[#ff7fb8] to-[#ffb86c]',
  persona: 'from-[#ffd5ff] to-[#8ff7ff]',
  loadout: 'from-[#8ff7ff] to-[#a9b4ff]',
  opponents: 'from-[#7bcfff] to-[#c38dff]',
  rewards: 'from-[#ffe780] to-[#ff9de1]',
}

export const LifeHubDock: React.FC<LifeHubDockProps> = ({
  tabs,
  activeTab,
  onToggle,
  meta,
}) => {
  // Module numbers for tactical display (1-indexed)
  const moduleNumbers: Record<HubTab, number> = {
    life: 1,
    persona: 2,
    loadout: 3,
    opponents: 4,
    rewards: 5,
  }

  return (
    <div
      className="pointer-events-auto relative flex items-center justify-center gap-system-md"
      data-hud-interactive="true"
      data-testid="care-status-hud"
    >
      {/* Outer glow - battlefield aura */}
      <div
        className="absolute -inset-x-5 -inset-y-3 clip-tactical-dock bg-[radial-gradient(circle_at_50%_120%,rgba(140,231,255,0.32),rgba(20,6,48,0))] blur-[26px] opacity-high transition-opacity duration-500"
        aria-hidden="true"
      />
      {/* Main container - tactical panel */}
      <div
        className="absolute inset-0 clip-tactical-dock border border-[rgba(148,93,255,0.45)] bg-[linear-gradient(130deg,rgba(18,6,46,0.82),rgba(44,16,96,0.78))] shadow-[0_26px_70px_rgba(12,2,28,0.58)] backdrop-blur-xl transition-all duration-300"
        aria-hidden="true"
      />
      {/* CRT scan line overlay - tactical display effect */}
      <div className="absolute inset-0 overflow-hidden clip-tactical-dock pointer-events-none" aria-hidden="true">
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.25)] to-transparent blur-[1px] animate-scan-line" />
      </div>
      {/* Tactical accent lines - enhanced energy flow (6 stacked lines) */}
      <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none" aria-hidden="true">
        {/* Left side - 3 stacked energy lines */}
        <div className="flex flex-col gap-1">
          <span className="h-0.5 w-20 rounded-full bg-[linear-gradient(90deg,rgba(255,134,230,0.8),rgba(140,231,255,0))] opacity-high animate-circuit-flow" />
          <span className="h-0.5 w-16 rounded-full bg-[linear-gradient(90deg,rgba(140,231,255,0.6),rgba(255,134,230,0))] opacity-medium animate-pulse" style={{ animationDelay: '0.3s' }} />
          <span className="h-0.5 w-14 rounded-full bg-[linear-gradient(90deg,rgba(255,134,230,0.5),rgba(140,231,255,0))] opacity-medium animate-circuit-flow" style={{ animationDelay: '0.6s' }} />
        </div>
        {/* Right side - 3 stacked energy lines */}
        <div className="flex flex-col gap-1">
          <span className="h-0.5 w-16 rounded-full bg-[linear-gradient(90deg,rgba(140,231,255,0),rgba(255,134,230,0.8))] opacity-high animate-circuit-flow" style={{ animationDelay: '0.2s' }} />
          <span className="h-0.5 w-14 rounded-full bg-[linear-gradient(90deg,rgba(255,134,230,0),rgba(140,231,255,0.6))] opacity-medium animate-pulse" style={{ animationDelay: '0.5s' }} />
          <span className="h-0.5 w-12 rounded-full bg-[linear-gradient(90deg,rgba(140,231,255,0),rgba(255,134,230,0.5))] opacity-medium animate-circuit-flow" style={{ animationDelay: '0.8s' }} />
        </div>
      </div>
      {/* Command modules - tactical tab buttons */}
      <div className="relative flex items-center gap-system-sm px-system-lg py-2.5">
        {tabs.map((tab) => {
          const entry = meta[tab]
          if (!entry) return null
          const isActive = activeTab === tab
          const toneClass = TONE_CLASS[tab]
          return (
            <button
              key={tab}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggle(tab)
              }}
              className={`
                relative flex min-w-[104px] flex-col items-center gap-1 rounded-system-sm clip-slash-corner-tr border px-system-md py-1.5 text-center overflow-hidden
                transition-all duration-300 ease-out
                ${isActive
                  ? 'scale-110 border-[rgba(255,157,225,0.7)] bg-[rgba(64,22,126,0.92)] text-white shadow-[0_20px_50px_rgba(255,157,225,0.4),0_8px_16px_rgba(255,45,215,0.3),0_0_24px_rgba(255,157,225,0.25)]'
                  : 'border-[rgba(82,36,156,0.15)] text-[#c7b5ff] hover:scale-[1.05] hover:border-[rgba(255,134,230,0.45)] hover:bg-[rgba(44,16,96,0.78)] hover:text-white hover:shadow-[0_8px_24px_rgba(255,134,230,0.15)]'
                }
              `}
              aria-pressed={isActive}
            >
              {/* Radar sweep effect - active state only */}
              {isActive && (
                <div className="absolute inset-0 pointer-events-none opacity-30" aria-hidden="true">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[2px] bg-gradient-to-r from-transparent via-[#8ff7ff] to-transparent animate-radar-sweep origin-center" />
                </div>
              )}

              {/* Corner markers - active state only */}
              {isActive && (
                <div className="corner-markers absolute inset-0 pointer-events-none opacity-60" aria-hidden="true" />
              )}

              {/* Tactical module badge - hexagonal data display */}
              <div
                className={`absolute -top-1 -right-1 z-20 flex h-5 w-5 items-center justify-center clip-hexagon border transition-all duration-300 ${
                  isActive
                    ? 'bg-[rgba(143,247,255,0.25)] border-[#8ff7ff] shadow-[0_0_8px_rgba(143,247,255,0.6)] animate-pulse-subtle'
                    : 'bg-[rgba(140,231,255,0.12)] border-[rgba(140,231,255,0.3)]'
                }`}
                aria-hidden="true"
              >
                <span className="font-mono text-[9px] font-bold text-[#8ff7ff]">
                  {moduleNumbers[tab]}
                </span>
              </div>

              {/* Icon + Label */}
              <span className={`relative z-10 flex items-center gap-1 font-game text-sm-game font-semibold transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                <span aria-hidden className="transition-transform duration-200 hover:scale-125">{entry.icon}</span>
                {entry.label}
              </span>

              {/* Status subtitle */}
              <span className="relative z-10 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[#8ff7ff] opacity-medium transition-opacity duration-200 group-hover:opacity-high">
                {entry.subtitle}
              </span>

              {/* Tactical indicator bar */}
              {isActive ? (
                <span
                  className={`relative z-10 h-1 w-full rounded-full bg-gradient-to-r ${toneClass} shadow-[0_0_12px_currentColor] animate-pulse`}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="relative z-10 h-1 w-full rounded-full bg-[rgba(140,231,255,0.18)] opacity-low transition-opacity duration-200 hover:opacity-medium"
                  aria-hidden="true"
                />
              )}

              {/* Attention Cue (Nourish Ready) */}
              {entry.attention && !isActive && (
                 <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fantasy-accent opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-fantasy-accent"></span>
                 </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
