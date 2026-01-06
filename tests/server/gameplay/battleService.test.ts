import crypto from 'node:crypto'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const applyLedgerEntriesMock = vi.fn()
const fetchRewardBalancesMock = vi.fn()
const recordBattleLootMock = vi.fn()

const ATTACKER_ADDRESS = '9xQeWvG816bUx9EPUMvW2sDbUoCLv7saP2Uq6T6kQ8xY'
const DEFENDER_ADDRESS = 'FJ5Pqvu8qr8sWYF1c4B6jwxKF1uHmVGuTZGi99ZTSsNe'
const TREASURY_ADDRESS = 'So11111111111111111111111111111111111111112'

vi.mock('@/src/server/rewards', () => ({
  REWARD_LEDGER_ENABLED: true,
  applyLedgerEntries: applyLedgerEntriesMock,
  fetchRewardBalances: fetchRewardBalancesMock,
  ledgerTreasuryAddress: () => TREASURY_ADDRESS,
  roundPoints: (value: number) => Math.round(value * 1e6) / 1e6,
}))

let currentBattleClient: any = null

vi.mock('@/src/server/pg', () => ({
  withPgClient: async (handler: (client: any) => any) => {
    if (!currentBattleClient) throw new Error('battle client not configured')
    return handler(currentBattleClient)
  },
}))

vi.mock('@/src/server/chains', () => ({
  resolveChainKind: () => 'sol',
}))

vi.mock('@/src/server/gameplay/gearService', () => ({
  recordBattleLoot: recordBattleLootMock,
}))

let buildMaskedOpponent: (address: string) => { maskedId: string; displayHint: string }
let runBattle: typeof import('@/src/server/gameplay/battleService').runBattle

type BattleState = {
  bloblets: Record<string, { address: string; care_state: any; is_alive: boolean }>
  items: Array<{ id: number; slug: string; type: string; name: string; rarity: string; op: number; dp: number; icon_url: string | null }>
  loadouts: Map<string, { weapon_item_id: number | null; shield_item_id: number | null }>
  nextBattleId: number
  lastBattle?: { params: any[]; id: number }
}

class FakeBattleClient {
  readonly state: BattleState
  readonly queries: Array<{ sql: string; params: any[] }>

  constructor(state: BattleState) {
    this.state = state
    this.queries = []
  }

  async query(sql: string, params: any[] = []) {
    this.queries.push({ sql, params })
    const normalized = sql.trim().toLowerCase()
    if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
      return { rowCount: 0 }
    }
    if (normalized.startsWith('select attacker')) {
      return { rows: [] }
    }
    if (normalized.startsWith('select address') && normalized.includes('from public.bloblets')) {
      const addressesParam = params[0] || []
      const addresses = Array.isArray(addressesParam) ? addressesParam : []
      const rows = addresses.map((addr: string) => {
        const entry = this.state.bloblets[addr]
        if (!entry) return null
        return {
          address: entry.address,
          care_state: entry.care_state,
          is_alive: entry.is_alive,
        }
      }).filter(Boolean)
      return { rows }
    }
    if (normalized.startsWith('select id') && normalized.includes('from public.pvp_items')) {
      return { rows: this.state.items }
    }
    if (normalized.startsWith('select bloblet_address') && normalized.includes('from public.bloblet_loadout')) {
      const addressesParam = params[0] || []
      const addresses = Array.isArray(addressesParam) ? addressesParam : []
      const rows = addresses.map((addr: string) => {
        const loadout = this.state.loadouts.get(addr) || { weapon_item_id: null, shield_item_id: null }
        return {
          bloblet_address: addr,
          weapon_item_id: loadout.weapon_item_id,
          shield_item_id: loadout.shield_item_id,
        }
      })
      return { rows }
    }
    if (normalized.startsWith('insert into public.bloblet_loadout') && normalized.includes('do nothing')) {
      const [address, weaponId, shieldId] = params
      if (!this.state.loadouts.has(address)) {
        this.state.loadouts.set(address, {
          weapon_item_id: weaponId ?? null,
          shield_item_id: shieldId ?? null,
        })
      }
      return { rowCount: 1 }
    }
    if (normalized.startsWith('insert into public.bloblet_loadout') && normalized.includes('do update')) {
      const [address, weaponId, shieldId] = params
      this.state.loadouts.set(address, {
        weapon_item_id: weaponId ?? null,
        shield_item_id: shieldId ?? null,
      })
      return { rowCount: 1 }
    }
    if (normalized.startsWith('insert into public.pvp_battles')) {
      const id = this.state.nextBattleId++
      this.state.lastBattle = { params, id }
      return { rows: [{ id }] }
    }
    if (normalized.startsWith('insert into public.pvp_cooldowns')) {
      return { rowCount: 2 }
    }
    throw new Error(`Unexpected query for battle client: ${sql}`)
  }
}

const rewardBalances = new Map<string, number>()
const randomIntSpy = vi.spyOn(crypto, 'randomInt')

function activeCareState(): any {
  const now = Date.now()
  return {
    lastChargedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    cooldownEndsAt: new Date(now + 15 * 60 * 1000).toISOString(),
    boostersActiveUntil: new Date(now + 15 * 60 * 1000).toISOString(),
  }
}

type BattleClientOptions = {
  attackerCareState?: any
  defenderCareState?: any
  attackerLoadout?: { weapon_item_id: number | null; shield_item_id: number | null }
  defenderLoadout?: { weapon_item_id: number | null; shield_item_id: number | null }
  items?: BattleState['items']
  attackerAlive?: boolean
  defenderAlive?: boolean
}

function createBattleClient(options: BattleClientOptions = {}): FakeBattleClient {
  const attackerAddr = ATTACKER_ADDRESS
  const defenderAddr = DEFENDER_ADDRESS
  const state: BattleState = {
    bloblets: {
      [attackerAddr]: {
        address: attackerAddr,
        care_state: options.attackerCareState ?? activeCareState(),
        is_alive: options.attackerAlive ?? true,
      },
      [defenderAddr]: {
        address: defenderAddr,
        care_state: options.defenderCareState ?? activeCareState(),
        is_alive: options.defenderAlive ?? true,
      },
    },
    items:
      options.items ?? [
        { id: 1, slug: 'starter_sword', type: 'weapon', name: 'Starter Sword', rarity: 'common', op: 12, dp: 0, icon_url: null },
        { id: 2, slug: 'starter_shield', type: 'shield', name: 'Starter Shield', rarity: 'common', op: 0, dp: 6, icon_url: null },
        { id: 3, slug: 'backup_shield', type: 'shield', name: 'Bulwark', rarity: 'rare', op: 0, dp: 12, icon_url: null },
      ],
    loadouts: new Map<string, { weapon_item_id: number | null; shield_item_id: number | null }>([
      [attackerAddr, options.attackerLoadout ?? { weapon_item_id: 1, shield_item_id: null }],
      [defenderAddr, options.defenderLoadout ?? { weapon_item_id: null, shield_item_id: 2 }],
    ]),
    nextBattleId: 1,
  }
  return new FakeBattleClient(state)
}

beforeEach(() => {
  rewardBalances.clear()
  rewardBalances.set(ATTACKER_ADDRESS, 100)
  rewardBalances.set(DEFENDER_ADDRESS, 100)
  rewardBalances.set(TREASURY_ADDRESS, 0)

  applyLedgerEntriesMock.mockReset()
  applyLedgerEntriesMock.mockImplementation(async (_client, entries: Array<{ address: string; delta: number }>) => {
    for (const entry of entries) {
      const key = String(entry.address || '').trim()
      const prev = rewardBalances.get(key) ?? 0
      rewardBalances.set(key, prev + entry.delta)
    }
    const map = new Map<string, number>()
    for (const [key, value] of rewardBalances.entries()) {
      map.set(key, value)
    }
    return map
  })

  fetchRewardBalancesMock.mockReset()
  fetchRewardBalancesMock.mockImplementation(async (_client, addresses: string[]) => {
    const map = new Map<string, { currentBalance: number }>()
    for (const addr of addresses) {
      const key = String(addr || '').trim()
      map.set(key, { currentBalance: rewardBalances.get(key) ?? 0 })
    }
    return map
  })

  recordBattleLootMock.mockReset()
  randomIntSpy.mockReset()
  randomIntSpy.mockImplementation(() => 500000)
})

afterEach(() => {
  currentBattleClient = null
})

beforeAll(async () => {
  const battleModule = await import('@/src/server/gameplay/battleService')
  buildMaskedOpponent = battleModule.buildMaskedOpponent
  runBattle = battleModule.runBattle
})

describe('battleService helpers', () => {
  it('masks opponent address with hint', () => {
    const masked = buildMaskedOpponent('0xabcdef1234567890')
    expect(masked.maskedId).toMatch(/…/)
    expect(masked.displayHint).toBeDefined()
    expect(masked.maskedId.startsWith('0xa')).toBe(true)
    expect(masked.maskedId.endsWith('890')).toBe(true)
  })
})

describe('runBattle', () => {
  it('awards attacker on a standard win', async () => {
    const client = createBattleClient()
    currentBattleClient = client

    const result = await runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)

    expect(result.winner).toBe('attacker')
    expect(result.critical).toBe(false)
    expect(result.loot).toHaveLength(1)
    expect(applyLedgerEntriesMock).toHaveBeenCalledTimes(1)
    const ledgerCall = applyLedgerEntriesMock.mock.calls[0]
    expect(ledgerCall).toBeDefined()
    const ledgerEntries = (ledgerCall?.[1] ?? []) as Array<{ reason: string; address?: string }>
    expect(ledgerEntries[0]?.reason).toBe('battle_win')
    expect(ledgerEntries[1]?.reason).toBe('battle_loss')
    expect(ledgerEntries[2]?.reason).toBe('treasury_cut')
    expect(rewardBalances.get(ATTACKER_ADDRESS)).toBeGreaterThan(100)
    expect(rewardBalances.get(DEFENDER_ADDRESS)).toBeLessThan(100)
  })

  it('allows defender to win when shield overpowers attacker', async () => {
    const client = createBattleClient({
      attackerLoadout: { weapon_item_id: null, shield_item_id: null },
      defenderLoadout: { weapon_item_id: null, shield_item_id: 3 },
    })
    currentBattleClient = client

    const result = await runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)

    expect(result.winner).toBe('defender')
    const ledgerCall = applyLedgerEntriesMock.mock.calls[0]
    expect(ledgerCall).toBeDefined()
    const ledgerEntries = (ledgerCall?.[1] ?? []) as Array<{ reason: string; address: string }>
    expect(ledgerEntries[0]?.address).toBe(DEFENDER_ADDRESS)
    expect(ledgerEntries[0]?.reason).toBe('battle_win')
    expect(ledgerEntries[1]?.reason).toBe('battle_loss')
  })

  it('records critical wins and loot transfers', async () => {
    const items = [
      { id: 1, slug: 'blade', type: 'weapon', name: 'Blade', rarity: 'common', op: 14, dp: 0, icon_url: null },
      { id: 2, slug: 'shield', type: 'shield', name: 'Shield', rarity: 'common', op: 0, dp: 6, icon_url: null },
      { id: 4, slug: 'def-sword', type: 'weapon', name: 'Defender Sword', rarity: 'common', op: 6, dp: 0, icon_url: null },
    ]
    const client = createBattleClient({
      defenderLoadout: { weapon_item_id: 4, shield_item_id: 2 },
      items,
    })
    currentBattleClient = client

    randomIntSpy.mockImplementationOnce(() => 500000) // attacker luck
    randomIntSpy.mockImplementationOnce(() => 500000) // defender luck
    randomIntSpy.mockImplementationOnce(() => 0) // critical chance roll

    const result = await runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)

    expect(result.winner).toBe('attacker')
    expect(result.critical).toBe(true)
    expect(result.loot.length).toBeGreaterThanOrEqual(1)
    expect(recordBattleLootMock).toHaveBeenCalled()
    const slots = result.loot.map((entry) => entry.slot)
    expect(slots).toContain('shield')
  })

  it('prevents battles when attacker coverage is overdue', async () => {
    const overdue = {
      lastChargedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      cooldownEndsAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      boostersActiveUntil: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    }
    const client = createBattleClient({ attackerCareState: overdue })
    currentBattleClient = client

    await expect(runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)).rejects.toMatchObject({ message: 'attacker_overdue' })
  })

  it('prevents battles when attacker stake is below the minimum', async () => {
    const client = createBattleClient()
    currentBattleClient = client
    rewardBalances.set(ATTACKER_ADDRESS, 1)

    await expect(runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)).rejects.toMatchObject({ message: 'attacker_balance_low' })
  })

  it('prevents battles when defender stake is below the minimum', async () => {
    const client = createBattleClient()
    currentBattleClient = client
    rewardBalances.set(DEFENDER_ADDRESS, 1)

    await expect(runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)).rejects.toMatchObject({ message: 'defender_balance_low' })
  })

  it('prevents battles when attacker is marked dead', async () => {
    const client = createBattleClient({ attackerAlive: false })
    currentBattleClient = client

    await expect(runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)).rejects.toMatchObject({ message: 'attacker_dead' })
  })

  it('prevents battles when defender is marked dead', async () => {
    const client = createBattleClient({ defenderAlive: false })
    currentBattleClient = client

    await expect(runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)).rejects.toMatchObject({ message: 'defender_dead' })
  })

  it('allows battles when defender coverage is overdue but stake is ready', async () => {
    const overdue = {
      lastChargedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      cooldownEndsAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      boostersActiveUntil: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    }
    const client = createBattleClient({ defenderCareState: overdue })
    currentBattleClient = client

    const result = await runBattle(ATTACKER_ADDRESS, DEFENDER_ADDRESS)

    expect(result).toHaveProperty('winner')
    expect(applyLedgerEntriesMock).toHaveBeenCalled()
  })
})
