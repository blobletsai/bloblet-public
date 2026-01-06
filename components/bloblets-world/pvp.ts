import type { PvpBattle, PvpItem } from '@/types'

export const RARITY_COLORS = {
  common: '#a7a3ff',
  uncommon: '#9bd7ff',
  rare: '#8ff7ff',
  epic: '#ff9de1',
  legendary: '#ffe780',
} as const satisfies Record<string, string>

const DEFAULT_RARITY_COLOR = RARITY_COLORS.common

export const rarityColor = (rarity: string | null | undefined): string => {
  const key = String(rarity || '').toLowerCase()
  if (key && key in RARITY_COLORS) {
    return RARITY_COLORS[key as keyof typeof RARITY_COLORS]
  }
  return DEFAULT_RARITY_COLOR
}

export const normalizePvpItem = (raw: any): PvpItem => ({
  id: Number(raw?.id || 0),
  slug: String(raw?.slug || '').toLowerCase(),
  type: raw?.type === 'shield' ? 'shield' : 'weapon',
  name: String(raw?.name || raw?.slug || 'Unknown'),
  rarity: String(raw?.rarity || 'common'),
  op: Number(raw?.op || 0),
  dp: Number(raw?.dp || 0),
  icon_url: raw?.icon_url ? String(raw.icon_url) : null,
})

export const parseBattleLoot = (payload: any): PvpBattle['loot'] => {
  const arr = Array.isArray(payload)
    ? payload
    : typeof payload === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(payload)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })()
      : []
  return arr.map((entry: any) => ({
    slot: entry?.slot === 'shield' ? 'shield' : 'weapon',
    item_id: Number(entry?.item_id || entry?.id || 0),
    item_slug: String(entry?.item_slug || entry?.slug || ''),
    from: String(entry?.from || ''),
    to: String(entry?.to || ''),
    equipped: entry?.equipped === true,
  }))
}

export const normalizeBattle = (raw: any): PvpBattle => ({
  id: Number(raw?.id || 0),
  attacker: String(raw?.attacker || ''),
  defender: String(raw?.defender || ''),
  attacker_booster: Number(raw?.attacker_booster || 0),
  defender_booster: Number(raw?.defender_booster || 0),
  attacker_base: Number(raw?.attacker_base || 0),
  defender_base: Number(raw?.defender_base || 0),
  attacker_total: Number(raw?.attacker_total || 0),
  defender_total: Number(raw?.defender_total || 0),
  winner: raw?.winner === 'attacker' ? 'attacker' : 'defender',
  transfer_points: Number(raw?.transfer_points || 0),
  house_points: Number(raw?.house_points || 0),
  loot: parseBattleLoot(raw?.loot),
  critical: raw?.critical === true,
  created_at: String(raw?.created_at || new Date().toISOString()),
})
