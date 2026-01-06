"use client"

import React from 'react'
import HudTooltip from '../HudTooltip'

type PanelPlacement = 'left' | 'right'

export type DockPanelConfig<Id extends string> = {
  id: Id
  icon: string
  label: string
  placement: PanelPlacement
  content: React.ReactNode
}

type DockRailProps<Id extends string> = {
  panels: DockPanelConfig<Id>[]
  activePanel: Id | null
  onToggle: (panel: Id) => void
}

export function DockRail<Id extends string>({
  panels,
  activePanel,
  onToggle,
}: DockRailProps<Id>) {
  return (
    <>
      {/* Unified Tactical Sidebar - Life Hub Style */}
      <div className="pointer-events-none absolute left-6 top-1/2 z-30 -translate-y-1/2">
        <div className="pointer-events-auto relative flex flex-col" data-hud-interactive="true">
          {/* Outer glow - atmospheric depth */}
          <div className="absolute -inset-x-3 -inset-y-5 clip-tactical-dock-vertical bg-[radial-gradient(circle_at_50%_50%,rgba(140,231,255,0.32),rgba(20,6,48,0))] blur-[26px] opacity-75" />

          {/* Main unified container - tactical panel */}
          <div className="absolute inset-0 clip-tactical-dock-vertical border border-[rgba(148,93,255,0.45)] bg-[linear-gradient(130deg,rgba(18,6,46,0.82),rgba(44,16,96,0.78))] shadow-[0_26px_70px_rgba(12,2,28,0.58)] backdrop-blur-xl transition-all duration-300" />

          {/* CRT scan line overlay */}
          <div className="absolute inset-0 overflow-hidden clip-tactical-dock-vertical pointer-events-none">
            <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.25)] to-transparent blur-[1px] animate-scan-line" />
          </div>

          {/* Energy flow accent lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-5 pointer-events-none">
            {/* Top energy lines */}
            <div className="flex flex-col gap-1 px-3">
              <div className="h-px w-20 bg-gradient-to-r from-[rgba(143,247,255,0.6)] to-transparent opacity-75 animate-circuit-flow" />
              <div className="h-px w-16 bg-gradient-to-r from-[rgba(143,247,255,0.5)] to-transparent opacity-50 animate-pulse" style={{ animationDelay: '0.3s' }} />
              <div className="h-px w-14 bg-gradient-to-r from-[rgba(143,247,255,0.4)] to-transparent opacity-50 animate-circuit-flow" style={{ animationDelay: '0.6s' }} />
            </div>
            {/* Bottom energy lines */}
            <div className="flex flex-col gap-1 px-3">
              <div className="h-px w-16 bg-gradient-to-r from-[rgba(143,247,255,0.6)] to-transparent opacity-75 animate-circuit-flow" style={{ animationDelay: '0.2s' }} />
              <div className="h-px w-14 bg-gradient-to-r from-[rgba(143,247,255,0.5)] to-transparent opacity-50 animate-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="h-px w-12 bg-gradient-to-r from-[rgba(143,247,255,0.4)] to-transparent opacity-50 animate-circuit-flow" style={{ animationDelay: '0.8s' }} />
            </div>
          </div>

          {/* Command modules - tactical buttons */}
          <div className="relative flex flex-col gap-system-sm px-3 py-system-lg">
            {panels.map((panel) => {
              const isActive = panel.id === activePanel
              return (
                <HudTooltip key={panel.id} content={panel.label} side="right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggle(panel.id)
                    }}
                    className={`grid h-12 w-12 place-items-center rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? 'scale-105 border-[rgba(255,157,225,0.7)] bg-[rgba(64,22,126,0.92)] shadow-[0_20px_50px_rgba(255,157,225,0.4),0_8px_16px_rgba(255,45,215,0.3)]'
                        : 'border-[rgba(82,36,156,0.15)] bg-transparent text-[#c7b5ff] hover:scale-105 hover:border-[rgba(255,134,230,0.45)] hover:bg-[rgba(44,16,96,0.78)] hover:text-white hover:shadow-[0_8px_24px_rgba(255,134,230,0.15)]'
                    }`}
                    data-hud-interactive="true"
                    aria-pressed={isActive}
                    aria-label={panel.label}
                  >
                    <span className="relative z-10 text-xl">{panel.icon}</span>
                  </button>
                </HudTooltip>
              )
            })}
          </div>
        </div>
      </div>

      {/* Panel Content - All panels open from left sidebar */}
      {panels.map((panel) => {
        if (panel.id !== activePanel) return null
        return (
          <div key={panel.id} className="pointer-events-none absolute top-28 left-24 z-40">
            <div
              className="pointer-events-auto max-h-[calc(100vh-280px)] overflow-y-auto"
              data-hud-interactive="true"
              onClick={(event) => event.stopPropagation()}
            >
              {panel.content}
            </div>
          </div>
        )
      })}
    </>
  )
}
