"use client"

import React, { useMemo } from 'react'

import { shortAddress } from '@/src/shared/pvp'
import { formatDisplayPoints } from '@/src/shared/points'
import type { PvpBattle, PvpItem } from '@/types'

import { formatTimeAgo } from '../bloblets-world/formatters'

type ArenaFeedPanelProps = {
  battles: PvpBattle[]
  myAddress: string
  itemCatalog: Record<number, PvpItem>
  onChallenge: (target: string) => void
}

const BattleEntry: React.FC<{
  battle: PvpBattle
  myAddress: string
  itemCatalog: Record<number, PvpItem>
  onChallenge: (target: string) => void
}> = ({ battle, myAddress, itemCatalog, onChallenge }) => {
  const { winnerAddr, loserAddr, winnerGain, lootParts, targetCandidate } = useMemo(() => {
    const winnerAddrInternal = battle.winner === 'attacker' ? battle.attacker : battle.defender
    const loserAddrInternal = battle.winner === 'attacker' ? battle.defender : battle.attacker
    const winnerGainInternal = battle.transfer_points - battle.house_points
    const loot = (battle.loot || []).map((entry) => {
      const item = entry.item_id ? itemCatalog[entry.item_id] : null
      if (!item) return null
      return {
        name: `${item.name}${entry.equipped ? ' ★' : ''}`,
        icon: item.icon_url || null,
        slot: entry.slot,
      }
    }).filter(Boolean) as Array<{ name: string; icon: string | null; slot: 'weapon' | 'shield' }>
    const attackerAddress = String(battle.attacker || '').trim()
    const defenderAddress = String(battle.defender || '').trim()
    const myCanonicalAddr = String(myAddress || '').trim()
    const targetCandidateInternal = myCanonicalAddr && myCanonicalAddr === attackerAddress
      ? defenderAddress
      : attackerAddress === defenderAddress
        ? defenderAddress
        : attackerAddress

    return {
      winnerAddr: winnerAddrInternal,
      loserAddr: loserAddrInternal,
      winnerGain: winnerGainInternal,
      lootParts: loot,
      targetCandidate: targetCandidateInternal,
    }
  }, [battle, itemCatalog, myAddress])

  const myCanonicalAddr = String(myAddress || '').trim()

  // Tiered color system based on battle value (point transfer + loot)
  const getTierColors = () => {
    const points = battle.transfer_points
    const hasLoot = lootParts.length > 0
    const isCritical = battle.critical

    if (isCritical || (hasLoot && points >= 6)) return {
      border: 'rgba(143,247,255,0.8)',
      bg: 'rgba(12,32,46,0.95)',
      glow: '0 0 25px rgba(143,247,255,0.4), 0 0 50px rgba(143,247,255,0.2), 0 0 75px rgba(143,247,255,0.1)',
      hoverGlow: '0 0 35px rgba(143,247,255,0.6), 0 0 70px rgba(143,247,255,0.3)',
      tier: 'LEGENDARY'
    }
    if (hasLoot || points >= 4) return {
      border: 'rgba(255,231,128,0.75)',
      bg: 'rgba(36,28,12,0.95)',
      glow: '0 0 22px rgba(255,231,128,0.35), 0 0 44px rgba(255,231,128,0.18)',
      hoverGlow: '0 0 32px rgba(255,231,128,0.5), 0 0 64px rgba(255,231,128,0.25)',
      tier: 'RARE'
    }
    if (points >= 2) return {
      border: 'rgba(168,85,247,0.65)',
      bg: 'rgba(28,12,46,0.95)',
      glow: '0 0 18px rgba(168,85,247,0.3), 0 0 36px rgba(168,85,247,0.15)',
      hoverGlow: '0 0 28px rgba(168,85,247,0.45)',
      tier: 'UNCOMMON'
    }
    return {
      border: 'rgba(148,93,255,0.4)',
      bg: 'rgba(18,8,36,0.94)',
      glow: '0 0 12px rgba(148,93,255,0.2)',
      hoverGlow: '0 0 20px rgba(148,93,255,0.35)',
      tier: 'COMMON'
    }
  }

  const tierColors = getTierColors()

  return (
    <button
      key={`${battle.id}-${battle.created_at}`}
      type="button"
      onClick={() => targetCandidate && onChallenge(targetCandidate)}
      className="relative w-full overflow-hidden rounded-[20px] border-2 px-3 py-3 text-left text-[12px] leading-snug transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#ff9de1]/60 hover:-translate-y-1 hover:scale-[1.01]"
      style={{
        borderColor: tierColors.border,
        backgroundColor: tierColors.bg,
        boxShadow: tierColors.glow
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = tierColors.hoverGlow
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = tierColors.glow
      }}
    >
      {/* Corner markers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-3 w-3 border-l-[2px] border-t-[2px]" style={{ borderColor: tierColors.border }} />
        <div className="absolute right-0 top-0 h-3 w-3 border-r-[2px] border-t-[2px]" style={{ borderColor: tierColors.border }} />
        <div className="absolute bottom-0 left-0 h-3 w-3 border-b-[2px] border-l-[2px]" style={{ borderColor: tierColors.border }} />
        <div className="absolute bottom-0 right-0 h-3 w-3 border-b-[2px] border-r-[2px]" style={{ borderColor: tierColors.border }} />
      </div>
      <div className="relative flex items-center justify-between text-[11px] text-fantasy-muted">
        <span>Battle #{battle.id}</span>
        <span className="flex items-center gap-2">
          {battle.critical && (
            <span className="rounded-full border-2 border-[rgba(255,231,128,0.8)] bg-[rgba(255,231,128,0.2)] px-2.5 py-0.5 text-[8px] font-pressstart uppercase tracking-[0.18em] text-[#ffe780] shadow-[0_0_12px_rgba(255,231,128,0.5)]">
              💥 Critical
            </span>
          )}
          <span>{formatTimeAgo(battle.created_at)}</span>
        </span>
      </div>
      <div className="mt-1 font-pressstart pixel-small text-[#8ff7ff]">
        {shortAddress(battle.attacker)} <span className="text-[#ff9de1]">vs</span> {shortAddress(battle.defender)}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-white">
        {/* Winner indicator */}
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[rgba(125,255,207,0.2)] text-[10px] text-[#7dffcf] shadow-[0_0_8px_rgba(125,255,207,0.5)]">
          ✓
        </div>
        <span>Winner: <span className="font-semibold text-[#ffe780]">{shortAddress(winnerAddr)}</span> • <span className="font-mono text-[#7dffcf]">+{formatDisplayPoints(winnerGain, winnerGain >= 10 ? { maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })} BC</span></span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fantasy-muted">
        {/* Loser indicator */}
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[rgba(220,20,60,0.2)] text-[10px] text-[#ff6b9a] shadow-[0_0_8px_rgba(220,20,60,0.5)]">
          ✕
        </div>
        <span>Loser: <span className="text-[#ff9de1]">{shortAddress(loserAddr)}</span> • <span className="font-mono text-[#ff9de1]">−{formatDisplayPoints(battle.transfer_points, battle.transfer_points >= 10 ? { maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })} BC</span></span>
      </div>
      {lootParts.length > 0 && (
        <div className="relative mt-2 rounded-[12px] border border-[rgba(255,231,128,0.4)] bg-[rgba(36,28,12,0.5)] px-2 py-1.5">
          <div className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#ffe780]">Loot Acquired</div>
          <div className="flex flex-wrap gap-2">
            {lootParts.map((p, i) => (
              <span key={`${battle.id}-loot-${i}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,231,128,0.3)] bg-[rgba(255,231,128,0.1)] px-2 py-1 text-[11px]">
                {p.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.icon}
                    alt=""
                    className="h-4 w-4 object-contain"
                    style={{
                      imageRendering: 'pixelated',
                      filter: 'drop-shadow(0 0 4px rgba(255,231,128,0.6))'
                    }}
                  />
                ) : (
                  <span aria-hidden className="drop-shadow-[0_0_4px_rgba(255,231,128,0.6)]">{p.slot === 'shield' ? '🛡️' : '⚔️'}</span>
                )}
                <span className="text-[#ffe780]">{p.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {targetCandidate && targetCandidate !== myCanonicalAddr && (
        <div className="mt-2 font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#c7b5ff]">
          ⚔️ Challenge {shortAddress(targetCandidate)}
        </div>
      )}
    </button>
  )
}

export const ArenaFeedPanel: React.FC<ArenaFeedPanelProps> = ({
  battles,
  myAddress,
  itemCatalog,
  onChallenge,
}) => {
  if (battles.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] text-fantasy-muted">
        No battles yet. Stay tuned.
      </div>
    )
  }

  return (
    <>
      {battles.map((battle) => (
        <BattleEntry
          key={`${battle.id}-${battle.created_at}`}
          battle={battle}
          myAddress={myAddress}
          itemCatalog={itemCatalog}
          onChallenge={onChallenge}
        />
      ))}
    </>
  )
}
