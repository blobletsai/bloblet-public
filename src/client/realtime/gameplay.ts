"use client"

import { useEffect, useRef, useSyncExternalStore } from 'react'

import { ensureRealtime, releaseRealtime } from './gameplay/subscriptions'
import {
  getGameplayListenerCount,
  getGameplayState as getGameplayStateFromStore,
  subscribeGameplayStore,
} from './gameplay/store'
import type { GameplayEvent, GameplayState } from './gameplay/types'
import { startHealthReporter } from './health'
import { pauseRealtime, resumeRealtime } from './gameplay/subscriptions'
import { useSession } from '@/src/client/hooks/useSession'

export type { GameplayEvent, GameplayState } from './gameplay/types'
export { getGameplayState } from './gameplay/store'

function extractEventTimestamp(event: GameplayEvent | null): string | null {
  if (!event) return null
  const payload: any = event.payload
  if (payload && typeof payload.updatedAt === 'string') return payload.updatedAt
  if (payload && typeof payload.createdAt === 'string') return payload.createdAt
  return null
}

const MIN_HEALTH_BEACON_INTERVAL_MS = 5_000

type HealthBeaconPayload = {
  status: GameplayState['connection']
  lastEventAt: string | null
  fallbackPolling: boolean
  activeOrders: number
  battlesCached: number
  loadoutsCached: number
  listenerCount: number
}

type HealthBeaconRecord = {
  payload: HealthBeaconPayload
  sentAt: number
}

export function computeHealthBeaconDecision(
  snapshot: GameplayState,
  listenerCount: number,
  previous: HealthBeaconRecord | null,
  now: number,
): { shouldSend: boolean; nextRecord: HealthBeaconRecord | null } {
  if (listenerCount <= 0) {
    return { shouldSend: false, nextRecord: null }
  }

  const payload: HealthBeaconPayload = {
    status: snapshot.connection,
    lastEventAt: extractEventTimestamp(snapshot.lastEvent),
    fallbackPolling: snapshot.connection !== 'open',
    activeOrders: snapshot.orders.size,
    battlesCached: snapshot.battles.size,
    loadoutsCached: snapshot.loadouts.size,
    listenerCount,
  }

  const changed =
    !previous ||
    previous.payload.status !== payload.status ||
    previous.payload.lastEventAt !== payload.lastEventAt ||
    previous.payload.fallbackPolling !== payload.fallbackPolling ||
    previous.payload.activeOrders !== payload.activeOrders ||
    previous.payload.battlesCached !== payload.battlesCached ||
    previous.payload.loadoutsCached !== payload.loadoutsCached ||
    previous.payload.listenerCount !== payload.listenerCount

  if (!changed && previous && now - previous.sentAt < MIN_HEALTH_BEACON_INTERVAL_MS) {
    return { shouldSend: false, nextRecord: previous }
  }

  return {
    shouldSend: true,
    nextRecord: {
      payload,
      sentAt: now,
    },
  }
}

export function useGameplayRealtime(): GameplayState {
  const session = useSession()
  const sessionAddress = (session?.address || '').trim()
  const sessionToken = session?.supabaseAccessToken
  const sessionVerified = !!session?.verified
  const snapshot = useSyncExternalStore(
    subscribeGameplayStore,
    getGameplayStateFromStore,
    getGameplayStateFromStore,
  )

  useEffect(() => {
    ensureRealtime()
    startHealthReporter()
    // Visibility-aware pause/resume of realtime to prevent idle churn
    const handleVis = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          pauseRealtime()
        } else {
          resumeRealtime()
        }
      } catch {}
    }
    try { if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVis) } catch {}
    handleVis()
    return () => {
      try { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVis) } catch {}
      releaseRealtime()
    }
  }, [])

  useEffect(() => {
    if (!sessionAddress || !sessionToken || !sessionVerified) {
      releaseRealtime(true)
      return
    }
    ensureRealtime(sessionAddress)
  }, [sessionAddress, sessionToken, sessionVerified])

  return snapshot
}

export { MIN_HEALTH_BEACON_INTERVAL_MS }
