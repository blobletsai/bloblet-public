import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getBrowserSupabaseAuthToken } from '@/src/client/supabaseClientAuth'
import { appConfig } from '../config/app'

const BROWSER_CLIENT_KEY = '__bloblets_supabase_anon__'

let _admin: SupabaseClient | null = null
let _anon: SupabaseClient | null = null
let _anonAuthToken: string | null = null

function getCurrentAuthToken() {
  if (typeof window !== 'undefined') {
    const browserToken = getBrowserSupabaseAuthToken()
    if (browserToken) {
      _anonAuthToken = browserToken
      return browserToken
    }
  }
  return _anonAuthToken
}

function applyAuthToken(client: SupabaseClient, token: string | null) {
  const restHeaders = (client as any)?.rest?.headers
  if (restHeaders?.set) {
    if (token) {
      restHeaders.set('Authorization', `Bearer ${token}`)
    } else {
      restHeaders.delete('Authorization')
    }
  }
  try {
    client.realtime.setAuth(token || undefined)
  } catch {
    // ignore realtime auth update failures
  }
}

function createSupabaseAnonClient() {
  const { url, anonKey } = appConfig.supabase
  if (!url || !anonKey) {
    throw new Error('Supabase anon environment variables are missing.')
  }
  const authToken = getCurrentAuthToken()
  const globalHeaders: Record<string, string> = {}
  if (authToken) {
    globalHeaders.Authorization = `Bearer ${authToken}`
  }
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
    global: Object.keys(globalHeaders).length ? { headers: globalHeaders } : undefined,
  })
  applyAuthToken(client, authToken || null)
  return client
}

export function supaAdmin() {
  if (_admin) return _admin
  const { url, serviceKey } = appConfig.supabase
  _admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  return _admin
}

export function supaAnon(): SupabaseClient {
  const desiredToken = getCurrentAuthToken()
  if (typeof window !== 'undefined') {
    const anyWindow = window as unknown as Record<string, SupabaseClient | undefined>
    if (!anyWindow[BROWSER_CLIENT_KEY]) {
      try {
        anyWindow[BROWSER_CLIENT_KEY] = createSupabaseAnonClient()
      } catch (err) {
        console.error('[supaAnon] Failed to create browser Supabase client', err)
        throw err
      }
    } else if (desiredToken !== _anonAuthToken) {
      _anonAuthToken = desiredToken ?? null
      try {
        applyAuthToken(anyWindow[BROWSER_CLIENT_KEY] as SupabaseClient, _anonAuthToken)
      } catch {
        // best-effort update
      }
    }
    _anonAuthToken = desiredToken ?? _anonAuthToken
    return anyWindow[BROWSER_CLIENT_KEY] as SupabaseClient
  }

  if (_anon) return _anon
  _anonAuthToken = desiredToken ?? _anonAuthToken
  _anon = createSupabaseAnonClient()
  return _anon
}

export function applySupabaseAnonAuthToken(token: string | null) {
  const normalized = token && token.trim().length ? token.trim() : null
  _anonAuthToken = normalized
  if (typeof window !== 'undefined') {
    const anyWindow = window as unknown as Record<string, SupabaseClient | undefined>
    const client = anyWindow[BROWSER_CLIENT_KEY]
    if (client) {
      applyAuthToken(client, normalized)
    }
  }
  if (_anon) {
    applyAuthToken(_anon, normalized)
  }
}

export function resetBrowserSupabaseClient() {
  if (typeof window === 'undefined') return
  const anyWindow = window as unknown as Record<string, SupabaseClient | undefined>
  if (anyWindow[BROWSER_CLIENT_KEY]) {
    try {
      anyWindow[BROWSER_CLIENT_KEY]?.removeAllChannels()
    } catch {}
    delete anyWindow[BROWSER_CLIENT_KEY]
  }
}

export { BROWSER_CLIENT_KEY }
