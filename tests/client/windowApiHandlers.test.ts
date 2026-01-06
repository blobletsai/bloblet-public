import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  createAddSprites,
  createApplyDelta,
  createClearSessionForWindow,
  createSetMyAddressForSession,
} from '@/components/bloblets-world/windowApiHandlers'

vi.mock('@/components/bloblets-world/assetLoader', () => ({
  loadImage: vi.fn(async () => ({
    width: 64,
    height: 64,
    naturalWidth: 64,
    naturalHeight: 64,
  })),
}))

vi.mock('@/components/bloblets-world/frames', () => ({
  buildFixedFrames: vi.fn(() => [
    {
      canvas: {} as any,
      w: 64,
      h: 64,
      scale: 1,
    },
  ]),
}))

type MutableRef<T> = { current: T }

function createStateRef() {
  const state = {
    sprites: [] as any[],
    addrToIdx: new Map<string, number>(),
    framesAliveMap: new Map<string, any>(),
    framesDeadMap: new Map<string, any>(),
    byTierSlots: [
      [{ x: 100, y: 120, tier: 0, r: 24 }],
      [],
      [],
      [],
    ],
    entryActive: false,
    entryStart: 0,
    entryEndBy: 0,
    myAddrCanonical: '',
  }

  const ref: MutableRef<typeof state> = { current: state }
  const rebuildIndex = () => {
    ref.current.addrToIdx = new Map(
      ref.current.sprites.map((sprite, idx) => [sprite.address, idx]),
    )
  }

  return { ref, rebuildIndex }
}

describe('windowApiHandlers core factories', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates existing sprites via applyDelta', () => {
    const { ref, rebuildIndex } = createStateRef()
    ref.current.sprites = [
      { address: '0xabc', alive: true, name: 'Alpha', r: 20 },
    ]
    rebuildIndex()

    const applyDelta = createApplyDelta({ stRef: ref, rebuildIndex })
    const result = applyDelta([
      { address: '0xabc', alive: false, name: 'New Name' },
    ])

    expect(result).toBe(true)
    expect(ref.current.sprites[0]!.alive).toBe(false)
    expect(ref.current.sprites[0]!.name).toBe('New Name')
  })

  it('adds new sprites with preloaded frames via addSprites', async () => {
    const { ref, rebuildIndex } = createStateRef()

    const addSprites = createAddSprites({ stRef: ref, rebuildIndex })
    const result = await addSprites([
      {
        address: '0xdef',
        alive: true,
        aliveUrl: 'https://cdn.example/alive.png',
        deadUrl: 'https://cdn.example/dead.png',
        name: 'Bravo',
      },
    ])

    expect(result).toBe(true)
    expect(ref.current.sprites).toHaveLength(1)
    expect(ref.current.addrToIdx.get('0xdef')).toBe(0)
    expect(ref.current.framesAliveMap.size).toBeGreaterThan(0)
    expect(ref.current.framesDeadMap.size).toBeGreaterThan(0)
  })

  it('persists and clears session state via address helpers', () => {
    const { ref } = createStateRef()
    const setMyAddressState = vi.fn()
    const setMyAddressDisplay = vi.fn()

    const setMyAddressForSession = createSetMyAddressForSession({
      stRef: ref,
      setMyAddressState,
      setMyAddressDisplay,
    })
    const clearSessionForWindow = createClearSessionForWindow({
      stRef: ref,
      setMyAddressState,
      setMyAddressDisplay,
    })

    const didSet = setMyAddressForSession('0xABC123', '0xABC123')
    expect(didSet).toBe(true)
    expect(ref.current.myAddrCanonical).toBe('0xABC123')
    expect(setMyAddressState).toHaveBeenCalledWith('0xABC123')
    expect(setMyAddressDisplay).toHaveBeenCalledWith('0xABC123')
    expect(localStorage.getItem('blob:my_addr')).toBe('0xABC123')

    const cleared = clearSessionForWindow()
    expect(cleared).toBe(true)
    expect(ref.current.myAddrCanonical).toBe('')
    expect(localStorage.getItem('blob:my_addr')).toBeNull()
  })

})
