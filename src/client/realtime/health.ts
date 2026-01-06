"use client"

import { getGameplayState } from './gameplay/store'
import { subscribeGameplayStore, getGameplayListenerCount } from './gameplay/store'
import { appConfig } from '@/src/config/app'

let started = false
let lastSentAt = 0
let pending = false

const THROTTLE_MS = appConfig.tuning.healthThrottleMs

function visible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

function send(payload: any) {
  try {
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/health', body)
    } else {
      fetch('/api/health', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
  } catch {}
}

function schedule() {
  if (pending) return
  pending = true
  setTimeout(() => {
    pending = false
    const now = Date.now()
    if (!visible()) return
    if (now - lastSentAt < THROTTLE_MS) return
    lastSentAt = now
    const snapshot = getGameplayState()
    const payload = {
      status: snapshot.connection,
      lastEventAt: snapshot.lastEvent ? (snapshot.lastEvent.payload as any)?.updatedAt || (snapshot.lastEvent.payload as any)?.createdAt || null : null,
      fallbackPolling: snapshot.connection !== 'open',
      activeOrders: snapshot.orders.size,
      battlesCached: snapshot.battles.size,
      loadoutsCached: snapshot.loadouts.size,
      listenerCount: getGameplayListenerCount(),
    }
    send(payload)
  }, THROTTLE_MS)
}

export function startHealthReporter() {
  if (started || typeof window === 'undefined') return
  started = true
  // visibility changes reset throttle
  const onVis = () => { lastSentAt = 0 }
  try { if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis) } catch {}
  subscribeGameplayStore(() => {
    if (!visible()) return
    schedule()
  })
}

