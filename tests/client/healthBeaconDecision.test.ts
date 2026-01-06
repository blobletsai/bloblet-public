import { describe, expect, it } from 'vitest'

import {
  computeHealthBeaconDecision,
  MIN_HEALTH_BEACON_INTERVAL_MS,
} from '@/src/client/realtime/gameplay'
import type { GameplayState } from '@/src/client/realtime/gameplay/types'

function createSnapshot(overrides: Partial<GameplayState> = {}): GameplayState {
  return {
    connection: 'open',
    orders: new Map() as GameplayState['orders'],
    ordersByAddress: new Map() as GameplayState['ordersByAddress'],
    careByAddress: new Map() as GameplayState['careByAddress'],
    rewardsByAddress: new Map() as GameplayState['rewardsByAddress'],
    battles: new Map() as GameplayState['battles'],
    loadouts: new Map() as GameplayState['loadouts'],
    lastEvent: null,
    ...overrides,
  }
}

describe('computeHealthBeaconDecision', () => {
  it('returns no-op when listener count is zero', () => {
    const snapshot = createSnapshot()
    const result = computeHealthBeaconDecision(snapshot, 0, null, Date.now())
    expect(result.shouldSend).toBe(false)
    expect(result.nextRecord).toBeNull()
  })

  it('sends immediately when listeners are active', () => {
    const snapshot = createSnapshot()
    const now = Date.now()
    const result = computeHealthBeaconDecision(snapshot, 1, null, now)
    expect(result.shouldSend).toBe(true)
    expect(result.nextRecord).not.toBeNull()
    expect(result.nextRecord?.payload.listenerCount).toBe(1)
  })

  it('skips duplicate payloads within the minimum interval', () => {
    const snapshot = createSnapshot()
    const first = computeHealthBeaconDecision(snapshot, 2, null, 1_000)
    expect(first.shouldSend).toBe(true)
    const second = computeHealthBeaconDecision(snapshot, 2, first.nextRecord, 1_000 + MIN_HEALTH_BEACON_INTERVAL_MS - 100)
    expect(second.shouldSend).toBe(false)
    expect(second.nextRecord).toBe(first.nextRecord)
  })

  it('forces a beacon when the connection state changes', () => {
    const initial = createSnapshot({ connection: 'open' })
    const first = computeHealthBeaconDecision(initial, 1, null, 2_000)
    expect(first.shouldSend).toBe(true)

    const degraded = createSnapshot({ connection: 'retrying' })
    const second = computeHealthBeaconDecision(
      degraded,
      1,
      first.nextRecord,
      2_000 + MIN_HEALTH_BEACON_INTERVAL_MS - 200,
    )
    expect(second.shouldSend).toBe(true)
    expect(second.nextRecord?.payload.status).toBe('retrying')
  })
})
