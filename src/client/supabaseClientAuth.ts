"use client"

const RLS_TOKEN_KEY = '__bloblets_supabase_rls_token__'

export function setBrowserSupabaseAuthToken(token: string | null): boolean {
  if (typeof window === 'undefined') return false
  const normalized = token && token.trim().length ? token.trim() : null
  const win = window as any
  const previous = typeof win[RLS_TOKEN_KEY] === 'string' ? String(win[RLS_TOKEN_KEY]) : null
  if (normalized) {
    win[RLS_TOKEN_KEY] = normalized
  } else {
    delete win[RLS_TOKEN_KEY]
  }
  return previous !== normalized
}

export function getBrowserSupabaseAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = (window as any)[RLS_TOKEN_KEY]
  return typeof token === 'string' && token.trim().length ? token : null
}
