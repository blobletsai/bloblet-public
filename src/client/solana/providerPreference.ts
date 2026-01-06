const STORAGE_KEY = 'bloblets:sol-wallet'

export type SolWalletKind = 'phantom' | 'solflare'

function isKind(value: any): value is SolWalletKind {
  return value === 'phantom' || value === 'solflare'
}

export function setPreferredSolWallet(kind: SolWalletKind) {
  if (typeof window === 'undefined') return
  try { window.localStorage?.setItem(STORAGE_KEY, kind) } catch {}
  try { (window as any).__blobletsSolWallet = kind } catch {}
}

export function clearPreferredSolWallet() {
  if (typeof window === 'undefined') return
  try { window.localStorage?.removeItem(STORAGE_KEY) } catch {}
  try { delete (window as any).__blobletsSolWallet } catch {}
}

export function getPreferredSolWallet(): SolWalletKind | null {
  if (typeof window === 'undefined') return null
  const w: any = window
  const inMemory = w.__blobletsSolWallet
  if (isKind(inMemory)) return inMemory
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY) || null
    if (isKind(stored)) {
      w.__blobletsSolWallet = stored
      return stored
    }
  } catch {}
  if (w.solflare?.isConnected) return 'solflare'
  if (w.solana?.isConnected && (w.solana.isPhantom || w.solana.isSol)) return 'phantom'
  if (w.solflare) return 'solflare'
  if (w.solana && (w.solana.isPhantom || w.solana.isSol)) return 'phantom'
  return null
}
