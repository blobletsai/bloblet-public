import { chainConfig, normalizeChainKind } from '@/src/config/chains'
import type { ChainAdapter, ChainKind } from './types'
import { solanaAdapter } from './solana/adapter'

const registry: Partial<Record<ChainKind, ChainAdapter>> = {
  sol: solanaAdapter,
}

export function resolveChainKind(input?: string | null): ChainKind {
  const fromInput = normalizeChainKind(input)
  if (fromInput) return fromInput
  return chainConfig.defaultKind
}

export function registerChainAdapter(adapter: ChainAdapter) {
  registry[adapter.metadata.kind] = adapter
}

export function getRegisteredAdapters(): ChainAdapter[] {
  return Object.values(registry).filter(Boolean) as ChainAdapter[]
}

export function getChainAdapter(kind?: ChainKind): ChainAdapter {
  const resolvedKind = kind ?? resolveChainKind()
  const adapter = registry[resolvedKind]
  if (!adapter) {
    throw new Error(`Chain adapter for ${resolvedKind} is not registered`)
  }
  return adapter
}

export * from './types'
