import { beforeAll, describe, expect, it, vi } from 'vitest'

const withPgClientMock = vi.fn()
const getGearInventoryMock = vi.fn()
const getScoreMock = vi.fn()

vi.mock('@/src/server/pg', () => ({
  withPgClient: (...args: any[]) => withPgClientMock(...args),
}))

vi.mock('@/src/server/gameplay/gearService', () => ({
  getGearInventoryForAddress: (...args: any[]) => getGearInventoryMock(...args),
}))

vi.mock('@/src/server/gameplay/scoreService', () => ({
  getScoreForAddress: (...args: any[]) => getScoreMock(...args),
}))

let getPlayerStatus: typeof import('@/src/server/gameplay/playerStatusService').getPlayerStatus

beforeAll(async () => {
  const playerStatusModule = await import('@/src/server/gameplay/playerStatusService')
  getPlayerStatus = playerStatusModule.getPlayerStatus
})

describe('getPlayerStatus', () => {
  it('returns consolidated snapshot with care status and recent battle', async () => {
    const now = Date.now()
    const careState = {
      lastChargedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      cooldownEndsAt: new Date(now + 40 * 60 * 1000).toISOString(),
      boostersActiveUntil: new Date(now + 40 * 60 * 1000).toISOString(),
    }

    const playerAddress = '9xQeWvG816bUx9EPUMvW2sDbUoCLv7saP2Uq6T6kQ8xY'
    const opponentAddress = 'H3MM3P2s7RUTpuj949iFDUFxuDrGRq3NbS1RyCBj8TAb'
    const battleRow = {
      id: 77,
      attacker: 'Et5DHh3CX6X1cxZV8oPZxC25f6GcEGv7HxVd58LZj8Q8',
      defender: playerAddress,
      winner: 'attacker',
      critical: false,
      transfer_points: 10,
      house_points: 1,
      loot: [],
      created_at: new Date(now - 5 * 60 * 1000).toISOString(),
    }

    const client = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('from public.bloblets')) {
          return { rows: [{ care_state: careState }] }
        }
        if (queryText.includes('from public.pvp_battles')) {
          return { rows: [battleRow] }
        }
        return { rows: [] }
      }),
    }

    withPgClientMock.mockImplementationOnce(async (handler: any) => handler(client))

    getGearInventoryMock.mockResolvedValue({
      equipped: { weapon: { name: 'Blade', rarity: 'rare' }, shield: null },
      stash: [],
      stashCount: 0,
    })
    getScoreMock.mockResolvedValue({ balance: 150, balanceRaw: 150, rank: 5, tier: 'champion' })

    const status = await getPlayerStatus(playerAddress)

    expect(status.care).toMatchObject({
      state: expect.any(String),
      lastChargedAt: careState.lastChargedAt,
      cooldownEndsAt: careState.cooldownEndsAt,
      boostersActiveUntil: careState.boostersActiveUntil,
      boosterLevel: expect.any(Number),
      overdue: false,
    })
    expect(status.gear.equipped.weapon?.name).toBe('Blade')
    expect(status.score.tier).toBe('champion')
    expect(status.recentBattle?.battleId).toBe(77)
    expect(status.recentBattle?.role).toBeDefined()
    expect(status.recentBattle?.transfer).toBe(10)
  })
})
