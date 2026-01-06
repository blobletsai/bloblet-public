import { describe, expect, it, vi } from 'vitest'

import handler from '../../../../pages/api/pvp/challenge'

vi.mock('@/src/server/auth', () => ({
  getSessionFromRequest: () => ({ address: 'owner' }),
}))

vi.mock('@/src/server/rateLimit', () => ({
  rateLimiter: { limit: vi.fn().mockResolvedValue({ success: true }) },
}))

vi.mock('@/src/shared/address/solana', () => ({
  getSolanaAddressContext: (addr: string) => ({ canonical: addr }),
}))

vi.mock('@/src/server/gameplay/battleService', () => ({
  runBattle: vi.fn().mockResolvedValue({
    winner: 'attacker',
    critical: false,
    effects: [],
    loot: [],
    transfer: { transfer: 10, house: 2, winnerGain: 12 },
    cooldownUntil: 'now',
    battleId: 42,
    attacker: {
      address: 'owner',
      pointsBefore: 100,
      pointsAfter: 112,
      booster: 1,
      base: 3,
      roll: 9,
    },
    defender: {
      address: 'defender',
      pointsBefore: 120,
      pointsAfter: 110,
      booster: 2,
      base: 4,
      roll: 7,
    },
    attackerLoadout: {
      weapon: {
        id: 1,
        slug: 'blade',
        type: 'weapon',
        name: 'Blade',
        rarity: 'common',
        op: 5,
        dp: 0,
        icon_url: null,
      },
      shield: {
        id: 2,
        slug: 'buckler',
        type: 'shield',
        name: 'Buckler',
        rarity: 'common',
        op: 0,
        dp: 3,
        icon_url: null,
      },
    },
    defenderLoadout: {
      weapon: {
        id: 3,
        slug: 'hidden-blade',
        type: 'weapon',
        name: 'Hidden Blade',
        rarity: 'rare',
        op: 9,
        dp: 0,
        icon_url: null,
      },
      shield: null,
    },
  }),
  BattleError: class MockBattleError extends Error {},
  buildMaskedOpponent: (addr: string) => ({ maskedId: `***${addr.slice(-3)}`, displayHint: 'masked' }),
}))

function createResponse() {
  const res: any = {
    statusCode: 200,
    jsonPayload: null as any,
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
      this.headers[key] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.jsonPayload = payload
      return this
    },
  }
  return res
}

describe('/api/pvp/challenge', () => {
  it('exposes only attacker loadout and masks defender data', async () => {
    const req: any = {
      method: 'POST',
      headers: {},
      body: { defender: 'defender' },
    }
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const result = res.jsonPayload?.result
    expect(result.attacker.weapon?.id).toBe(1)
    expect(result.attacker.shield?.id).toBe(2)
    expect(result.defender).toBeUndefined()
    expect(result.opponent.maskedId).toContain('***')
  })
})
