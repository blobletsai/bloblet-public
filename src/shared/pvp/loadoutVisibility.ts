import type { PvpItem } from '@/types'

export type LoadoutInput = {
  bloblet_address?: string | null
  address?: string | null
  weapon_item_id?: number | null
  shield_item_id?: number | null
  weapon?: PvpItem | null
  shield?: PvpItem | null
}

export type SanitizedLoadout = {
  address: string
  bloblet_address: string
  weapon: PvpItem | null
  shield: PvpItem | null
  weapon_item_id: number | null
  shield_item_id: number | null
  masked: boolean
}

const normalizeAddress = (raw: string | null | undefined): string => {
  const value = (raw || '').trim()
  return value
}

export function sanitizeLoadoutEntry(
  entry: LoadoutInput,
  viewerAddress?: string | null,
): SanitizedLoadout | null {
  const address =
    normalizeAddress(entry.address) || normalizeAddress(entry.bloblet_address)
  if (!address) return null

  const viewer = normalizeAddress(viewerAddress || '')
  const isOwner = viewer && viewer === address

  return {
    address,
    bloblet_address: address,
    weapon: isOwner ? entry.weapon || null : null,
    shield: isOwner ? entry.shield || null : null,
    weapon_item_id: isOwner ? entry.weapon_item_id ?? null : null,
    shield_item_id: isOwner ? entry.shield_item_id ?? null : null,
    masked: !isOwner,
  }
}

export function sanitizeLoadouts<T extends LoadoutInput>(
  entries: T[] | null | undefined,
  viewerAddress?: string | null,
) {
  const list = Array.isArray(entries) ? entries : []
  return list
    .map((entry) => sanitizeLoadoutEntry(entry, viewerAddress))
    .filter(Boolean) as SanitizedLoadout[]
}
