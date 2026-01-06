"use client"

import { useSession } from './useSession'

export type HolderSessionState = {
  address: string | null
  isHolder: boolean
  loading: boolean
  verified: boolean
  minTokens: number | null
  tokenBalance: number | null
  tokenDecimals: number | null
  sessionExpiresAt: string | null
  lastFailureReason: string | null
  supabaseAccessToken: string | null
  supabaseTokenExpiresAt: string | null
}

export function useHolderSession(): HolderSessionState {
  const session = useSession()
  return {
    address: session.address,
    isHolder: session.isHolder,
    loading: session.loading,
    verified: session.verified,
    minTokens: session.minTokens,
    tokenBalance: session.tokenBalance,
    tokenDecimals: session.tokenDecimals,
    sessionExpiresAt: session.sessionExpiresAt,
    lastFailureReason: session.lastFailureReason,
    supabaseAccessToken: session.supabaseAccessToken,
    supabaseTokenExpiresAt: session.supabaseTokenExpiresAt,
  }
}

export default useHolderSession
