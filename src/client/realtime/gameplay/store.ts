"use client"

import type { GameplayEvent, GameplayState } from './types'

type Listener = () => void

function createInitialState(): GameplayState {
  return {
    connection: 'idle',
    orders: new Map(),
    ordersByAddress: new Map(),
    careByAddress: new Map(),
    rewardsByAddress: new Map(),
    battles: new Map(),
    loadouts: new Map(),
    lastEvent: null,
  }
}

let state: GameplayState = createInitialState()
const listeners = new Set<Listener>()

type RealtimeDebugSample = {
  ts: number
  topic: string | null
  connection: GameplayState['connection']
  orders: number
  listeners: number
}

type RealtimeDebugStore = {
  notifyCount: number
  lastNotifyTs: number
  topics: Record<string, number>
  samples: RealtimeDebugSample[]
}

function getRealtimeDebugStore(): RealtimeDebugStore | null {
  if (typeof window === 'undefined') return null
  const existing = (window as any).__blobletsRealtimeDebug as RealtimeDebugStore | undefined
  if (existing) return existing
  const created: RealtimeDebugStore = {
    notifyCount: 0,
    lastNotifyTs: performance.now(),
    topics: {},
    samples: [],
  }
  ;(window as any).__blobletsRealtimeDebug = created
  return created
}

function recordNotifySample(topic: string | null, snapshot: GameplayState) {
  const store = getRealtimeDebugStore()
  if (!store) return
  store.notifyCount += 1
  store.lastNotifyTs = performance.now()
  if (topic) {
    store.topics[topic] = (store.topics[topic] || 0) + 1
  }
  store.samples.push({
    ts: store.lastNotifyTs,
    topic,
    connection: snapshot.connection,
    orders: snapshot.orders.size,
    listeners: listeners.size,
  })
  if (store.samples.length > 500) {
    store.samples.splice(0, store.samples.length - 500)
  }
}

function cloneState(): GameplayState {
  return {
    ...state,
    orders: new Map(state.orders),
    ordersByAddress: new Map(state.ordersByAddress),
    careByAddress: new Map(state.careByAddress),
    rewardsByAddress: new Map(state.rewardsByAddress),
    battles: new Map(state.battles),
    loadouts: new Map(state.loadouts),
  }
}

function notify(next: GameplayState) {
  state = next
  recordNotifySample(next.lastEvent?.topic || null, next)
  listeners.forEach((listener) => listener())
}

export function getGameplayState(): GameplayState {
  return state
}

export function setGameplayState(next: GameplayState) {
  notify(next)
}

export function updateGameplayState(update: (draft: GameplayState) => void) {
  const next = cloneState()
  update(next)
  notify(next)
}

export function resetGameplayState() {
  notify(createInitialState())
}

export function subscribeGameplayStore(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getGameplayListenerCount(): number {
  return listeners.size
}
