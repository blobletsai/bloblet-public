import { describe, expect, it } from 'vitest'

import { buildFaucetRequestMetadata, resolveAtaPreparationState } from '@/src/server/sandbox/faucetService'

describe('resolveAtaPreparationState', () => {
  it('marks insufficient_sol when wallet cannot cover the ATA rent', () => {
    expect(resolveAtaPreparationState(1_000, 2_000)).toBe('insufficient_sol')
  })

  it('returns no_ata when the wallet can afford to prepare the account', () => {
    expect(resolveAtaPreparationState(2_000, 2_000)).toBe('no_ata')
    expect(resolveAtaPreparationState(5_000, 2_000)).toBe('no_ata')
  })
})

describe('buildFaucetRequestMetadata', () => {
  it('omits empty optional fields but always stamps receivedAt', () => {
    const meta = buildFaucetRequestMetadata(
      {
        userAgent: 'jest',
        country: '',
        clientContext: { locale: 'en-US' },
      },
      new Date('2025-11-15T00:00:00Z'),
    )
    expect(meta).toStrictEqual({
      receivedAt: '2025-11-15T00:00:00.000Z',
      userAgent: 'jest',
      clientContext: { locale: 'en-US' },
    })
  })
})
