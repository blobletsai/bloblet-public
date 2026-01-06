"use client"

import type { PvpItem } from '@/types'
import type { HubTab } from './types'

export type LoadoutCard = {
  key: string
  kind: 'weapon' | 'shield' | 'future'
  icon: string
  imageUrl?: string | null
  title: string
  subtitle: string
  rarity: string
  statLabel: string
  statValue: string
  tier?: number | null
  description: string
  equipped: boolean
}

export type HubTabMeta = Record<
  HubTab,
  { icon: string; label: string; subtitle: string; attention?: boolean }
>

export function buildLoadoutCards(
  myWeapon: PvpItem | null,
  myShield: PvpItem | null,
  futureTotal = 4,
): LoadoutCard[] {
  const cards: LoadoutCard[] = []

  cards.push({
    key: 'weapon',
    kind: 'weapon',
    icon: '⚔️',
    imageUrl: myWeapon?.icon_url ?? null,
    title: myWeapon?.name || 'Weapon Slot',
    subtitle: myWeapon ? 'Equipped' : 'Empty',
    rarity: String(myWeapon?.rarity || 'Common').toUpperCase(),
    statLabel: 'OP Bonus',
    statValue: myWeapon ? `+${myWeapon.op}` : '+0',
    tier: myWeapon ? Number(myWeapon.op || 0) : null,
    description: myWeapon
      ? `Boosts attack rolls by ${myWeapon.op}.`
      : 'Win battles to unlock weapons.',
    equipped: !!myWeapon,
  })

  cards.push({
    key: 'shield',
    kind: 'shield',
    icon: '🛡️',
    imageUrl: myShield?.icon_url ?? null,
    title: myShield?.name || 'Shield Slot',
    subtitle: myShield ? 'Equipped' : 'Empty',
    rarity: String(myShield?.rarity || 'Common').toUpperCase(),
    statLabel: 'DP Bonus',
    statValue: myShield ? `+${myShield.dp}` : '+0',
    tier: myShield ? Number(myShield.dp || 0) : null,
    description: myShield
      ? `Absorbs incoming damage by ${myShield.dp}.`
      : 'Protect yourself with defensive gear.',
    equipped: !!myShield,
  })

  for (let i = 0; i < futureTotal; i += 1) {
    cards.push({
      key: `slot-${i}`,
      kind: 'future',
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

export function getLoadoutLabels(myWeapon: PvpItem | null, myShield: PvpItem | null) {
  const weaponLabel = myWeapon?.name
    ? myWeapon.name.length > 12
      ? `${myWeapon.name.slice(0, 12)}…`
      : myWeapon.name
    : 'No Weapon'

  const shieldLabel = myShield?.name
    ? myShield.name.length > 12
      ? `${myShield.name.slice(0, 12)}…`
      : myShield.name
    : 'No Shield'

  return { weaponLabel, shieldLabel }
}

interface HubMetaOptions {
  hudConfig: Record<HubTab, { icon: string; label: string }>
  careHighlight: string
  personaSubtitle?: string
  highlightedCount: number
  hasLoadout: boolean
  rewardBalanceLabel: string | null
  weaponLabel: string
  shieldLabel: string
  isNourishReady?: boolean
}

export function buildHubTabMeta({
  hudConfig,
  careHighlight,
  highlightedCount,
  personaSubtitle,
  hasLoadout,
  rewardBalanceLabel,
  weaponLabel,
  shieldLabel,
  isNourishReady,
}: HubMetaOptions): HubTabMeta {
  return {
    life: {
      icon: hudConfig.life.icon,
      label: hudConfig.life.label,
      subtitle: careHighlight,
      attention: isNourishReady,
    },
    persona: {
      icon: hudConfig.persona.icon,
      label: hudConfig.persona.label,
      subtitle: personaSubtitle || 'Avatar, names, landmarks',
    },
    loadout: {
      icon: hudConfig.loadout.icon,
      label: hudConfig.loadout.label,
      subtitle: hasLoadout
        ? `${weaponLabel} • ${shieldLabel}`
        : 'Connect to equip gear',
    },
    opponents: {
      icon: hudConfig.opponents.icon,
      label: hudConfig.opponents.label,
      subtitle: highlightedCount ? `${highlightedCount} scouted` : 'No targets yet',
    },
    rewards: {
      icon: hudConfig.rewards.icon,
      label: hudConfig.rewards.label,
      subtitle: rewardBalanceLabel ? `${rewardBalanceLabel} BC` : '0 BC',
    },
  }
}

export function splitLoadoutCards(cards: LoadoutCard[]) {
  return {
    primary: cards.filter((card) => card.kind === 'weapon' || card.kind === 'shield'),
    future: cards.filter((card) => card.kind === 'future'),
  }
}
