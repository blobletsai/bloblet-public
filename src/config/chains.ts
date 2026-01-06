type ChainKind = 'sol'

function normalizeChainKind(raw: string | null | undefined): ChainKind | null {
  if (!raw) return null
  const value = String(raw).trim().toLowerCase()
  if (!value) return null
  if (value === 'sol' || value === 'solana' || value === 'mainnet-beta') return 'sol'
  return null
}

let gateCacheTtlOverride: number | null = null

function parseCacheTtlMs(): number {
  if (gateCacheTtlOverride != null) {
    return Math.max(0, Math.floor(gateCacheTtlOverride))
  }
  const fromMs = Number(process.env.GATE_BALANCE_CACHE_TTL_MS)
  if (Number.isFinite(fromMs) && fromMs > 0) return Math.floor(fromMs)
  const fromSeconds = Number(process.env.GATE_BALANCE_CACHE_TTL_SECONDS)
  if (Number.isFinite(fromSeconds) && fromSeconds > 0) {
    return Math.floor(fromSeconds * 1000)
  }
  return 60 * 60 * 1000
}

export const chainConfig = {
  defaultKind: normalizeChainKind(process.env.CHAIN_KIND) ?? 'sol',
  gate: {
    get cacheTtlMs() {
      return parseCacheTtlMs()
    },
  },
}

export type ChainConfig = typeof chainConfig
export { normalizeChainKind }

export function __setGateCacheTtlMsForTests(value: number | null) {
  gateCacheTtlOverride = value == null ? null : Math.max(0, Math.floor(value))
}
