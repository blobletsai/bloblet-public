import { PublicKey } from '@solana/web3.js'

export const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export type SolanaAddressContext = {
  input: string
  canonical: string
  lower: string
  publicKey: PublicKey
}

export function sanitizeSolanaAddress(address: string): string {
  return String(address || '').trim()
}

export function isValidSolanaAddress(address: string): boolean {
  const trimmed = sanitizeSolanaAddress(address)
  if (!trimmed || !SOLANA_ADDRESS_REGEX.test(trimmed)) return false
  try {
    new PublicKey(trimmed)
    return true
  } catch {
    return false
  }
}

export function getSolanaAddressContext(address: string): SolanaAddressContext {
  const input = sanitizeSolanaAddress(address)
  if (!isValidSolanaAddress(input)) {
    throw new Error('Invalid Solana address')
  }
  const publicKey = new PublicKey(input)
  const canonical = publicKey.toBase58()
  const lower = canonical
  return { input, canonical, lower, publicKey }
}

export function toCanonicalSolanaAddress(address: string): string {
  return getSolanaAddressContext(address).canonical
}

// Deprecated helpers (previously provided fallback resolution + lowercased records)
// have been removed now that canonical addresses are the only supported format.
