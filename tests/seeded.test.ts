import { describe, expect, it } from 'vitest'
import { RNG } from '../src/shared/seeded'

describe('RNG', () => {
  it('produces deterministic sequences for the same seed', () => {
    const rngA = new RNG('bloblet')
    const rngB = new RNG('bloblet')
    const seqA = [rngA.next(), rngA.next(), rngA.next()]
    const seqB = [rngB.next(), rngB.next(), rngB.next()]
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const rngA = new RNG('bloblet')
    const rngB = new RNG('bloblet-2')
    expect(rngA.next()).not.toEqual(rngB.next())
  })
})
