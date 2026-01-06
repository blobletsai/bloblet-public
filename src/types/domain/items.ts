/**
 * PVP Items & Loadouts
 */

export type PvpItemType = 'weapon' | 'shield'

export interface PvpItem {
  id: number
  slug: string
  type: PvpItemType
  name: string
  rarity: string
  op: number
  dp: number
  icon_url?: string | null
}

export interface BlobletLoadout {
  bloblet_address: string
  weapon_item_id: number | null
  shield_item_id: number | null
  // Hydrated items
  weapon?: PvpItem | null
  shield?: PvpItem | null
  updated_at?: string
}
