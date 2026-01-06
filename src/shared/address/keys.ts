import { sanitizeSolanaAddress, toCanonicalSolanaAddress } from './solana'

const SOL_MATCH = new Set(['sol', 'solana', 'mainnet-beta'])

function normalizeKind(raw?: string | null): 'sol' | null {
  if (!raw) return null
  const value = String(raw).trim().toLowerCase()
  if (!value) return null
  if (SOL_MATCH.has(value)) return 'sol'
  return null
}

function resolveKind(input?: string | null): 'sol' {
  return normalizeKind(input) || normalizeKind(process.env.NEXT_PUBLIC_CHAIN_KIND) || normalizeKind(process.env.CHAIN_KIND) || 'sol'
}

export type AddressKeyResult = {
  chainKind: 'sol'
  canonical: string
  lookup: string
}

export function deriveAddressKeys(address: string, options?: { chainKind?: string | null }): AddressKeyResult {
  const chainKind = resolveKind(options?.chainKind)
  const raw = String(address || '').trim()
  if (!raw) {
    return { chainKind, canonical: '', lookup: '' }
  }

  try {
    const canonical = toCanonicalSolanaAddress(raw)
    return { chainKind: 'sol', canonical, lookup: canonical }
  } catch {
    const fallback = sanitizeSolanaAddress(raw)
    return { chainKind: 'sol', canonical: fallback, lookup: fallback }
  }
}

export function deriveAddressLookup(address: string, options?: { chainKind?: string | null }): string {
  return deriveAddressKeys(address, options).lookup
}

export function resolveAddressCanonical(address: string, options?: { chainKind?: string | null }): string {
  return deriveAddressKeys(address, options).canonical
}
