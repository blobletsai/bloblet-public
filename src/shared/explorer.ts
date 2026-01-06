export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet'

export function getActiveChainKind(): 'sol' {
  return 'sol'
}

export function getSolanaCluster(): SolanaCluster {
  const raw = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || '').trim().toLowerCase()
  if (raw === 'devnet') return 'devnet'
  if (raw === 'testnet') return 'testnet'
  return 'mainnet-beta'
}

function solscanBase(): string {
  return 'https://solscan.io'
}

export function solscanTxUrl(signature: string): string {
  const base = solscanBase()
  const cluster = getSolanaCluster()
  const core = `${base}/tx/${encodeURIComponent(signature)}`
  return cluster === 'mainnet-beta' ? core : `${core}?cluster=${cluster}`
}

export function solscanAddressUrl(address: string): string {
  const base = solscanBase()
  const cluster = getSolanaCluster()
  const core = `${base}/address/${encodeURIComponent(address)}`
  return cluster === 'mainnet-beta' ? core : `${core}?cluster=${cluster}`
}

export function explorerTxUrl(value: string | null | undefined): string | null {
  if (!value) return null
  return solscanTxUrl(value)
}

export function explorerAddressUrl(value: string | null | undefined): string | null {
  if (!value) return null
  return solscanAddressUrl(value)
}
