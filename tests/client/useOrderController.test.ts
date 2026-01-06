import { describe, expect, it } from 'vitest'

import {
  deriveOrderPhase,
  isOrderLocked,
  canCancelOrder,
  mergeHistoryEntries,
} from '@/src/client/hooks/orders/orderControllerCore'
import {
  INITIAL_STATE,
  HISTORY_LIMIT,
  type OrderState,
} from '@/src/client/hooks/orders/orderTypes'

function buildState(patch: Partial<OrderState>): OrderState {
  return {
    ...INITIAL_STATE,
    ...patch,
  }
}

describe('useOrderController helpers', () => {
  describe('deriveOrderPhase', () => {
    it('returns applied phase when status is applied', () => {
      const state = buildState({ status: 'applied', signature: null })
      expect(deriveOrderPhase(state, false, false)).toBe('applied')
    })

    it('treats reward top-up orders as applying when generated', () => {
      const state = buildState({ status: 'generated', type: 'reward_topup' })
      expect(deriveOrderPhase(state, false, false)).toBe('applying')
    })

    it('prefers confirming phase when transfer is in-flight', () => {
      const state = buildState({ status: 'pending', signature: null })
      expect(deriveOrderPhase(state, true, false)).toBe('confirming_payment')
    })
  })

  describe('isOrderLocked', () => {
    it('returns false when there is no active order', () => {
      expect(isOrderLocked(buildState({ orderId: null }))).toBe(false)
    })

    it('returns false for terminal statuses', () => {
      expect(
        isOrderLocked(buildState({ orderId: 42, status: 'applied' })),
      ).toBe(false)
    })

    it('returns true when the order is still in progress', () => {
      expect(
        isOrderLocked(buildState({ orderId: 42, status: 'pending' })),
      ).toBe(true)
    })
  })

  describe('canCancelOrder', () => {
    it('prevents cancellation when order is terminal', () => {
      expect(
        canCancelOrder(buildState({ orderId: 10, status: 'applied' })),
      ).toBe(false)
    })

    it('allows cancellation for in-flight orders', () => {
      expect(
        canCancelOrder(buildState({ orderId: 10, status: 'generating' })),
      ).toBe(true)
    })
  })

  describe('mergeHistoryEntries', () => {
    it('returns original history when orderId is invalid', () => {
      const initial = [{ id: 10, status: 'pending', type: null, quote: null, signature: null, reason: null, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }] as any
      const result = mergeHistoryEntries(initial, null, { status: 'applied' })
      expect(result).toBe(initial)
    })

    it('appends a new history entry when missing', () => {
      const result = mergeHistoryEntries([], 99, {
        status: 'pending',
        type: 'reward_topup',
        quote: 250,
      })
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe(99)
      expect(result[0]?.status).toBe('pending')
      expect(result[0]?.type).toBe('reward_topup')
      expect(result[0]?.quote).toBe(250)
    })

    it('updates existing history entry fields', () => {
      const initial = mergeHistoryEntries([], 77, { status: 'pending' })
      const updated = mergeHistoryEntries(initial, 77, {
        status: 'applied',
        reason: 'ok',
      })
      expect(updated).toHaveLength(1)
      expect(updated[0]?.status).toBe('applied')
      expect(updated[0]?.reason).toBe('ok')
    })

    it('trims history to the defined limit', () => {
      let history: any[] = []
      for (let id = 1; id <= HISTORY_LIMIT + 5; id += 1) {
        history = mergeHistoryEntries(history, id, { status: 'pending' })
      }
      expect(history).toHaveLength(HISTORY_LIMIT)
      expect(history[0]?.id).toBe(HISTORY_LIMIT + 5)
    })
  })
})
