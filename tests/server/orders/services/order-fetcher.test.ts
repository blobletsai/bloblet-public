import { describe, expect, it, vi } from 'vitest'

import { loadPendingOrder } from '@/src/server/orders/services/order-fetcher'

type LoadOrderPromise = ReturnType<typeof loadPendingOrder>

function expectResponse(result: Awaited<LoadOrderPromise>) {
  if (result.kind !== 'response') {
    throw new Error('Expected response result')
  }
  return result.response
}

function expectSuccess(result: Awaited<LoadOrderPromise>) {
  if (result.kind !== 'success') {
    throw new Error('Expected success result')
  }
  return result.value
}

type MaybeSingleResult = { data: any; error: any }

function createSupabaseMock(results: MaybeSingleResult[], updateSpies: Array<{ calls: any[] } | undefined> = []) {
  let callIndex = 0

  return {
    from: vi.fn(() => {
      const result = results[callIndex] ?? { data: null, error: null }
      const updateSpy = updateSpies[callIndex]
      callIndex += 1

      const builder: any = {
        select: vi.fn(() => builder),
        update: vi.fn((payload: any) => {
          if (updateSpy) {
            updateSpy.calls.push(payload)
          }
          return builder
        }),
        eq: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => result),
      }

      return builder
    }),
  }
}

const SOLANA_ORDER_ADDRESS = '11111111111111111111111111111111'

describe('loadPendingOrder', () => {
const baseOrder = {
  id: 7,
  address: SOLANA_ORDER_ADDRESS,
  address_canonical: SOLANA_ORDER_ADDRESS,
  address_cased: SOLANA_ORDER_ADDRESS,
    chain_kind: 'sol',
    type: 'care',
    status: 'pending',
    quote_amount: 5,
    expires_at: null,
    confirmed_at: null,
    applied_at: null,
    tx_hash: null,
  }

  it('returns loaded order details when pending order is found', async () => {
    const supa = createSupabaseMock([{ data: baseOrder, error: null }])

    const result = await loadPendingOrder({
      supa: supa as any,
      chainKind: 'sol',
      orderId: 7,
      txHash: '0x123',
      internal: true,
    })

    const success = expectSuccess(result)
    expect(success).toEqual({
      order: baseOrder,
      addressRaw: baseOrder.address,
      addressCanonical: baseOrder.address_canonical,
      addressCased: baseOrder.address_cased,
    })
  })

  it('returns response when supabase lookup fails', async () => {
    const supa = createSupabaseMock([{ data: null, error: { message: 'boom' } }])

    const result = await loadPendingOrder({
      supa: supa as any,
      chainKind: 'sol',
      orderId: 7,
      txHash: '0x123',
      internal: true,
    })

    const response = expectResponse(result)
    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({ error: 'order lookup failed' })
  })

  it('returns not found when supabase has no matching order', async () => {
    const supa = createSupabaseMock([{ data: null, error: null }])

    const result = await loadPendingOrder({
      supa: supa as any,
      chainKind: 'sol',
      orderId: 7,
      txHash: '0x123',
      internal: true,
    })

    const response = expectResponse(result)
    expect(response.statusCode).toBe(404)
  })

  it('rejects when session address does not match order address', async () => {
    const supa = createSupabaseMock([{ data: baseOrder, error: null }])

    const result = await loadPendingOrder({
      supa: supa as any,
      chainKind: 'sol',
      orderId: 7,
      txHash: '0x123',
      sessionAddressKey: '0xdeadbeef',
      internal: false,
    })

    const response = expectResponse(result)
    expect(response.statusCode).toBe(403)
    expect(response.body).toEqual({ error: 'address mismatch' })
  })

  it('marks expired orders and returns error response', async () => {
    const expiredOrder = {
      ...baseOrder,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    }
    const updateSpy = { calls: [] as any[] }
    const supa = createSupabaseMock(
      [{ data: expiredOrder, error: null }, { data: null, error: null }],
      [undefined, updateSpy],
    )

    const result = await loadPendingOrder({
      supa: supa as any,
      chainKind: 'sol',
      orderId: 7,
      txHash: '0x123',
      internal: true,
    })

    const response = expectResponse(result)
    expect(response.statusCode).toBe(400)
    expect(updateSpy.calls).toHaveLength(1)
    expect(updateSpy.calls[0]).toEqual({ status: 'expired', reason: 'order expired' })
  })

  it('short-circuits when order already processed', async () => {
    const processedOrder = { ...baseOrder, status: 'applied' }
    const supa = createSupabaseMock([{ data: processedOrder, error: null }])

    const result = await loadPendingOrder({
      supa: supa as any,
      chainKind: 'sol',
      orderId: 7,
      txHash: '0x123',
      internal: true,
    })

    const response = expectResponse(result)
    expect(response.statusCode).toBe(200)
    expect(response.body.status).toBe('applied')
    expect(response.body.order).toMatchObject({
      id: processedOrder.id,
      status: 'applied',
    })
  })
})
