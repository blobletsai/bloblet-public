"use client"

import { supaAnon, resetBrowserSupabaseClient } from '@/src/server/supa'
import { getBrowserSupabaseAuthToken } from '@/src/client/supabaseClientAuth'
import { updateGameplayState } from './store'

let attempted = false
let supabaseClientStale = false

export function getSupabaseClient() {
  if (typeof window === 'undefined') return null
  const token = getBrowserSupabaseAuthToken()
  if (!token) return null
  try {
    attempted = true
    return supaAnon()
  } catch (err) {
    console.error('[realtime:gameplay] failed to create Supabase client', err)
    updateGameplayState((next) => {
      next.connection = 'error'
    })
    return null
  }
}

export function markSupabaseClientStale() {
  supabaseClientStale = true
}

export function resetSupabaseClient() {
  attempted = false
  supabaseClientStale = true
  resetBrowserSupabaseClient()
}

export function consumeSupabaseClientStaleFlag(): boolean {
  const wasStale = supabaseClientStale
  supabaseClientStale = false
  return wasStale
}
