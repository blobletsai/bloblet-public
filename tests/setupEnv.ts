import { beforeEach } from 'vitest'

import { appConfig } from '@/src/config/app'

const store = new Map<string, string>()

const localStorageMock = {
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null
  },
  setItem(key: string, value: string) {
    store.set(key, String(value))
  },
  removeItem(key: string) {
    store.delete(key)
  },
  clear() {
    store.clear()
  },
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: false,
  })
}

// Provide a minimal Audio stub for React tests (jsdom lacks HTMLAudioElement).
if (typeof (globalThis as any).Audio === 'undefined') {
  class MockAudio {
    src: string
    volume = 1
    paused = true
    constructor(src = '') {
      this.src = src
    }
    play() {
      this.paused = false
      return Promise.resolve()
    }
    pause() {
      this.paused = true
    }
    addEventListener() {}
    removeEventListener() {}
    load() {}
  }
  ;(globalThis as any).Audio = MockAudio
}

beforeEach(() => {
  localStorageMock.clear()
})

if (!appConfig.secrets.session) {
  appConfig.secrets.session = 'test_session_secret_value_1234567890abcdef!!'
}
