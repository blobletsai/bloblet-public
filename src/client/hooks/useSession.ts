"use client"

import { useSyncExternalStore } from 'react'

import { getSessionManager, initialSessionSnapshot } from '@/src/client/session/sessionManager'

export type SessionState = {
  address: string | null
  isHolder: boolean
  verified: boolean
  loading: boolean
  minTokens: number | null
  tokenBalance: number | null
  tokenDecimals: number | null
  sessionExpiresAt: string | null
  lastFailureReason: string | null
  supabaseAccessToken: string | null
  supabaseTokenExpiresAt: string | null
}

export function useSession(): SessionState {
  const manager = getSessionManager()
  const snapshot = useSyncExternalStore(
    (onStoreChange) => manager.subscribe(onStoreChange),
    () => manager.getState(),
    () => initialSessionSnapshot(),
  )
  return {
    address: snapshot.address,
    isHolder: snapshot.isHolder,
    verified: snapshot.verified,
    loading: snapshot.loading,
    minTokens: snapshot.minTokens,
    tokenBalance: snapshot.tokenBalance,
    tokenDecimals: snapshot.tokenDecimals,
    sessionExpiresAt: snapshot.sessionExpiresAt,
    lastFailureReason: snapshot.lastFailureReason,
    supabaseAccessToken: snapshot.supabaseAccessToken,
    supabaseTokenExpiresAt: snapshot.supabaseTokenExpiresAt,
  }
}
