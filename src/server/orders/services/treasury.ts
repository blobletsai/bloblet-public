import type { ChainAdapter } from '@/src/server/chains/types'
import { solanaTokenDecimals } from '@/src/shared/points'
import type { ConfirmOrderResult, OrderLogContext } from '@/src/server/orders/types'
import { solanaConfig } from '@/src/config/solana'

export interface TreasuryContext {
  tokenAddress: string
  recipients: string[]
  memoFragment: string | null
  decimals: number
}

interface ResolveTreasuryArgs {
  chainKind: string
  chain: ChainAdapter
  log: OrderLogContext
}

export function resolveTreasuryContext(args: ResolveTreasuryArgs): TreasuryContext | ConfirmOrderResult {
  const { chainKind, chain, log } = args
  const decimals = chain.metadata.tokenDecimals || solanaTokenDecimals()
  const tokenAddressRaw = (chain.metadata.tokenAddress || solanaConfig.token.mint || '').trim()

  if (!tokenAddressRaw) {
    console.error('[orders.confirm] missing token address', log)
    return { statusCode: 500, body: { error: 'missing token address' } }
  }

  const treasuryRaw = (solanaConfig.treasury.publicKey || '').trim()
  if (!treasuryRaw) {
    console.error('[orders.confirm] treasury public key missing', log)
    return { statusCode: 500, body: { error: 'missing treasury address' } }
  }

  let treasuryAddress: string
  try {
    treasuryAddress = chain.normalizeAddress(treasuryRaw)
    if (!chain.isValidAddress(treasuryAddress)) throw new Error('invalid')
  } catch {
    console.error('[orders.confirm] invalid treasury address', { ...log, treasuryRaw })
    return { statusCode: 500, body: { error: 'invalid treasury address' } }
  }

  let tokenAddrNormalized: string
  try {
    tokenAddrNormalized = chain.normalizeAddress(tokenAddressRaw)
  } catch {
    console.error('[orders.confirm] invalid token mint', { ...log, tokenAddressRaw })
    return { statusCode: 500, body: { error: 'invalid token address' } }
  }

  return {
    tokenAddress: tokenAddrNormalized,
    recipients: [treasuryAddress],
    memoFragment: null,
    decimals,
  }
}
