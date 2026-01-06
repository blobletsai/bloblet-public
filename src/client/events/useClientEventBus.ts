"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

import type { ClientEventPayload } from './clientEventMap'

type Listener<Name extends string = string> = (payload: ClientEventPayload<Name>) => void
type ListenerMap = Map<string, Set<Listener<any>>>

class ClientEventBus {
  private listeners: ListenerMap = new Map()

  subscribe<Name extends string>(event: Name, listener: Listener<Name>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as Listener<any>)
    return () => {
      const set = this.listeners.get(event)
      if (!set) return
      set.delete(listener)
      if (set.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  emit<Name extends string>(event: Name, payload: ClientEventPayload<Name> = {} as ClientEventPayload<Name>) {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return
    for (const listener of set) {
      try {
        listener(payload as ClientEventPayload<any>)
      } catch (err) {
        console.warn('[event-bus] listener failed', event, err)
      }
    }
  }
}

const globalBusRef: { current: ClientEventBus | null } = { current: null }

function getGlobalBus() {
  if (typeof window === 'undefined') return null
  if (!globalBusRef.current) {
    globalBusRef.current = new ClientEventBus()
  }
  return globalBusRef.current
}

export function useClientEventBus() {
  const [bus, setBus] = useState<ClientEventBus | null>(() => getGlobalBus())
  useEffect(() => {
    if (!bus) {
      setBus(getGlobalBus())
    }
  }, [bus])
  return bus
}

export function useClientEventPublisher() {
  const bus = useClientEventBus()
  return useMemo(() => ({
    emit<Name extends string>(event: Name, payload?: ClientEventPayload<Name>) {
      bus?.emit(event, payload ?? ({} as ClientEventPayload<Name>))
    },
  }), [bus])
}

export function resetClientEventBusForTests() {
  globalBusRef.current = null
}

export function emitClientEvent<Name extends string>(event: Name, payload?: ClientEventPayload<Name>) {
  const bus = getGlobalBus()
  bus?.emit(event, payload ?? ({} as ClientEventPayload<Name>))
}

export function subscribeClientEvent<Name extends string>(
  event: Name,
  listener: (payload: ClientEventPayload<Name>) => void,
) {
  const bus = getGlobalBus()
  if (!bus) return () => {}
  return bus.subscribe(event, listener)
}
