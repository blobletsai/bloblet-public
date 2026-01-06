import { getSolanaAddressContext } from '@/src/shared/address/solana'

export function normalizeChainAddress(address: string | null | undefined, chainKind: string | null | undefined): string {
  const chain = String(chainKind || '').trim().toLowerCase()
  const raw = String(address || '').trim()
  if (!raw) return ''
  if (chain === 'sol' || chain === 'solana' || chain === 'mainnet-beta') {
    return getSolanaAddressContext(raw).canonical
  }
  return raw
}

export function tryNormalizeChainAddress(address: string | null | undefined, chainKind: string | null | undefined): string | null {
  try {
    return normalizeChainAddress(address, chainKind)
  } catch {
    return null
  }
}
