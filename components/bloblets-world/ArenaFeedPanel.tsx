"use client"

import React, { useMemo } from 'react'
import type { PvpBattle, PvpItem } from '@/types'
import { shortAddress } from '@/src/shared/pvp'
import { formatDisplayPoints } from '@/src/shared/points'
import { formatTimeAgo } from './formatters'

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
      const baseName = item?.name || entry.item_slug || (entry.slot === 'shield' ? 'Shield' : 'Weapon')
      return baseName ? `${baseName}${entry.equipped ? ' ★' : ''}` : null
    }).filter(Boolean) as string[]
    const attackerAddr = String(battle.attacker || '').trim()
    const defenderAddr = String(battle.defender || '').trim()
    const myAddrCanonical = String(myAddress || '').trim()
    const targetCandidateInternal = myAddrCanonical && myAddrCanonical === attackerAddr
      ? defenderAddr
      : attackerAddr === defenderAddr
        ? defenderAddr
        : attackerAddr

    return {
      winnerAddr: winnerAddrInternal,
      loserAddr: loserAddrInternal,
      winnerGain: winnerGainInternal,
      lootParts: loot,
      targetCandidate: targetCandidateInternal,
    }
  }, [battle, itemCatalog, myAddress])

  const myAddrCanonical = String(myAddress || '').trim()

  return (
    <button
      key={`${battle.id}-${battle.created_at}`}
      type="button"
      onClick={() => targetCandidate && onChallenge(targetCandidate)}
      className="w-full rounded-2xl border border-[rgba(148,93,255,0.28)] bg-gradient-to-br from-[rgba(18,8,42,0.94)] to-[rgba(10,3,24,0.92)] px-3 py-3 text-left text-[12px] leading-snug transition-all focus:outline-none focus:ring-2 focus:ring-[#ff9de1]/60 hover:-translate-y-1 hover:border-[rgba(255,134,230,0.45)] hover:shadow-[0_16px_36px_rgba(148,93,255,0.28)]"
    >
      <div className="flex items-center justify-between text-[11px] text-fantasy-muted">
        <span>Battle #{battle.id}</span>
        <span className="flex items-center gap-2">
          {battle.critical && (
            <span className="text-[#ffe780] font-pressstart pixel-tiny uppercase tracking-[0.18em]">
              Critical
            </span>
          )}
          <span>{formatTimeAgo(battle.created_at)}</span>
        </span>
      </div>
      <div className="mt-1 font-pressstart pixel-small text-[#8ff7ff]">
        {shortAddress(battle.attacker)} <span className="text-[#ff9de1]">vs</span> {shortAddress(battle.defender)}
      </div>
      <div className="mt-1 text-[12px] text-white">
        Winner: <span className="text-[#ffe780]">{shortAddress(winnerAddr)}</span> • +{formatDisplayPoints(winnerGain, winnerGain >= 10 ? { maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })} BC
      </div>
      <div className="mt-0.5 text-[11px] text-fantasy-muted">
        Loser: <span className="text-[#ff9de1]">{shortAddress(loserAddr)}</span> • −{formatDisplayPoints(battle.transfer_points, battle.transfer_points >= 10 ? { maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })} BC
      </div>
      {lootParts.length > 0 && (
        <div className="mt-1 text-[11px] text-[#9bd7ff]">
          Loot: {lootParts.join(', ')}
        </div>
      )}
      {targetCandidate && targetCandidate !== myAddrCanonical && (
        <div className="mt-2 font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#c7b5ff]">
          Tap to challenge {shortAddress(targetCandidate)}
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
