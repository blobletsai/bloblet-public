"use client"

import { emitClientEvent, subscribeClientEvent } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import { setBrowserSupabaseAuthToken } from '@/src/client/supabaseClientAuth'
import { applySupabaseAnonAuthToken } from '@/src/server/supa'
import { markSupabaseClientStale, resetSupabaseClient } from '@/src/client/realtime/gameplay/client'

export type SessionSnapshot = {
  address: string | null
  isHolder: boolean
  minTokens: number | null
  tokenBalance: number | null
  tokenDecimals: number | null
  sessionExpiresAt: string | null
  verified: boolean
  loading: boolean
  lastFailureReason: string | null
  supabaseAccessToken: string | null
  supabaseTokenExpiresAt: string | null
}

const DEFAULT_SESSION_SNAPSHOT: SessionSnapshot = {
  address: null,
  isHolder: false,
  minTokens: null,
  tokenBalance: null,
  tokenDecimals: null,
  sessionExpiresAt: null,
  verified: false,
  loading: true,
  lastFailureReason: null,
  supabaseAccessToken: null,
  supabaseTokenExpiresAt: null,
}

const SUPABASE_REFRESH_BUFFER_MS = 5 * 60 * 1000

type RefreshOptions = {
  force?: boolean
  reason?: string
}

class SessionManager {
  private state: SessionSnapshot = { ...DEFAULT_SESSION_SNAPSHOT }
  private listeners = new Set<() => void>()
  private inflight: Promise<void> | null = null
  private expiryTimer: number | null = null
  private lastVisibilityRefresh = 0
  private logoutAt: number | null = null
  private unsubscribeVerified: (() => void) | null = null
  private unsubscribeLogout: (() => void) | null = null

  constructor() {
    if (typeof window === 'undefined') return
    this.refresh({ reason: 'init' })
    window.addEventListener('focus', this.handleVisibilityChange)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }
    this.unsubscribeVerified = subscribeClientEvent(CLIENT_EVENT.VERIFIED, () => this.handleWalletVerified())
    this.unsubscribeLogout = subscribeClientEvent(CLIENT_EVENT.LOGOUT, () => this.handleLogout())
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): SessionSnapshot {
    return this.state
  }

  refresh(options: RefreshOptions = {}) {
    if (typeof window === 'undefined') return Promise.resolve()
    if (this.inflight) return this.inflight
    if (!options.force && this.state.loading) return this.inflight || Promise.resolve()
    if (this.logoutAt && !options.force) return Promise.resolve()
    this.setState({ loading: true })
    this.inflight = this.fetchSession().finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  notifyUnauthorized(reason?: string) {
    this.applyInvalidState(reason || 'unauthorized')
  }

  private applySupabaseAuthToken(token: string | null) {
    const changed = setBrowserSupabaseAuthToken(token)
    if (changed) {
      applySupabaseAnonAuthToken(token)
      if (token) {
        markSupabaseClientStale()
      } else {
        resetSupabaseClient()
      }
    }
  }

  private async fetchSession() {
    try {
      const resp = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      if (!resp.ok) {
        if (resp.status === 401) {
          const json = await resp.json().catch(() => null)
          const failureReason = typeof json?.reason === 'string' ? json.reason : 'unauthorized'
          this.applyInvalidState(failureReason)
        } else {
          this.setState({
            loading: false,
            lastFailureReason: `status_${resp.status}`,
          })
        }
        return
      }
      const json = await resp.json().catch(() => null)
      if (!json) {
        this.setState({ loading: false, lastFailureReason: 'invalid_payload' })
        return
      }
      const supabaseAccessToken = typeof json.supabaseAccessToken === 'string' ? json.supabaseAccessToken : null
      const supabaseTokenExpiresAt = typeof json.supabaseTokenExpiresAt === 'string' ? json.supabaseTokenExpiresAt : null
      const supabaseTokenChanged = supabaseAccessToken !== this.state.supabaseAccessToken
      const canonical = (typeof json.address === 'string' && json.address.trim().length) ? json.address.trim() : null
      const snapshot = this.setState({
        address: canonical,
        isHolder: !!json.isHolder,
        minTokens: Number.isFinite(json.minTokens) ? Number(json.minTokens) : null,
        tokenBalance: typeof json.tokenBalance === 'number' ? json.tokenBalance : null,
        tokenDecimals: Number.isFinite(json.tokenDecimals) ? Math.max(0, Math.floor(Number(json.tokenDecimals))) : null,
        sessionExpiresAt: typeof json.sessionExpiresAt === 'string' ? json.sessionExpiresAt : null,
        verified: !!canonical,
        loading: false,
        lastFailureReason: null,
        supabaseAccessToken,
        supabaseTokenExpiresAt,
      })
      if (supabaseTokenChanged) {
        this.applySupabaseAuthToken(supabaseAccessToken)
      }
      if (snapshot.verified && snapshot.address) {
        this.emitSessionEvent(CLIENT_EVENT.SESSION_VALID, {
          address: snapshot.address,
          expiresAt: snapshot.sessionExpiresAt,
        })
      }
      this.scheduleExpiryTimer(snapshot.sessionExpiresAt, snapshot.supabaseTokenExpiresAt)
    } catch (err: any) {
      this.setState({ loading: false, lastFailureReason: 'network_error' })
    }
  }

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.hidden) return
    const now = Date.now()
    if (now - this.lastVisibilityRefresh < 15000) return
    if (this.logoutAt) return
    this.lastVisibilityRefresh = now
    this.refresh({ reason: 'visibility' })
  }

  private handleWalletVerified = () => {
    if (this.logoutAt) return
    this.refresh({ reason: 'wallet_verified', force: true })
  }

  private handleLogout = () => {
    this.logoutAt = Date.now()
    this.applyInvalidState('logout')
  }

  private applyInvalidState(reason: string) {
    const wasVerified = this.state.verified
    if (reason === 'logout') {
      this.logoutAt = Date.now()
    } else {
      this.logoutAt = null
    }
    this.clearExpiryTimer()
    this.setState({
      address: null,
      isHolder: false,
      minTokens: null,
      tokenBalance: null,
      tokenDecimals: null,
      sessionExpiresAt: null,
      verified: false,
      loading: false,
      lastFailureReason: reason,
      supabaseAccessToken: null,
      supabaseTokenExpiresAt: null,
    })
    this.applySupabaseAuthToken(null)
    if (wasVerified) {
      this.emitSessionEvent(CLIENT_EVENT.SESSION_EXPIRED, { reason })
    }
  }

  private setState(patch: Partial<SessionSnapshot>): SessionSnapshot {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => {
      try { listener() } catch {}
    })
    return this.state
  }

  private clearExpiryTimer() {
    if (this.expiryTimer !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(this.expiryTimer)
      } else {
        clearTimeout(this.expiryTimer)
      }
      this.expiryTimer = null
    }
  }

  private scheduleExpiryTimer(expiresAt?: string | null, supabaseExpiresAt?: string | null) {
    if (typeof window === 'undefined') return
    this.clearExpiryTimer()
    const now = Date.now()
    const candidates: number[] = []
    const iso = expiresAt || this.state.sessionExpiresAt
    if (iso) {
      const expiresMs = Date.parse(iso)
      if (Number.isFinite(expiresMs)) {
        candidates.push(expiresMs - now - 30000)
      }
    }
    const supaIso = supabaseExpiresAt || this.state.supabaseTokenExpiresAt
    if (supaIso) {
      const supaMs = Date.parse(supaIso)
      if (Number.isFinite(supaMs)) {
        candidates.push(supaMs - now - SUPABASE_REFRESH_BUFFER_MS)
      }
    }
    const deltas = candidates.filter((ms) => Number.isFinite(ms))
    if (!deltas.length) return
    const refreshIn = Math.max(1000, Math.min(...deltas.map((ms) => Math.max(1000, ms))))
    this.expiryTimer = window.setTimeout(() => {
      this.expiryTimer = null
      this.refresh({ force: true, reason: 'expiry_timer' })
    }, refreshIn)
  }

  private emitSessionEvent(
    eventName: typeof CLIENT_EVENT.SESSION_VALID | typeof CLIENT_EVENT.SESSION_EXPIRED,
    detail?: any,
  ) {
    emitClientEvent(eventName, detail ?? {})
  }
}

let manager: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!manager) {
    manager = new SessionManager()
  }
  return manager
}

export function getSessionSnapshot(): SessionSnapshot {
  return getSessionManager().getState()
}

export function initialSessionSnapshot(): SessionSnapshot {
  return { ...DEFAULT_SESSION_SNAPSHOT }
}

export function notifySessionUnauthorized(reason?: string) {
  getSessionManager().notifyUnauthorized(reason)
}

export function clearSessionCookieClient() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const directives = new Set<string>()
  directives.add('Path=/; Max-Age=0')
  const host = window.location.hostname
  if (host) {
    directives.add(`Path=/; Max-Age=0; Domain=${host}`)
    const parts = host.split('.')
    if (parts.length > 2) {
      const apex = parts.slice(-2).join('.')
      directives.add(`Path=/; Max-Age=0; Domain=.${apex}`)
    }
  }
  directives.forEach((directive) => {
    document.cookie = `blob_session=; ${directive}`
  })
}
