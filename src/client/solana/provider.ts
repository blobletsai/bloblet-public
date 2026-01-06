"use client"

import { getPreferredSolWallet } from '@/src/client/solana/providerPreference'
import { solanaConfig } from '@/src/config/solana'

export function getSolRpcUrl(): string {
  return solanaConfig.rpcUrlPublic
}

export function getSolanaProvider(): any | null {
  if (typeof window === 'undefined') return null
  const w: any = window
  const phantomProvider = w.solana && (w.solana.isPhantom || w.solana.isSol) ? w.solana : null
  const solflareProvider = w.solflare || (w.solana?.isSolflare ? w.solana : null)
  const preferred = getPreferredSolWallet()
  if (preferred === 'solflare' && solflareProvider) return solflareProvider
  if (preferred === 'phantom' && phantomProvider) return phantomProvider
  if (solflareProvider?.isConnected && !phantomProvider?.isConnected) return solflareProvider
  return phantomProvider || solflareProvider
}

