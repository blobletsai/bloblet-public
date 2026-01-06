import { describe, expect, it, vi } from 'vitest'

import { createSeedSpritesFromSnapshot } from '@/components/bloblets-world/bootstrap'

type MutableRef<T> = { current: T }

describe('createSeedSpritesFromSnapshot', () => {
  it('maps holders to sprites and signals readiness', () => {
    const st = {
      byTierSlots: [
        [{ x: 10, y: 20, tier: 0, r: 18 }],
        [],
        [],
        [],
      ] as any[],
      sprites: [] as any[],
      addrToIdx: new Map<string, number>(),
      entryStagger: 2,
    }
    const stRef: MutableRef<typeof st> = { current: st }
    const rebuildIndex = vi.fn(() => {
      stRef.current.addrToIdx = new Map(
        stRef.current.sprites.map((sprite, idx) => [sprite.address, idx]),
      )
    })
    const signalReady = vi.fn()

    const seedSprites = createSeedSpritesFromSnapshot({
      stRef,
      rebuildIndex,
      signalReady,
    })

    seedSprites([
      {
        address: '0xabc',
        balance: 100,
        alive: true,
      },
    ])

    expect(stRef.current.sprites).toHaveLength(1)
    expect(stRef.current.sprites[0]!.address).toBe('0xabc')
    expect(stRef.current.sprites[0]!.entryDelay).toBe(0)
    expect(rebuildIndex).toHaveBeenCalled()
    expect(signalReady).toHaveBeenCalled()
  })
})
