"use client"

import { useEffect } from 'react'

import { useClientEventBus } from '@/src/client/events/useClientEventBus'
import type { ClientEventPayload, ClientEventMap } from '@/src/client/events/clientEventMap'

type WindowKey =
  | 'BlobletsWorld_applyLoadouts'
  | 'BlobletsWorld_updateLoadout'
  | 'BlobletsWorld_applyBattles'
  | 'BlobletsWorld_prependBattle'
  | 'BlobletsWorld_applySnapshot'
  | 'BlobletsWorld_applyDelta'
  | 'BlobletsWorld_removePlaceholder'
  | 'BlobletsWorld_replayEntry'
  | 'BlobletsWorld_addSprites'
  | 'BlobletsWorld_focusOn'
  | 'BlobletsWorld_setHighlight'
  | 'BlobletsWorld_setMyAddress'
  | 'BlobletsWorld_clearSession'
  | 'BlobletsWorld_openHub'
  | 'BlobletsWorld_closeHub'
  | 'BlobletsWorld_openChallenge'
  | 'BlobletsWorld_closeChallenge'
  | 'BlobletsWorld_openTopUpRewards'
  | 'BlobletsWorld_closeRewards'

type WindowHandler = (...args: any[]) => unknown
type WindowHandlerMap = Partial<Record<WindowKey, WindowHandler>>

type EventHandlerMap = Partial<{
  [K in keyof ClientEventMap]: (payload: ClientEventMap[K]) => void
}>

export function useWindowBindings(
  windowHandlers: WindowHandlerMap | null | undefined,
  eventHandlers?: EventHandlerMap,
) {
  const eventBus = useClientEventBus()

  useEffect(() => {
    if (!windowHandlers) return
    if (typeof window === 'undefined') return
    for (const [key, fn] of Object.entries(windowHandlers) as Array<[WindowKey, WindowHandler]>) {
      if (typeof fn === 'function') {
        ;(window as any)[key] = fn
      }
    }
    return () => {
      if (typeof window === 'undefined') return
      for (const key of Object.keys(windowHandlers) as WindowKey[]) {
        try {
          delete (window as any)[key]
        } catch {
          // ignore cleanup failures
        }
      }
    }
  }, [windowHandlers])

  useEffect(() => {
    if (!eventBus || !eventHandlers) return
    const unsubs = Object.entries(eventHandlers).map(([event, handler]) => {
      if (typeof handler !== 'function') {
        return () => {}
      }
      return eventBus.subscribe(event, handler as (payload: ClientEventMap[keyof ClientEventMap]) => void)
    })
    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub()
        } catch {
          // ignore cleanup failures
        }
      })
    }
  }, [eventBus, eventHandlers])
}
