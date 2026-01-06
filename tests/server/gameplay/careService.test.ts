import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { gameplayConfig } from '@/src/config/gameplay'
import { buildChargeStatus, computeNextChargeState, type ChargeState } from '@/src/shared/care'
import { CareError } from '@/src/server/gameplay/careErrors'

const applyLedgerEntriesMock = vi.fn()
const fetchRewardBalancesMock = vi.fn()

vi.mock('@/src/server/rewards', () => ({
  REWARD_LEDGER_ENABLED: true,
  applyLedgerEntries: applyLedgerEntriesMock,
  fetchRewardBalances: fetchRewardBalancesMock,
  careUpkeepPoints: () => 1,
  roundPoints: (value: number) => Math.round(value * 1e6) / 1e6,
}))

const maybeGrantCareDropMock = vi.fn(async () => ({
  dropAccNext: 0,
  slot: 'weapon',
  probability: 0.2,
  roll: 0.1,
  item: null,
  previous: null,
  upgraded: false,
  loadout: null,
  awarded: false,
  rngPassed: false,
  fallbackType: null,
}))
vi.mock('@/src/server/gameplay/careDrops', () => ({
  maybeGrantCareDrop: maybeGrantCareDropMock,
  careDropProbability: () => 0,
}))

const recordGearDropMock = vi.fn(async () => undefined)
const recordBattleLootMock = vi.fn(async () => undefined)
const getGearInventoryForAddressMock = vi.fn(async () => ({
  equipped: { weapon: null, shield: null },
  stash: [],
  stashCount: 0,
}))
vi.mock('@/src/server/gameplay/gearService', () => ({
  recordGearDrop: recordGearDropMock,
  recordBattleLoot: recordBattleLootMock,
  getGearInventoryForAddress: getGearInventoryForAddressMock,
}))

type FakeClientConfig = {
  careState?: any
  orderRowCount?: number
}

class FakeClient {
  readonly config: FakeClientConfig
  readonly queries: Array<{ sql: string; params: any[] }>
  updatedCareState: any

  constructor(config: FakeClientConfig = {}) {
    this.config = config
    this.queries = []
  }

  async query(sql: string, params: any[] = []) {
    this.queries.push({ sql, params })
    if (sql.includes('from public.bloblets') && sql.includes('select care_state')) {
      const careState = this.config.careState ?? {}
      return { rows: [{ care_state: careState }] }
    }
    if (sql.startsWith('update public.bloblets')) {
      this.updatedCareState = params[1]
      return { rowCount: 1 }
    }
    if (sql.startsWith('update public.orders')) {
      const rowCount = this.config.orderRowCount ?? 1
      return { rowCount }
    }
    throw new Error(`Unexpected query in fake client: ${sql}`)
  }
}

const rewardBalances = new Map<string, number>()

const originalFastForwardConfig = { ...gameplayConfig.care.fastForward }
const originalCooldownMs = gameplayConfig.care.cooldownMs
const originalCooldownMin = gameplayConfig.care.cooldownMin

beforeEach(() => {
  rewardBalances.clear()
  rewardBalances.set('0xabc', 100)
  rewardBalances.set('0xdef', 100)
  gameplayConfig.care.fastForward.enabled = true
  gameplayConfig.care.fastForward.burstSize = 3
  gameplayConfig.care.fastForward.burstsPerDay = 2
  gameplayConfig.care.cooldownMs = 15 * 60 * 1000
  gameplayConfig.care.cooldownMin = 15
  applyLedgerEntriesMock.mockClear()
  fetchRewardBalancesMock.mockImplementation(async (_client, addresses: string[]) => {
    const map = new Map<string, { currentBalance: number }>()
    for (const address of addresses) {
      const key = String(address || '').trim()
      map.set(key, { currentBalance: rewardBalances.get(key) ?? 0 })
    }
    return map
  })
  maybeGrantCareDropMock.mockReset()
  maybeGrantCareDropMock.mockImplementation(async () => ({
    dropAccNext: 0,
    slot: 'weapon',
    probability: 0.2,
    roll: 0.1,
    item: null,
    previous: null,
    upgraded: false,
    loadout: null,
    awarded: false,
    rngPassed: false,
    fallbackType: null,
  }))
  recordGearDropMock.mockClear()
  recordBattleLootMock.mockClear()
  getGearInventoryForAddressMock.mockClear()
  getGearInventoryForAddressMock.mockResolvedValue({
    equipped: { weapon: null, shield: null },
    stash: [],
    stashCount: 0,
  })
})

afterAll(() => {
  gameplayConfig.care.fastForward.enabled = originalFastForwardConfig.enabled
  gameplayConfig.care.fastForward.burstSize = originalFastForwardConfig.burstSize
  gameplayConfig.care.fastForward.burstsPerDay = originalFastForwardConfig.burstsPerDay
  gameplayConfig.care.cooldownMs = originalCooldownMs
  gameplayConfig.care.cooldownMin = originalCooldownMin
})

function futureIso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

describe('buildChargeStatus', () => {
  it('returns covered when boosters window active', () => {
    const now = new Date()
    const state: ChargeState = {
      lastChargedAt: now.toISOString(),
      cooldownEndsAt: futureIso(15 * 60 * 1000),
      boostersActiveUntil: futureIso(45 * 60 * 1000),
    }

    const status = buildChargeStatus(state, now)
    expect(status.state).toBe('covered')
    expect(status.boostersActiveUntil).toBe(state.boostersActiveUntil)
    expect(status.cooldownEndsAt).toBe(state.cooldownEndsAt)
    expect(status.overdue).toBe(false)
  })

  it('returns cooldown when boosters expired but cooldown active', () => {
    const now = new Date()
    const state: ChargeState = {
      lastChargedAt: futureIso(-30 * 60 * 1000),
      boostersActiveUntil: futureIso(-5 * 60 * 1000),
      cooldownEndsAt: futureIso(10 * 60 * 1000),
    }

    const status = buildChargeStatus(state, now)
    expect(status.state).toBe('cooldown')
    expect(status.boosterLevel).toBe(0)
    expect(status.overdue).toBe(false)
  })

  it('flags cooldown as overdue when grace window passes', () => {
    const now = new Date()
    const originalDelay = gameplayConfig.care.upkeepDelayMs
    gameplayConfig.care.upkeepDelayMs = 30 * 60 * 1000
    try {
      const state: ChargeState = {
        lastChargedAt: futureIso(-90 * 60 * 1000),
        boostersActiveUntil: futureIso(-60 * 60 * 1000),
        cooldownEndsAt: futureIso(-40 * 60 * 1000),
      }

      const status = buildChargeStatus(state, now)
      expect(status.state).toBe('ready')
      expect(status.overdue).toBe(true)
    } finally {
      gameplayConfig.care.upkeepDelayMs = originalDelay
    }
  })

  it('treats fast-forward debt as an active cooldown window', () => {
    const now = new Date()
    const debtUntil = futureIso(10 * 60 * 1000)
    const state: ChargeState = {
      lastChargedAt: null,
      cooldownEndsAt: null,
      boostersActiveUntil: null,
      fastForwardDebtUntil: debtUntil,
      dropAcc: 0,
    }

    const status = buildChargeStatus(state, now, {
      fastForward: { enabled: true, burstsPerDay: 2, isNewcomer: true },
    })
    expect(status.state).toBe('cooldown')
    expect(status.cooldownEndsAt).toBe(status.fastForwardDebtUntil)
    expect(status.fastForwardEligible).toBe(false)
  })

})

describe('computeNextChargeState', () => {
  it('produces a future cooldown and booster window', () => {
    const now = new Date()
    const state = computeNextChargeState(now)

    expect(Date.parse(state.lastChargedAt ?? '')).toBeLessThanOrEqual(now.getTime())
    expect(Date.parse(state.cooldownEndsAt ?? '')).toBeGreaterThan(now.getTime())
    expect(Date.parse(state.boostersActiveUntil ?? '')).toBeGreaterThan(now.getTime())
  })
})

let performCharge: typeof import('@/src/server/gameplay/careService')['__careServiceTestables']['performCharge']
let performFastForward: typeof import('@/src/server/gameplay/careService')['__careServiceTestables']['performFastForward']

beforeAll(async () => {
  const careModule = await import('@/src/server/gameplay/careService')
  performCharge = careModule.__careServiceTestables.performCharge
  performFastForward = careModule.__careServiceTestables.performFastForward
})

describe('performCharge', () => {
  it('consumes a confirmed order and records ledger metadata', async () => {
    const now = new Date()
    const client = new FakeClient({ careState: {}, orderRowCount: 1 })

    const result = await performCharge({
      client: client as any,
      addressCanonical: '0xabc',
      chainKind: 'sol',
      now,
      chargeCost: 5,
      skipDebit: false,
      order: { id: 42, quoteAmount: 5, txHash: '0xhash' },
    })

    expect(result.consumedOrder).toEqual({ id: 42, txHash: '0xhash' })
    expect(result.chargeCost).toBe(5)
    expect(applyLedgerEntriesMock).toHaveBeenCalledTimes(1)
    const ledgerCall = applyLedgerEntriesMock.mock.calls[0]
    expect(ledgerCall).toBeDefined()
    const ledgerEntries = (ledgerCall?.[1] ?? []) as Array<Record<string, any>>
    const creditEntry = ledgerEntries.find((entry) => entry.reason === 'swap_credit')
    expect(creditEntry).toMatchObject({
      delta: 5,
      metadata: expect.objectContaining({ orderId: 42, txHash: '0xhash' }),
    })
    const debitEntry = ledgerEntries.find((entry) => entry.reason === 'care_debit')
    expect(debitEntry).toMatchObject({
      delta: -5,
      reason: 'care_debit',
      metadata: { orderId: 42, txHash: '0xhash' },
    })
    expect(ledgerEntries.find((entry) => entry.reason === 'care_upkeep')).toMatchObject({
      reason: 'care_upkeep',
      delta: 1,
    })
    expect(client.queries.some((q) => q.sql.startsWith('update public.orders'))).toBe(true)
  })

  it('handles prepaid balances when no confirmed order exists', async () => {
    const now = new Date()
    rewardBalances.set('0xabc', 12)
    const client = new FakeClient({ careState: {}, orderRowCount: 0 })

    const result = await performCharge({
      client: client as any,
      addressCanonical: '0xabc',
      chainKind: 'sol',
      now,
      chargeCost: 4,
      skipDebit: false,
      order: null,
    })

    expect(result.consumedOrder).toBeNull()
    const ledgerCall = applyLedgerEntriesMock.mock.calls[0]
    expect(ledgerCall).toBeDefined()
    const ledgerEntries = (ledgerCall?.[1] ?? []) as Array<Record<string, any>>
    const debitEntry = ledgerEntries.find((entry) => entry.reason === 'care_debit')
    expect(debitEntry).toMatchObject({
      delta: -4,
      metadata: undefined,
    })
    expect(client.queries.some((q) => q.sql.startsWith('update public.orders'))).toBe(false)
  })

  it('rejects when balance is insufficient for prepaid charge', async () => {
    const now = new Date()
    rewardBalances.set('0xabc', 2)
    const client = new FakeClient({ careState: {} })

    await expect(
      performCharge({
        client: client as any,
        addressCanonical: '0xabc',
        chainKind: 'sol',
        now,
        chargeCost: 5,
        skipDebit: false,
        order: null,
      }),
    ).rejects.toMatchObject({ message: 'payment_required', status: 403 })
    expect(applyLedgerEntriesMock).not.toHaveBeenCalled()
  })

  it('rejects when cooldown is still active', async () => {
    const now = new Date()
    const future = new Date(now.getTime() + 10 * 60 * 1000).toISOString()
    const client = new FakeClient({ careState: { cooldownEndsAt: future } })

    await expect(
      performCharge({
        client: client as any,
        addressCanonical: '0xabc',
        chainKind: 'sol',
        now,
        chargeCost: 5,
        skipDebit: false,
        order: null,
      }),
    ).rejects.toMatchObject({ message: 'charge_cooldown', status: 400 })
  })
})

describe('performFastForward', () => {
  it('runs a burst until a drop hits and records debt + counters', async () => {
    const now = new Date('2025-11-28T00:00:00Z')
    const client = new FakeClient({ careState: {} })
    const drop = {
      id: 7,
      slug: 'starter-sword',
      type: 'weapon',
      name: 'Sword',
      rarity: 'common',
      op: 1,
      dp: 0,
    }
    maybeGrantCareDropMock
      .mockImplementationOnce(async () => ({
        dropAccNext: 0.25,
        slot: 'weapon',
        probability: 0.2,
        roll: 0.05,
        item: null,
        previous: null,
        upgraded: false,
        loadout: null,
        awarded: false,
        rngPassed: true,
        fallbackType: null,
      }))
      .mockImplementationOnce(async () => ({
        dropAccNext: 0,
        slot: 'weapon',
        probability: 0.2,
        roll: 0.01,
        item: drop as any,
        previous: null,
        upgraded: true,
        loadout: { weapon_item_id: drop.id, shield_item_id: null },
        awarded: true,
        rngPassed: true,
        fallbackType: null,
      }))

    const result = await performFastForward({
      client: client as any,
      addressCanonical: '0xabc',
      chainKind: 'sol',
      now,
      chargeCost: 5,
      maxAttempts: 3,
      order: null,
    })

    expect(result.attemptsUsed).toBe(2)
    expect(result.stopReason).toBe('drop_hit')
    expect(result.totalChargeCost).toBeCloseTo(10)
    expect(result.burstsRemaining).toBe(gameplayConfig.care.fastForward.burstsPerDay - 1)
    expect(recordGearDropMock).toHaveBeenCalledTimes(1)
    const ledgerEntries = applyLedgerEntriesMock.mock.calls[0]?.[1] as Array<Record<string, any>>
    expect(ledgerEntries.filter((entry) => entry.reason === 'care_debit')).toHaveLength(result.attemptsUsed)

    const savedState = JSON.parse((client as any).updatedCareState)
    expect(savedState.fastForwardBurstsUsed).toBe(1)
    expect(savedState.fastForwardBurstDay).toBe(now.toISOString().slice(0, 10))
    expect(savedState.fastForwardDebtUntil).toBeTruthy()
    expect(Date.parse(savedState.fastForwardDebtUntil)).toBeGreaterThan(now.getTime())
    expect(savedState.cooldownEndsAt).toBe(savedState.fastForwardDebtUntil)
  })

  it('requires enough balance to cover the planned burst attempts', async () => {
    rewardBalances.set('0xabc', 4)
    const now = new Date()
    const client = new FakeClient({ careState: {} })

    await expect(
      performFastForward({
        client: client as any,
        addressCanonical: '0xabc',
        chainKind: 'sol',
        now,
        chargeCost: 5,
        maxAttempts: 3,
        order: null,
      }),
    ).rejects.toMatchObject({
      message: 'payment_required',
      status: 403,
      details: expect.objectContaining({ required: 15, balance: 4 }),
    })
    expect(maybeGrantCareDropMock).not.toHaveBeenCalled()
  })
})
