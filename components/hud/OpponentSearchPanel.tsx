"use client"

import React from 'react'
import { shortAddress } from '@/src/shared/pvp'
import { BATTLE_TERMS } from '@/src/shared/gameplay/status'
import type { HighlightedTarget } from '@/components/bloblets-world/opponentSelectors'

export type OpponentSearchResult = {
  address: string
  displayAddress: string
  name: string | null
  hasMinimumStake: boolean
}

type RiskTierGroup = {
  tier: 'favorable' | 'even' | 'risky'
  label: string
  icon: string
  targets: HighlightedTarget[]
  colorScheme: {
    headerBg: string
    headerText: string
    headerBorder: string
    targetBg: string
    targetBorder: string
    targetHover: string
    selectedBg: string
    selectedBorder: string
    selectedGlow: string
  }
}

type OpponentSearchConfig = {
  query: string
  results: OpponentSearchResult[]
  activeIndex: number
  onChange: (value: string) => void
  onNavigate: (direction: 'next' | 'prev') => void
  onSubmit: () => void
  onSelect: (address: string) => void
  onHover: (address: string | null) => void
  onClearActive: () => void
}

type OpponentSearchPanelProps = {
  targets: HighlightedTarget[]
  search: OpponentSearchConfig
  selectedAddress: string | null
  onSelect: (address: string) => void
  onHover: (address: string | null) => void
  minStake: number | null
}

export const OpponentSearchPanel: React.FC<OpponentSearchPanelProps> = ({
  targets,
  search,
  selectedAddress,
  onSelect,
  onHover,
  minStake,
}) => {
  // Group targets by risk tier
  const riskGroups = React.useMemo<RiskTierGroup[]>(() => {
    const favorable = targets.filter((t) => t.riskTier === 'favorable')
    const even = targets.filter((t) => t.riskTier === 'even')
    const risky = targets.filter((t) => t.riskTier === 'risky')

    return [
      {
        tier: 'favorable' as const,
        label: 'Favorable Targets',
        icon: '✅',
        targets: favorable,
        colorScheme: {
          headerBg: 'rgba(20, 100, 50, 0.85)',
          headerText: '#8fffb3',
          headerBorder: 'rgba(143, 255, 179, 0.6)',
          targetBg: 'rgba(20, 80, 40, 0.5)',
          targetBorder: 'rgba(143, 255, 179, 0.5)',
          targetHover: 'rgba(143, 255, 179, 0.7)',
          selectedBg: 'rgba(30, 120, 60, 0.95)',
          selectedBorder: 'rgba(143, 255, 179, 0.85)',
          selectedGlow: '0_8px_20px_rgba(143,255,179,0.4),0_0_16px_rgba(143,255,179,0.3)',
        },
      },
      {
        tier: 'even' as const,
        label: 'Even Matchups',
        icon: '⚖️',
        targets: even,
        colorScheme: {
          headerBg: 'rgba(100, 90, 20, 0.85)',
          headerText: '#fff78f',
          headerBorder: 'rgba(255, 247, 143, 0.6)',
          targetBg: 'rgba(80, 70, 20, 0.5)',
          targetBorder: 'rgba(255, 247, 143, 0.5)',
          targetHover: 'rgba(255, 247, 143, 0.7)',
          selectedBg: 'rgba(120, 110, 30, 0.95)',
          selectedBorder: 'rgba(255, 247, 143, 0.85)',
          selectedGlow: '0_8px_20px_rgba(255,247,143,0.4),0_0_16px_rgba(255,247,143,0.3)',
        },
      },
      {
        tier: 'risky' as const,
        label: 'Risky Encounters',
        icon: '⚠️',
        targets: risky,
        colorScheme: {
          headerBg: 'rgba(100, 20, 40, 0.85)',
          headerText: '#ff8fa3',
          headerBorder: 'rgba(255, 143, 163, 0.6)',
          targetBg: 'rgba(80, 20, 35, 0.5)',
          targetBorder: 'rgba(255, 143, 163, 0.5)',
          targetHover: 'rgba(255, 143, 163, 0.7)',
          selectedBg: 'rgba(120, 30, 50, 0.95)',
          selectedBorder: 'rgba(255, 143, 163, 0.85)',
          selectedGlow: '0_8px_20px_rgba(255,143,163,0.4),0_0_16px_rgba(255,143,163,0.3)',
        },
      },
    ].filter((group) => group.targets.length > 0)
  }, [targets])

  const hasTargets = targets.length > 0
  const searchHasQuery = Boolean(search.query.trim())

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      search.onNavigate('next')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      search.onNavigate('prev')
    } else if (event.key === 'Enter') {
      event.preventDefault()
      search.onSubmit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      search.onClearActive()
    }
  }

  return (
    <div className="flex h-full flex-col bg-[rgba(16,6,40,0.95)]">
      {/* Header */}
      <div className="border-b border-[rgba(148,93,255,0.25)] bg-[rgba(28,10,58,0.6)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h2 className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#8ff7ff]">
            Target Selection
          </h2>
        </div>
      </div>

      {/* Search Section */}
      <div className="px-4 py-3 border-b border-[rgba(148,93,255,0.1)]">
        <label className="block">
          <span className="mb-1.5 block text-[9px] uppercase tracking-[0.18em] text-[#c7b5ff]">
            Manual Entry
          </span>
          <input
            type="text"
            value={search.query}
            onChange={(event) => search.onChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => search.onClearActive()}
            onBlur={() => search.onClearActive()}
            placeholder="Wallet or name..."
            className="w-full rounded-system-sm border border-[rgba(148,93,255,0.45)] bg-[rgba(12,4,26,0.92)] px-3 py-2.5 text-[11px] text-white placeholder:text-[#8c7cb8] focus:border-[#ff9de1]/70 focus:outline-none shadow-inner"
          />
        </label>
        {search.results.length > 0 && (
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto custom-scrollbar">
            {search.results.map((entry, index) => {
              const isActive = index === search.activeIndex
              const showStakeWarning = minStake != null && !entry.hasMinimumStake
              return (
                <button
                  key={entry.address}
                  type="button"
                  onClick={() => search.onSelect(entry.address)}
                  onMouseEnter={() => search.onHover(entry.address)}
                  onMouseLeave={() => search.onHover(null)}
                  className={`flex flex-col items-start rounded-system-sm border px-3 py-2 text-left text-[11px] transition ${
                    isActive
                      ? 'border-[rgba(255,157,225,0.65)] bg-[rgba(58,20,126,0.95)] text-white'
                      : 'border-transparent bg-[rgba(26,10,62,0.6)] text-[#ded0ff] hover:border-[rgba(255,134,230,0.45)] hover:text-white'
                  } ${entry.hasMinimumStake ? '' : 'opacity-85'}`}
                >
                  <span className="text-[10px] text-[#8ff7ff]">
                    {entry.name || shortAddress(entry.displayAddress)}
                  </span>
                  {entry.name && (
                    <span className="text-[9px] text-[#c7b5ff]">
                      {shortAddress(entry.displayAddress)}
                    </span>
                  )}
                  {showStakeWarning && (
                    <span className="text-[9px] font-pressstart pixel-tiny uppercase tracking-[0.14em] text-[#ff9de1]">
                      {`${BATTLE_TERMS.rewardDeficit.label}: ≥ ${minStake.toLocaleString()} BC`}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {searchHasQuery && search.results.length === 0 && (
          <div className="mt-2 text-[10px] text-[#c7b5ff]">No matches found</div>
        )}
      </div>

      {/* Risk Tier Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
        {hasTargets ? (
          riskGroups.map((group) => (
            <div
              key={group.tier}
              className="mb-4 last:mb-0 animate-fade-in-up rounded-lg border-2 p-2"
              style={{
                borderColor: group.colorScheme.headerBorder,
                backgroundColor: 'rgba(0, 0, 0, 0.15)',
              }}
            >
              {/* Section Header - Color Coded */}
              <div
                className="mb-2 flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all duration-300"
                style={{
                  backgroundColor: group.colorScheme.headerBg,
                  borderColor: group.colorScheme.headerBorder,
                }}
              >
                <span className="text-sm animate-pulse-subtle">{group.icon}</span>
                <h3
                  className="flex-1 font-pressstart pixel-tiny uppercase tracking-[0.16em]"
                  style={{ color: group.colorScheme.headerText }}
                >
                  {group.label}
                </h3>
                <span className="text-[10px] opacity-75" style={{ color: group.colorScheme.headerText }}>
                  ({group.targets.length})
                </span>
              </div>

              {/* Targets in this tier - Color Coded */}
              <div className="space-y-2">
                {group.targets.map((entry, index) => {
                  const isActive = selectedAddress === entry.address
                  const showStakeWarning = minStake != null && !entry.hasMinimumStake
                  return (
                    <button
                      key={entry.address}
                      type="button"
                      onClick={() => onSelect(entry.address)}
                      onMouseEnter={() => onHover(entry.address)}
                      onMouseLeave={() => onHover(null)}
                      style={{
                        backgroundColor: isActive ? group.colorScheme.selectedBg : group.colorScheme.targetBg,
                        borderColor: isActive ? group.colorScheme.selectedBorder : group.colorScheme.targetBorder,
                        animationDelay: `${index * 50}ms`,
                        boxShadow: isActive ? group.colorScheme.selectedGlow.replace(/_/g, ' ') : undefined,
                      }}
                      className={`flex w-full flex-col items-start gap-1.5 rounded-system-sm border-2 px-4 py-3 text-left text-[12px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 animate-fade-in-up ${
                        isActive
                          ? 'scale-[1.03] text-white'
                          : `text-[#c7b5ff] hover:scale-[1.02] hover:text-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]`
                      } ${entry.hasMinimumStake ? '' : 'opacity-75'}`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#8ff7ff] transition-all duration-200">
                          {entry.name || shortAddress(entry.displayAddress)}
                        </span>
                      </div>
                      {showStakeWarning && (
                        <span className="text-[10px] font-pressstart pixel-tiny uppercase tracking-[0.14em] text-[#ff9de1]">
                          {`${BATTLE_TERMS.rewardDeficit.label}: ≥ ${minStake.toLocaleString()} BC`}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        ) : !searchHasQuery ? (
          <div className="py-8 text-center">
            <div className="text-[24px] opacity-30 mb-2">📡</div>
            <div className="text-[11px] text-[#c7b5ff]">
              No visible targets nearby.<br/>Use manual entry to find opponents.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
