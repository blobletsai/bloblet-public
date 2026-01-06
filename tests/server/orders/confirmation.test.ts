import { describe, expect, it } from 'vitest'

import { __ordersConfirmationTestables } from '@/src/server/orders/confirmation'

describe('orders confirmation serialization', () => {
  const { serializeOrder } = __ordersConfirmationTestables

  it('serializes raw order rows with defaults', () => {
    const row = {
      id: 42,
      type: 'care',
      status: 'pending',
      quote_amount: '5',
      expires_at: '2025-10-28T00:00:00.000Z',
      confirmed_at: null,
      applied_at: null,
      tx_hash: null,
    }

    const serialized = serializeOrder(row)
    expect(serialized).toEqual({
      id: 42,
      type: 'care',
      status: 'pending',
      quoteAmount: 5,
      expiresAt: '2025-10-28T00:00:00.000Z',
      confirmedAt: null,
      appliedAt: null,
      txHash: null,
    })
  })

  it('applies overrides when provided', () => {
    const row = {
      id: 7,
      type: 'care',
      status: 'pending',
      quote_amount: '4',
      expires_at: null,
      confirmed_at: null,
      applied_at: null,
      tx_hash: null,
    }

    const serialized = serializeOrder(row, {
      status: 'confirmed',
      confirmedAt: '2025-10-27T18:00:00.000Z',
      txHash: '0xabc',
    })

    expect(serialized).toEqual({
      id: 7,
      type: 'care',
      status: 'confirmed',
      quoteAmount: 4,
      expiresAt: null,
      confirmedAt: '2025-10-27T18:00:00.000Z',
      appliedAt: null,
      txHash: '0xabc',
    })
  })

  it('returns null when no row provided', () => {
    expect(serializeOrder(null)).toBeNull()
  })
})
