import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

declare global {
  // eslint-disable-next-line no-var
  var CustomEvent: typeof window.CustomEvent
}

describe('session manager', () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalFetch = globalThis.fetch
  const originalCustomEvent = globalThis.CustomEvent

  let emitClientEventMock: ReturnType<typeof vi.fn>
  let subscribeClientEventMock: ReturnType<typeof vi.fn>
  let busHandlers: Record<string, (payload?: any) => void>

  beforeEach(() => {
    vi.resetModules()
    busHandlers = {}
    emitClientEventMock = vi.fn()
    subscribeClientEventMock = vi.fn((event: string, handler: (payload?: any) => void) => {
      busHandlers[event] = handler
      return vi.fn()
    })
    vi.doMock('@/src/client/events/useClientEventBus', () => ({
      emitClientEvent: emitClientEventMock,
      subscribeClientEvent: subscribeClientEventMock,
    }))
    const dispatchEvent = vi.fn()
    const fakeWindow: any = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    }
    const fakeDocument: any = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      hidden: false,
    }
    class FakeCustomEvent {
      type: string
      detail: any
      constructor(type: string, init?: { detail?: any }) {
        this.type = type
        this.detail = init?.detail
      }
    }

    globalThis.window = fakeWindow
    globalThis.document = fakeDocument
    globalThis.CustomEvent = FakeCustomEvent as any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        address: 'SolAddrXYZ',
        isHolder: true,
        minTokens: 5,
        tokenBalance: 123,
        tokenDecimals: 6,
        sessionExpiresAt: new Date(Date.now() + 60000).toISOString(),
      }),
    }) as any
  })

  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow
    } else {
      delete (globalThis as any).window
    }
    if (originalDocument) {
      globalThis.document = originalDocument
    } else {
      delete (globalThis as any).document
    }
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as any).fetch
    }
    if (originalCustomEvent) {
      globalThis.CustomEvent = originalCustomEvent
    } else {
      delete (globalThis as any).CustomEvent
    }
    vi.restoreAllMocks()
  })

  it('invalidates the session when unauthorized is reported', async () => {
    const { getSessionManager, notifySessionUnauthorized } = await import('@/src/client/session/sessionManager')
    const manager = getSessionManager()
    await manager.refresh({ force: true })
    expect(manager.getState().verified).toBe(true)

    notifySessionUnauthorized('expired')
    const next = manager.getState()
    expect(next.verified).toBe(false)
    expect(next.lastFailureReason).toBe('expired')
    expect(emitClientEventMock).toHaveBeenCalledWith(CLIENT_EVENT.SESSION_EXPIRED, { reason: 'expired' })
  })

  it('blocks refresh after logout until fetch completes', async () => {
    const { getSessionManager } = await import('@/src/client/session/sessionManager')
    const manager = getSessionManager()
    await manager.refresh({ force: true })
    expect(manager.getState().verified).toBe(true)

    expect(subscribeClientEventMock).toHaveBeenCalledWith(CLIENT_EVENT.LOGOUT, expect.any(Function))
    const logoutHandler = busHandlers[CLIENT_EVENT.LOGOUT]
    expect(typeof logoutHandler).toBe('function')
    logoutHandler?.()
    expect(manager.getState().verified).toBe(false)

    ;(globalThis.fetch as any).mockClear()
    await manager.refresh({ reason: 'wallet_verified' })
    expect((globalThis.fetch as any)).not.toHaveBeenCalled()

    await manager.refresh({ force: true })
    expect((globalThis.fetch as any)).toHaveBeenCalled()
  })
})
