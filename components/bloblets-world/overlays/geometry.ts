import { clamp, easeOutCubic, lerp } from '../math'
import type { Sprite } from '../types'

export function computeWorldY(sprite: Sprite, now: number, timestamp: number) {
  if (sprite.mode === 'entry') {
    return sprite.y
  }
  if (sprite.mode === 'glide') {
    const progress = clamp(((now - (sprite.gStart || now)) / (sprite.gDur || 1)), 0, 1)
    const eased = easeOutCubic(progress)
    return lerp(sprite.fromY || sprite.ty, sprite.ty, eased)
  }
  return (
    sprite.ty +
    (sprite.alive
      ? Math.sin(
          timestamp * 0.001 * (2 * Math.PI * sprite.speed) + sprite.phase,
        ) * sprite.bobAmp
      : 0)
  )
}
