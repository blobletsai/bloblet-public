import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { solanaConfig } from '@/src/config/solana'
import { resolveTreasuryContext } from '@/src/server/orders/services/treasury'

const ORIGINAL_MINT = solanaConfig.token.mint
const ORIGINAL_TREASURY = solanaConfig.treasury.publicKey

describe('resolveTreasuryContext (Solana)', () => {
  beforeEach(() => {
    solanaConfig.token.mint = ''
    solanaConfig.treasury.publicKey = ''
  })

  afterEach(() => {
    solanaConfig.token.mint = ORIGINAL_MINT
    solanaConfig.treasury.publicKey = ORIGINAL_TREASURY
  })

  it('normalizes treasury + token addresses from env when metadata is missing', () => {
    solanaConfig.treasury.publicKey = 'SoLoNA1234567890'
    solanaConfig.token.mint = 'Mint1234567890'

    const chain = {
      metadata: {
        tokenDecimals: 6,
        tokenAddress: '',
      },
      normalizeAddress: (value: string) => value.toLowerCase(),
      isValidAddress: () => true,
    }

    const context = resolveTreasuryContext({
      chainKind: 'sol',
      chain: chain as any,
      log: {
        chainKind: 'sol',
        internal: false,
        orderId: 42,
        txHash: 'abc',
        type: 'reward_topup',
      },
    })

    expect(context).toEqual({
      tokenAddress: 'mint1234567890',
      recipients: ['solona1234567890'],
      memoFragment: null,
      decimals: 6,
    })
  })

  it('returns error when treasury env is missing', () => {
    solanaConfig.treasury.publicKey = ''
    solanaConfig.token.mint = 'Mint123'

    const chain = {
      metadata: { tokenDecimals: 6, tokenAddress: 'Mint123' },
      normalizeAddress: (value: string) => value.toLowerCase(),
      isValidAddress: () => true,
    }

    const result = resolveTreasuryContext({
      chainKind: 'sol',
      chain: chain as any,
      log: { chainKind: 'sol', internal: false, orderId: 1, txHash: 'hash', type: 'care' },
    }) as any

    expect(result.statusCode).toBe(500)
    expect(result.body).toEqual({ error: 'missing treasury address' })
  })

  it('returns error when token mint cannot be normalized', () => {
    solanaConfig.treasury.publicKey = 'Treasury123'
    solanaConfig.token.mint = 'BadMint123'

    const chain = {
      metadata: { tokenDecimals: 9, tokenAddress: '' },
      normalizeAddress: vi.fn((value: string) => {
        if (value === solanaConfig.token.mint) {
          throw new Error('bad mint')
        }
        return value.toLowerCase()
      }),
      isValidAddress: () => true,
    }

    const result = resolveTreasuryContext({
      chainKind: 'sol',
      chain: chain as any,
      log: { chainKind: 'sol', internal: false, orderId: 2, txHash: 'hash', type: 'care' },
    }) as any

    expect(result.statusCode).toBe(500)
    expect(result.body).toEqual({ error: 'invalid token address' })
  })
})
