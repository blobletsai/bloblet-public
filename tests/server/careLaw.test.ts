import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { gameplayConfig } from '@/src/config/gameplay'
import { invalidateCareDropConfigCache } from '@/src/server/gameplay/careConfig'

let maybeGrantCareDrop: typeof import('@/src/server/gameplay/careDrops')['maybeGrantCareDrop']

class FakeClient {
  lastUpsert: any = null
  loadoutRow: any = null
  catalogRows: any[]

  constructor(options: { loadoutRow?: any; catalogRows?: any[] } = {}) {
    this.loadoutRow = options.loadoutRow ?? null
    this.catalogRows =
      options.catalogRows ??
      [
        { id: 1, slug: 'w1', type: 'weapon', name: 'W1', rarity: 'common', op: 1, dp: 0, icon_url: null },
        { id: 2, slug: 'w2', type: 'weapon', name: 'W2', rarity: 'uncommon', op: 2, dp: 0, icon_url: null },
        { id: 3, slug: 's1', type: 'shield', name: 'S1', rarity: 'common', op: 0, dp: 1, icon_url: null },
        { id: 4, slug: 's2', type: 'shield', name: 'S2', rarity: 'uncommon', op: 0, dp: 2, icon_url: null },
      ]
  }

  // Minimal query router
  async query(sql: string, params: any[] = []) {
    const s = String(sql)
    if (s.includes('from public.bloblet_loadout') && s.includes('where bloblet_address')) {
      if (this.loadoutRow) {
        return { rows: [this.loadoutRow] }
      }
      return { rows: [] }
    }
    if (s.includes('from public.pvp_items')) {
      return { rows: this.catalogRows.map((row) => ({ ...row })) }
    }
    if (s.startsWith('insert into public.bloblet_loadout')) {
      this.lastUpsert = { sql: s, params }
      return { rows: [] }
    }
    if (s.startsWith('insert into public.events')) {
      return { rows: [] }
    }
    return { rows: [] }
  }
}

const originalDropConfig = { ...gameplayConfig.care.drop }

async function loadCareDrops() {
  vi.resetModules()
  ;({ maybeGrantCareDrop } = await import('@/src/server/gameplay/careDrops'))
}

function setCareDropOverrides(overrides: Partial<typeof gameplayConfig.care.drop>) {
  Object.assign(gameplayConfig.care.drop, overrides)
}

describe('Care Law (accumulator + bias)', () => {
  beforeEach(async () => {
    setCareDropOverrides({ baseProbability: 0.2, accumulatorEnabled: true, shieldFirstBias: true })
    await loadCareDrops()
  })

  afterEach(() => {
    Object.assign(gameplayConfig.care.drop, originalDropConfig)
    invalidateCareDropConfigCache()
    vi.restoreAllMocks()
  })

  it('carries accumulator on miss', async () => {
    // effective = base + acc = 0.2 + 0.4 = 0.6; force miss with roll 0.99
    vi.spyOn(require('node:crypto'), 'randomInt').mockReturnValue(990000)
    const client = new FakeClient()
    const res = await maybeGrantCareDrop(client as any, 'addr1', 'charge', 0.4)
    expect(res.awarded).toBe(false)
    // dropAccNext should carry effective (0.6)
    expect(Math.abs(Number(res.dropAccNext) - 0.6)).toBeLessThan(1e-6)
  })

  it('resets accumulator on hit', async () => {
    // effective = 0.2 + 0.4 = 0.6; force hit with roll 0.10
    vi.spyOn(require('node:crypto'), 'randomInt').mockReturnValue(100000)
    const client = new FakeClient()
    const res = await maybeGrantCareDrop(client as any, 'addr2', 'charge', 0.4)
    expect(res.awarded).toBe(true)
    // dropAccNext resets to 0 on hit (since effective < 1)
    expect(Number(res.dropAccNext)).toBe(0)
  })

  it('uses shield-first bias when both slots are empty', async () => {
    // Force hit to observe chosen slot
    vi.spyOn(require('node:crypto'), 'randomInt').mockReturnValue(0)
    const client = new FakeClient()
    const res = await maybeGrantCareDrop(client as any, 'addr3', 'charge', 0.9)
    expect(res.awarded).toBe(true)
    expect(res.slot).toBe('shield')
  })

  it('upgrades the weaker slot when loadout already has gear equipped', async () => {
    vi.spyOn(require('node:crypto'), 'randomInt').mockReturnValue(0)
    const client = new FakeClient({ loadoutRow: { weapon_item_id: null, shield_item_id: 3 } })
    const res = await maybeGrantCareDrop(client as any, 'addr4', 'charge', 0)
    expect(res.awarded).toBe(true)
    expect(res.slot).toBe('weapon')
    expect(res.item?.slug).toBe('w1')
  })

  it('fills accumulator to the guarantee when rng hits but loadout is maxed', async () => {
    vi.spyOn(require('node:crypto'), 'randomInt').mockReturnValue(0)
    const client = new FakeClient({ loadoutRow: { weapon_item_id: 2, shield_item_id: 4 } })
    const res = await maybeGrantCareDrop(client as any, 'addr5', 'charge', 0)
    expect(res.awarded).toBe(false)
    expect(res.fallbackType).toBe('maxed_out')
    expect(res.dropAccNext).toBeCloseTo(0.8, 6)
  })

  it('fills accumulator to the guarantee when rng hits but catalog is missing', async () => {
    vi.spyOn(require('node:crypto'), 'randomInt').mockReturnValue(0)
    const client = new FakeClient({ catalogRows: [] })
    const res = await maybeGrantCareDrop(client as any, 'addr6', 'charge', 0.1)
    expect(res.awarded).toBe(false)
    expect(res.fallbackType).toBe('catalog_missing')
    expect(res.dropAccNext).toBeCloseTo(0.8, 6)
  })
})
