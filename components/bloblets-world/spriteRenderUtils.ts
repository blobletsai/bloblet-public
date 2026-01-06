import { clamp, easeOutCubic, lerp } from './math'
import type { Frame, Sprite } from './types'

export interface SpriteFrameState {
  framesAliveMap: Map<string, Frame[]>
  framesDeadMap: Map<string, Frame[]>
  framesAlive: Frame[]
  framesDead: Frame[]
}

export function resolveSpriteFrame(
  state: SpriteFrameState,
  sprite: Sprite,
): Frame | null {
  let frameSet: Frame[] | undefined
  const aliveKey = (sprite as any).aliveKey
  const deadKey = (sprite as any).deadKey

  if (aliveKey && sprite.alive) {
    frameSet = state.framesAliveMap.get(aliveKey)
  } else if (deadKey && !sprite.alive) {
    frameSet = state.framesDeadMap.get(deadKey)
  }

  const frames = frameSet || (sprite.alive ? state.framesAlive : state.framesDead)
  const frame = frames?.[sprite.tier]
  return frame ?? null
}

export interface SpriteWorldTransform {
  wx: number
  wy: number
  scaleB: number
  alpha: number
  shouldResetMode: boolean
}

export function computeSpriteWorldTransform(
  sprite: Sprite,
  now: number,
  t: number,
): SpriteWorldTransform {
  let wx = sprite.tx
  let wy = sprite.ty
  let scaleB = 1
  let alpha = 1
  let shouldResetMode = false

  if (sprite.mode === 'entry') {
    wx = sprite.x
    wy = sprite.y
    scaleB = sprite.scaleBump
    alpha = sprite.alpha
  } else if (sprite.mode === 'glide') {
    const tt = clamp(((now - (sprite.gStart || now)) / (sprite.gDur || 1)), 0, 1)
    const e = easeOutCubic(tt)
    wx = lerp(sprite.fromX || sprite.tx, sprite.tx, e)
    wy = lerp(sprite.fromY || sprite.ty, sprite.ty, e)
    scaleB = lerp(sprite.fromScale || 1, 1, e)
    if (tt >= 1) {
      shouldResetMode = true
    }
  } else {
    wy =
      sprite.ty +
      (sprite.alive
        ? Math.sin(t * 0.001 * (2 * Math.PI * sprite.speed) + sprite.phase) * sprite.bobAmp
        : 0)
  }

  return { wx, wy, scaleB, alpha, shouldResetMode }
}
