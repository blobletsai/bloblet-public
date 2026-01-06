"use client"

import type { PvpItem, PvpItemType } from '@/types'
import { computeRisk, riskToneWeight } from '@/src/shared/pvp'
import type { RiskTone } from '@/src/shared/pvp'
import { rarityColor } from './pvp'
import type { HolderMetaEntry } from './types'

// Internal type with full opponent data (used for calculations only)
type TargetSuggestionInternal = {
  address: string
  displayAddress: string
  name: string | null
  weapon: PvpItem | null
  shield: PvpItem | null
  shieldStat: number
  weaponStat: number
  risk: ReturnType<typeof computeRisk>
  balance: number | null
}

// Public type with masked opponent data (prevents farming/over-disclosure)
export type TargetSuggestion = {
  address: string
  displayAddress: string
  name: string | null
  riskTier: 'favorable' | 'even' | 'risky'  // Qualitative label only
  riskTone: RiskTone  // Preserved for color coding
  hasMinimumStake: boolean  // Boolean only, not exact amount
}

// Helper: Convert risk tone to tier label
function riskToneToTier(tone: RiskTone): 'favorable' | 'even' | 'risky' {
  if (tone === 'good') return 'favorable'
  if (tone === 'bad') return 'risky'
  return 'even'  // 'warn' or 'neutral'
}

// Helper: Mask opponent data to prevent farming
function maskOpponentData(
  internal: TargetSuggestionInternal,
  minStake: number | null
): TargetSuggestion {
  const threshold = typeof minStake === 'number' && minStake > 0 ? minStake : 0
  const hasBalance = typeof internal.balance === 'number' && Number.isFinite(internal.balance)
  const hasMinimumStake = hasBalance && internal.balance !== null && internal.balance >= threshold

  return {
    address: internal.address,
    displayAddress: internal.displayAddress,
    name: internal.name,
    riskTier: riskToneToTier(internal.risk.tone),
    riskTone: internal.risk.tone,
    hasMinimumStake,
  }
}

export function buildTargetSuggestions(options: {
  myAddressCanonical: string | null
  loadoutState: Record<string, { weapon: PvpItem | null; shield: PvpItem | null }>
  holderMeta: Record<string, HolderMetaEntry>
  myWeaponStat: number
  minStake?: number | null
}): TargetSuggestion[] {
  const { myAddressCanonical, loadoutState, holderMeta, myWeaponStat, minStake = null } = options
  if (!myAddressCanonical) return []

  // Build internal entries with full data for sorting/calculation
  const internalEntries: Array<TargetSuggestionInternal & { weight: number; statDiff: number }> = []

  for (const [addr, loadout] of Object.entries(loadoutState)) {
    if (addr === myAddressCanonical) continue
    const shield = loadout?.shield || null
    const weapon = loadout?.weapon || null
    const shieldStat = shield?.dp ?? 0
    const weaponStat = weapon?.op ?? 0
    const risk = computeRisk(myWeaponStat, shieldStat)
    const meta = holderMeta[addr]
    const rawBalance = meta?.balance
    const balance =
      typeof rawBalance === 'number' && Number.isFinite(rawBalance) ? rawBalance : null
    const displayAddress = meta?.addressCased || addr

    internalEntries.push({
      address: addr,
      displayAddress,
      name: meta?.name || null,
      weapon,
      shield,
      shieldStat,
      weaponStat,
      risk,
      balance,
      weight: riskToneWeight(risk),
      statDiff: myWeaponStat - shieldStat,
    })
  }

  // Sort by favorability, then stat advantage, then balance
  const sortedInternal = internalEntries
    .sort((a, b) => {
      if (a.weight !== b.weight) return a.weight - b.weight
      if (b.statDiff !== a.statDiff) return b.statDiff - a.statDiff
      const balA = a.balance ?? 0
      const balB = b.balance ?? 0
      return balB - balA
    })
    .slice(0, 5)

  // Mask opponent data before returning (prevents farming)
  return sortedInternal.map((entry) => maskOpponentData(entry, minStake))
}

export function selectRecentOpponents(
  myAddress: string,
  battleFeed: Array<{ attacker: string; defender: string }>,
  holderMeta: Record<string, HolderMetaEntry>,
  limit = 10,
) {
  const seen = new Set<string>()
  const myAddrCanonical = String(myAddress || '').trim()
  const picks: string[] = []
  for (const battle of battleFeed) {
    const candidates = [battle.attacker, battle.defender]
    for (const addr of candidates) {
      const key = String(addr || '').trim()
      if (!key || key === myAddrCanonical || seen.has(key)) continue
      seen.add(key)
      const display = holderMeta[key]?.addressCased || addr
      picks.push(display)
      if (picks.length >= limit) return picks
    }
  }
  return picks
}

export function buildHighlightedTargets(
  suggestions: TargetSuggestion[],
  limit: number,
): HighlightedTarget[] {
  // Suggestions already contain hasMinimumStake boolean from masking
  return suggestions.slice(0, limit)
}

export function buildLoadoutCardsFromSuggestions(
  myWeapon: PvpItem | null,
  myShield: PvpItem | null,
  futureTotal = 4,
) {
  const cards = []

  cards.push(makeGearCard('weapon', '⚔️', 'Weapon Slot', myWeapon, 'OP Bonus'))
  cards.push(makeGearCard('shield', '🛡️', 'Shield Slot', myShield, 'DP Bonus'))

  for (let i = 0; i < futureTotal; i += 1) {
    cards.push({
      key: `slot-${i}`,
      kind: 'future' as const,
      icon: i % 2 === 0 ? '✨' : '⭐️',
      title: 'Locked Slot',
      subtitle: 'Coming soon',
      rarity: '—',
      statLabel: 'Bonus',
      statValue: '+?',
      description: 'Future collectibles and boosters will live here.',
      equipped: false,
    })
  }

  return cards
}

function makeGearCard(
  key: 'weapon' | 'shield',
  icon: string,
  fallbackTitle: string,
  item: PvpItem | null,
  statLabel: string,
) {
  return {
    key,
    kind: key,
    icon,
    title: item?.name || fallbackTitle,
    subtitle: item ? 'Equipped' : 'Empty',
    rarity: String(item?.rarity || 'Common').toUpperCase(),
    statLabel,
    statValue: item ? `+${key === 'weapon' ? item.op : item.dp}` : '+0',
    description:
      key === 'weapon'
        ? item
          ? `Boosts attack rolls by ${item.op}.`
          : 'Win battles to unlock weapons.'
        : item
          ? `Absorbs incoming damage by ${item.dp}.`
          : 'Protect yourself with defensive gear.',
    equipped: !!item,
  }
}

export function renderGearSlotContent(slot: PvpItemType, item: PvpItem | null) {
  const label = slot === 'weapon' ? 'Weapon' : 'Shield'
  const statLabel = slot === 'weapon' ? 'OP' : 'DP'
  const statValue = slot === 'weapon' ? (item?.op || 0) : (item?.dp || 0)
  const color = item ? rarityColor(item.rarity) : 'rgba(255,255,255,0.45)'
  const emoji = slot === 'weapon' ? '⚔️' : '🛡️'

  return { label, statLabel, statValue, color, emoji }
}

// HighlightedTarget is now just an alias since masking happens in buildTargetSuggestions
export type HighlightedTarget = TargetSuggestion
