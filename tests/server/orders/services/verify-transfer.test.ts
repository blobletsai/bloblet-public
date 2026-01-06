import { describe, expect, it, vi } from 'vitest'

import { verifyOrderTransfer } from '@/src/server/orders/services/verify-transfer'

const baseLog = {
  orderId: 1,
  txHash: '0xhash',
  chainKind: 'sol',
  type: 'reward_topup',
  internal: false,
}

const sampleOrder = {
  quote_amount: 5,
}

describe('verifyOrderTransfer', () => {
  it('skips on-chain validation when flag is true', async () => {
    const chain = {
      normalizeAddress: vi.fn(() => '0xsender'),
      isValidAddress: vi.fn(() => true),
      verifyTokenTransfer: vi.fn(),
    }

    const result = await verifyOrderTransfer({
      chain: chain as any,
      order: sampleOrder,
      addressRaw: '0xSender',
      tokenAddress: '0xToken',
      recipients: ['0xTreasury'],
      memoFragment: null,
      decimals: 18,
      skipOnchainValidation: true,
      log: baseLog,
    })

    expect(result).toEqual({ kind: 'ok' })
    expect(chain.verifyTokenTransfer).not.toHaveBeenCalled()
  })

  it('returns error when sender address fails normalization', async () => {
    const chain = {
      normalizeAddress: vi.fn(() => {
        throw new Error('bad')
      }),
      isValidAddress: vi.fn(() => true),
      verifyTokenTransfer: vi.fn(),
    }

    const result = await verifyOrderTransfer({
      chain: chain as any,
      order: sampleOrder,
      addressRaw: '0xSender',
      tokenAddress: '0xToken',
      recipients: ['0xTreasury'],
      memoFragment: null,
      decimals: 18,
      skipOnchainValidation: false,
      log: baseLog,
    })

    expect(result.kind).toBe('error')
    const response = (result as any).response
    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({ error: 'invalid sender address' })
  })

  it('propagates pending verification state', async () => {
    const chain = {
      normalizeAddress: vi.fn(() => '0xsender'),
      isValidAddress: vi.fn(() => true),
      verifyTokenTransfer: vi.fn(async () => ({
        status: 'pending',
        confirmations: 0,
      })),
    }

    const result = await verifyOrderTransfer({
      chain: chain as any,
      order: sampleOrder,
      addressRaw: '0xSender',
      tokenAddress: '0xToken',
      recipients: ['0xTreasury'],
      memoFragment: 'order:1',
      decimals: 18,
      skipOnchainValidation: false,
      log: baseLog,
    })

    expect(result.kind).toBe('pending')
    const response = (result as any).response
    expect(response.statusCode).toBe(200)
    expect(response.body.need).toBe(1)
    expect(chain.verifyTokenTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        memoFragment: 'order:1',
        minimumAmountRaw: 5n * 10n ** 18n,
      }),
    )
  })

  it('returns error when verification fails', async () => {
    const chain = {
      normalizeAddress: vi.fn(() => '0xsender'),
      isValidAddress: vi.fn(() => true),
      verifyTokenTransfer: vi.fn(async () => ({
        status: 'failed',
        reason: 'nope',
      })),
    }

    const result = await verifyOrderTransfer({
      chain: chain as any,
      order: sampleOrder,
      addressRaw: '0xSender',
      tokenAddress: '0xToken',
      recipients: ['0xTreasury'],
      memoFragment: null,
      decimals: 6,
      skipOnchainValidation: false,
      log: baseLog,
    })

    expect(result.kind).toBe('error')
    const response = (result as any).response
    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({ error: 'nope' })
  })

  it('returns ok when verification succeeds', async () => {
    const chain = {
      normalizeAddress: vi.fn(() => '0xsender'),
      isValidAddress: vi.fn(() => true),
      verifyTokenTransfer: vi.fn(async () => ({
        status: 'confirmed',
      })),
    }

    const result = await verifyOrderTransfer({
      chain: chain as any,
      order: sampleOrder,
      addressRaw: '0xSender',
      tokenAddress: '0xToken',
      recipients: ['0xTreasury'],
      memoFragment: null,
      decimals: 18,
      skipOnchainValidation: false,
      log: baseLog,
    })

    expect(result).toEqual({ kind: 'ok' })
  })
})
