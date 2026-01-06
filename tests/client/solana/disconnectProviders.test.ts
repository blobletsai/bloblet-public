import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  disconnectSolanaProviders,
  disconnectWalletProvider,
  type SolanaWindowProvider,
} from '@/src/client/solana/disconnectProviders'

const logger = vi.fn()

function makeProvider(overrides: Partial<SolanaWindowProvider> = {}): SolanaWindowProvider {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('disconnect providers helper', () => {
  beforeEach(() => {
    logger.mockReset()
  })

  it('forces provider disconnect and disables autoConnect when possible', async () => {
    const provider = makeProvider({ autoConnect: true })
    await disconnectWalletProvider('phantom', provider, logger)
    expect(provider.disconnect).toHaveBeenCalledTimes(1)
    expect(provider.disconnect).toHaveBeenCalledWith({ force: true })
    expect(logger).toHaveBeenCalledWith('wallet.provider.autoconnect.disabled', { provider: 'phantom' })
    expect(logger).toHaveBeenCalledWith('wallet.provider.disconnect', expect.objectContaining({ provider: 'phantom', forced: true }))
    expect(provider.autoConnect).toBe(false)
  })

  it('falls back to plain disconnect when force throws', async () => {
    const disconnect = vi.fn()
    disconnect.mockRejectedValueOnce(new Error('force rejected'))
    disconnect.mockResolvedValueOnce(undefined)
    const provider = makeProvider({ disconnect })
    await disconnectWalletProvider('solflare', provider, logger)
    expect(disconnect).toHaveBeenNthCalledWith(1, { force: true })
    expect(disconnect).toHaveBeenNthCalledWith(2)
    expect(logger).toHaveBeenCalledWith('wallet.provider.disconnect.error', expect.objectContaining({ provider: 'solflare', forced: true }))
    expect(logger).toHaveBeenCalledWith('wallet.provider.disconnect', expect.objectContaining({ provider: 'solflare', forced: false }))
  })

  it('logs skipped when provider unavailable', async () => {
    await disconnectWalletProvider('phantom', null, logger)
    expect(logger).toHaveBeenCalledWith('wallet.provider.disconnect.skipped', expect.objectContaining({ provider: 'phantom' }))
  })

  it('disconnects providers using the supplied priority order', async () => {
    const phantomDisconnect = vi.fn().mockResolvedValue(undefined)
    const solflareDisconnect = vi.fn().mockResolvedValue(undefined)
    const providerMap = {
      phantom: makeProvider({ disconnect: phantomDisconnect }),
      solflare: makeProvider({ disconnect: solflareDisconnect }),
    }
    await disconnectSolanaProviders({ providers: providerMap, priority: ['solflare'], logger })
    expect(solflareDisconnect.mock.invocationCallOrder[0]).toBeLessThan(phantomDisconnect.mock.invocationCallOrder[0])
    expect(logger).toHaveBeenCalledWith('wallet.provider.disconnect', expect.objectContaining({ provider: 'solflare' }))
    expect(logger).toHaveBeenCalledWith('wallet.provider.disconnect', expect.objectContaining({ provider: 'phantom' }))
  })
})
