import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../../../pages/api/pvp/challenge'
import { getSessionFromRequest } from '@/src/server/auth'
import { runBattle } from '@/src/server/gameplay/battleService'
import { rateLimiter } from '@/src/server/rateLimit'
import type { PvpItem } from '@/types'

vi.mock('@/src/server/auth', () => ({
  getSessionFromRequest: vi.fn(),
}))

vi.mock('@/src/server/rateLimit', () => ({
  rateLimiter: {
    limit: vi.fn(),
  },
}))

vi.mock('@/src/server/gameplay/battleService', async () => {
  const actual = await vi.importActual<typeof import('@/src/server/gameplay/battleService')>(
    '@/src/server/gameplay/battleService',
  )
  return {
    ...actual,
    runBattle: vi.fn(),
  }
})

const ATTACKER = 'DMGPDaz9V9UMcStxpMWAeDDX71uPxipmW2krp4U1ofBa'
const DEFENDER = 'FJ5Pqvu8qr8sWYF1c4B6jwxKF1uHmVGuTZGi99ZTSsNe'

const weapon: PvpItem = {
  id: 11,
  slug: 'starter_sword',
  type: 'weapon',
  name: 'Starter Sword',
  rarity: 'common',
  op: 12,
  dp: 0,
  icon_url: null,
}

const shield: PvpItem = {
  id: 22,
  slug: 'bulwark',
  type: 'shield',
  name: 'Bulwark',
  rarity: 'rare',
  op: 0,
  dp: 14,
  icon_url: null,
}

function createRes() {
  const res: any = {
    statusCode: 0,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.body = payload
      return this
    },
  }
  return res
}

describe('POST /api/pvp/challenge', () => {
  beforeEach(() => {
    vi.mocked(getSessionFromRequest).mockReturnValue({ address: ATTACKER } as any)
    vi.mocked(rateLimiter.limit).mockResolvedValue({ success: true } as any)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('returns attacker loadout while masking defender data', async () => {
    vi.mocked(runBattle).mockResolvedValue({
      winner: 'attacker',
      critical: false,
      effects: [],
      loot: [
        {
          slot: 'weapon',
          item_id: weapon.id,
          item_slug: weapon.slug,
          from: DEFENDER,
          to: ATTACKER,
          equipped: true,
        },
      ],
      transfer: { transfer: 10, house: 1, winnerGain: 9 },
      cooldownUntil: '2024-01-01T00:00:00.000Z',
      battleId: 42,
      attacker: {
        address: ATTACKER,
        booster: 1,
        base: 12,
        roll: 15,
        pointsBefore: 100,
        pointsAfter: 109,
      },
      attackerLoadout: {
        weapon,
        shield: null,
      },
      defender: {
        address: DEFENDER,
        booster: 0,
        base: 8,
        roll: 9,
        pointsBefore: 200,
        pointsAfter: 191,
      },
      defenderLoadout: {
        weapon: null,
        shield,
      },
    })

    const req = {
      method: 'POST',
      body: { targetAddress: DEFENDER },
      headers: {},
    } as any
    const res = createRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.ok).toBe(true)

    const response = res.body?.result
    expect(response.attacker.weapon).toEqual(weapon)
    expect(response.attacker.shield).toBeNull()
    expect(response.opponent.address).toBe(DEFENDER)
    expect(response.opponent.maskedId).not.toBe(DEFENDER)
    expect(response.defender).toBeUndefined()
    expect(response.loot[0].to).toBe('me')
  })
})
