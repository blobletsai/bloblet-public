"use client"

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

type HandlerMap = Partial<Record<WindowKey, (...args: any[]) => any>>

export function bindWindowApis(handlers: HandlerMap) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  for (const [key, fn] of Object.entries(handlers) as Array<[WindowKey, any]>) {
    if (typeof fn === 'function') {
      ;(window as any)[key] = fn
    }
  }

  return () => {
    if (typeof window === 'undefined') return
    for (const key of Object.keys(handlers) as WindowKey[]) {
      try {
        delete (window as any)[key]
      } catch {
        // ignore cleanup failures
      }
    }
  }
}
