import React, { useEffect } from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { beforeAll, afterAll, describe, expect, it, vi, beforeEach } from 'vitest'

import {
  useClientEventBus,
  useClientEventPublisher,
  resetClientEventBusForTests,
} from '@/src/client/events/useClientEventBus'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

const originalWindow = globalThis.window

beforeAll(() => {
  if (!originalWindow) {
    ;(globalThis as typeof globalThis & { window?: Window }).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window
  }
})

afterAll(() => {
  if (originalWindow) {
    ;(globalThis as typeof globalThis & { window?: Window }).window = originalWindow
  } else {
    delete (globalThis as typeof globalThis & { window?: Window }).window
  }
})

beforeEach(() => {
  resetClientEventBusForTests()
})

function BusProbe({ onReady }: { onReady: (bus: ReturnType<typeof useClientEventBus>) => void }) {
  const bus = useClientEventBus()
  useEffect(() => {
    onReady(bus)
  }, [bus, onReady])
  return null
}

function PublisherProbe({ onReady }: { onReady: (pub: ReturnType<typeof useClientEventPublisher>) => void }) {
  const pub = useClientEventPublisher()
  useEffect(() => {
    onReady(pub)
  }, [pub, onReady])
  return null
}

describe('useClientEventBus', () => {
  it('subscribes, emits, and unsubscribes handlers', () => {
    let capturedBus: ReturnType<typeof useClientEventBus> = null

    act(() => {
      TestRenderer.create(<BusProbe onReady={(bus) => { capturedBus = bus }} />)
    })

    expect(capturedBus).not.toBeNull()
    const handler = vi.fn()
    const unsubscribe = capturedBus!.subscribe('sample', handler)

    capturedBus!.emit('sample', { foo: 'bar' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' })

    unsubscribe()
    capturedBus!.emit('sample', { foo: 'baz' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('publishes events through the emitter helper', () => {
    let capturedBus: ReturnType<typeof useClientEventBus> = null
    let publisher: ReturnType<typeof useClientEventPublisher> | null = null

    act(() => {
      TestRenderer.create(<BusProbe onReady={(bus) => { capturedBus = bus }} />)
    })

    const handler = vi.fn()
    capturedBus!.subscribe('fire', handler)

    act(() => {
      TestRenderer.create(<PublisherProbe onReady={(pub) => { publisher = pub }} />)
    })

    expect(publisher).not.toBeNull()
    publisher!.emit('fire', { payload: 123 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ payload: 123 })
  })
})
