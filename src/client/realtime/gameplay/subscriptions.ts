"use client"

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

import {
  getLastHydratedAt,
  hydrateOpenOrders,
  markChannelOpen,
  markConnecting,
  markRetrying,
  resetGameplayStateToIdle,
  resetHydrationState,
} from './hydrate'
import { getSupabaseClient, consumeSupabaseClientStaleFlag } from './client'
import {
  handleBattleChange,
  handleCareChange,
  handleLedgerChange,
  handleLoadoutChange,
  handleOrderChange,
} from './events'
import { getGameplayListenerCount, updateGameplayState } from './store'
import { getSessionSnapshot } from '@/src/client/session/sessionManager'
import { getBrowserSupabaseAuthToken } from '@/src/client/supabaseClientAuth'
import { featuresConfig } from '@/src/config/features'

let channel: RealtimeChannel | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let activeClient: SupabaseClient | null = null
let waitingForOnline = false
let paused = false
let activeAddress: string | null = null

function scheduleReconnect() {
  if (reconnectTimer) return
  if (paused) return
  if (waitForBrowserOnline()) {
    markRetrying()
    return
  }
  resetHydrationState()
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    channel = null
    ensureRealtime()
  }, 2_000)
  markRetrying()
}

type GameplaySupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>

function subscribeToChannel(client: GameplaySupabaseClient, address: string) {
  activeClient = client
  const addrFilter = address ? address.trim() : ''
  channel = client
    .channel(`gameplay:${addrFilter || 'unknown'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `address_canonical=eq.${addrFilter}` },
      handleOrderChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bloblets', filter: `address_canonical=eq.${addrFilter}` },
      handleCareChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reward_ledger', filter: `address=eq.${addrFilter}` },
      handleLedgerChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pvp_battles', filter: `attacker=eq.${addrFilter}` },
      handleBattleChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pvp_battles', filter: `defender=eq.${addrFilter}` },
      handleBattleChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bloblet_loadout', filter: `bloblet_address=eq.${addrFilter}` },
      handleLoadoutChange,
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        markChannelOpen()
        if (featuresConfig.realtimeDebug) {
          console.info('[realtime:gameplay] channel subscribed', {
            listeners: getGameplayListenerCount(),
            hydrated: Boolean(getLastHydratedAt()),
            address: addrFilter,
          })
        }
        hydrateOpenOrders(addrFilter).catch(() => {})
      } else if (status === 'CHANNEL_ERROR') {
        updateGameplayState((next) => {
          next.connection = 'error'
        })
        console.error('[realtime:gameplay] channel error', {
          listeners: getGameplayListenerCount(),
        })
        scheduleReconnect()
      } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
        if (featuresConfig.realtimeDebug) {
          console.warn('[realtime:gameplay] channel closed', {
            status,
            listeners: getGameplayListenerCount(),
          })
        }
        scheduleReconnect()
      }
    })
}

export function ensureRealtime(addressOverride?: string) {
  if (typeof window === 'undefined') return
  if (consumeSupabaseClientStaleFlag()) {
    channel = null
    activeClient = null
    resetHydrationState()
  }
  const token = getBrowserSupabaseAuthToken()
  if (!token) return
  const session = getSessionSnapshot()
  const address = (addressOverride || session.address || '').trim()
  if (!address) return
  if (activeAddress && address !== activeAddress) {
    releaseRealtime(true)
  }
  if (channel) return
  if (paused) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    // Defer until visible
    return
  }
  if (waitForBrowserOnline()) {
    markRetrying()
    return
  }
  const client = getSupabaseClient()
  if (!client) return

  markConnecting()
  activeAddress = address
  subscribeToChannel(client, address)
}

export function releaseRealtime(force = false) {
  if (!force && getGameplayListenerCount() > 0) return
  if (force) {
    paused = false
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (channel && typeof window !== 'undefined') {
    activeClient?.removeChannel(channel)
  }
  channel = null
  activeClient = null
  activeAddress = null
  resetHydrationState()
  resetGameplayStateToIdle()
}

export function pauseRealtime() {
  paused = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (channel && typeof window !== 'undefined') {
    try { activeClient?.removeChannel(channel) } catch {}
  }
  channel = null
  activeClient = null
  markRetrying()
}

export function resumeRealtime() {
  paused = false
  ensureRealtime(activeAddress || undefined)
}

function waitForBrowserOnline() {
  if (typeof window === 'undefined') return false
  if (typeof navigator !== 'undefined' && navigator.onLine) return false
  if (waitingForOnline) return true
  waitingForOnline = true
  updateGameplayState((next) => {
    next.connection = 'offline'
  })
  const handler = () => {
    waitingForOnline = false
    window.removeEventListener('online', handler)
    ensureRealtime(activeAddress || undefined)
  }
  window.addEventListener('online', handler)
  return true
}
