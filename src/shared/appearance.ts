import { assetConfig } from '@/src/config/assets'
import { spritesConfig } from '@/src/config/sprites'

export type Tier = 'top' | 'middle' | 'bottom'

type Range = { start: number; end: number }

function computeRanges(): Record<Tier, Range> {
  const { total, hasCustomTotal } = spritesConfig.randomizer
  if (!hasCustomTotal) {
    return {
      top: { start: 0, end: 19 },
      middle: { start: 20, end: 69 },
      bottom: { start: 70, end: 99 },
    }
  }
  // Distribute by 20/50/30%
  let topCount = Math.max(1, Math.floor(total * 0.2))
  let middleCount = Math.max(1, Math.floor(total * 0.5))
  let bottomCount = Math.max(1, total - topCount - middleCount)
  // Adjust if rounding caused sum != total
  const diff = total - (topCount + middleCount + bottomCount)
  if (diff !== 0) bottomCount += diff
  const top: Range = { start: 0, end: topCount - 1 }
  const middle: Range = { start: top.end + 1, end: top.end + middleCount }
  const bottom: Range = { start: middle.end + 1, end: middle.end + bottomCount }
  return { top, middle, bottom }
}

function simpleHash(input: string): number {
  // Deterministic 32-bit hash (FNV-1a like)
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickAppearance(address: string, tier: Tier): { id: number; url: string } {
  const { baseUrl, extension } = spritesConfig.randomizer
  if (!baseUrl) {
    const fallback = assetConfig.sprites.defaultAlive || ''
    return { id: 0, url: fallback }
  }
  const ranges = computeRanges()
  const range = ranges[tier]
  const size = range.end - range.start + 1
  const hash = simpleHash(address)
  const id = range.start + (hash % size)
  const url = `${baseUrl}/${id}.${extension}`
  return { id, url }
}

// Returns the configured default sprite URL for alive/dead state,
// falling back between alive/dead if only one is set.
export function getDefaultSpriteUrl(isAlive: boolean): string | null {
  const alive = assetConfig.sprites.defaultAlive
  const dead = assetConfig.sprites.defaultDead
  if (isAlive) return alive || dead || null
  return dead || alive || null
}
