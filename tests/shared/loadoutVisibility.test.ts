import { describe, expect, it } from 'vitest'

import { sanitizeLoadouts } from '../../src/shared/pvp/loadoutVisibility'
import { buildLoadoutStateFromEvents } from '../../components/bloblets-world/hooks/useGameplayFeeds'

const mockWeapon = {
  id: 10,
  slug: 'blade',
  type: 'weapon' as const,
  name: 'Blade',
  rarity: 'common',
  op: 5,
  dp: 0,
  icon_url: null,
}

const mockShield = {
  id: 20,
  slug: 'buckler',
  type: 'shield' as const,
  name: 'Buckler',
  rarity: 'common',
  op: 0,
  dp: 3,
  icon_url: null,
}

describe('loadout visibility', () => {
  it('masks opponent loadouts in SSR payloads', () => {
    const loadouts = [
      {
        bloblet_address: 'addr1',
        address: 'addr1',
        weapon_item_id: mockWeapon.id,
        shield_item_id: mockShield.id,
        weapon: mockWeapon,
        shield: mockShield,
      },
    ]

    const masked = sanitizeLoadouts(loadouts)
    expect(masked).toHaveLength(1)
    expect(masked[0].weapon).toBeNull()
    expect(masked[0].shield).toBeNull()
    expect(masked[0].weapon_item_id).toBeNull()
    expect(masked[0].shield_item_id).toBeNull()
    expect(masked[0].masked).toBe(true)
  })

  it('preserves owner loadout while masking others', () => {
    const loadouts = [
      {
        bloblet_address: 'owner',
        address: 'owner',
        weapon_item_id: mockWeapon.id,
        shield_item_id: mockShield.id,
        weapon: mockWeapon,
        shield: mockShield,
      },
      {
        bloblet_address: 'opponent',
        address: 'opponent',
        weapon_item_id: mockWeapon.id,
        shield_item_id: mockShield.id,
        weapon: mockWeapon,
        shield: mockShield,
      },
    ]

    const masked = sanitizeLoadouts(loadouts, 'owner')
    expect(masked).toHaveLength(2)

    const owner = masked.find((entry) => entry.address === 'owner')!
    expect(owner.weapon?.id).toBe(mockWeapon.id)
    expect(owner.shield?.id).toBe(mockShield.id)
    expect(owner.masked).toBe(false)

    const opponent = masked.find((entry) => entry.address === 'opponent')!
    expect(opponent.weapon).toBeNull()
    expect(opponent.shield).toBeNull()
    expect(opponent.masked).toBe(true)
  })

  it('filters realtime loadout state to the viewer only', () => {
    const events = new Map<string, { weaponItemId: number | null; shieldItemId: number | null }>([
      ['owner', { weaponItemId: mockWeapon.id, shieldItemId: mockShield.id }],
      ['opponent', { weaponItemId: mockWeapon.id, shieldItemId: mockShield.id }],
    ])
    const catalog = {
      [mockWeapon.id]: mockWeapon,
      [mockShield.id]: mockShield,
    }

    const state = buildLoadoutStateFromEvents(events, catalog, 'owner')
    expect(state.owner.weapon?.id).toBe(mockWeapon.id)
    expect(state.owner.shield?.id).toBe(mockShield.id)
    expect(state.opponent.weapon).toBeNull()
    expect(state.opponent.shield).toBeNull()
  })
})
