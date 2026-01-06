import {
  clamp,
  easeInOutCubic,
  easeOutBack,
  lerp,
} from './math'
import {
  ENTRY_TOTAL_BUDGET_MS,
  WORLD_CENTER,
} from './constants'
import type { Sprite } from './types'
import { SpatialGrid } from './spatialGrid'

type WorldState = {
  entryActive: boolean
  entryEndBy?: number
  entryStart: number
  entryDur: number
  pressureK0: number
  pressureDecayMs: number
  springK0: number
  springK1: number
  damping: number
  pbdIters: number
  sprites: Sprite[]
}

export function runEntryPhysics(
  state: WorldState,
  dt: number,
  now: number,
  grid: SpatialGrid,
) {
  if (!state.entryActive) return

  const endBy = state.entryEndBy || state.entryStart + ENTRY_TOTAL_BUDGET_MS
  const tN = clamp((now - state.entryStart) / state.entryDur, 0, 1)
  const kP =
    state.pressureK0 * (1 - clamp((now - state.entryStart) / state.pressureDecayMs, 0, 1))
  const kS = lerp(state.springK0, state.springK1, easeInOutCubic(tN))
  const damp = Math.pow(state.damping, dt)

  for (const sprite of state.sprites) {
    if (sprite.mode !== 'entry') continue
    if (now - state.entryStart < sprite.entryDelay) continue
    let dx = sprite.x - WORLD_CENTER.x
    let dy = sprite.y - WORLD_CENTER.y
    let L = Math.hypot(dx, dy)
    if (L < 1e-3) {
      dx = Math.random() - 0.5
      dy = Math.random() - 0.5
      L = Math.hypot(dx, dy)
    }
    dx /= L
    dy /= L
    let fx = dx * kP
    let fy = dy * kP
    fx += (sprite.tx - sprite.x) * kS
    fy += (sprite.ty - sprite.y) * kS
    sprite.vx = (sprite.vx + (fx / sprite.mass) * dt) * damp
    sprite.vy = (sprite.vy + (fy / sprite.mass) * dt) * damp
    sprite.x += sprite.vx * dt
    sprite.y += sprite.vy * dt
    sprite.alpha = clamp(tN * 1.2, 0, 1)
    sprite.scaleBump = 0.2 + 0.88 * easeOutBack(tN)
    const dLeft = Math.hypot(sprite.tx - sprite.x, sprite.ty - sprite.y)
    const speed = Math.hypot(sprite.vx, sprite.vy)
    if (dLeft <= Math.max(0.1 * sprite.r, 0.5) && speed <= 0.8) {
      sprite.mode = 'glide'
      sprite.gStart = now
      sprite.gDur = 180 + Math.random() * 140
      sprite.fromX = sprite.x
      sprite.fromY = sprite.y
      sprite.fromScale = sprite.scaleBump
      sprite.vx = 0
      sprite.vy = 0
    } else if (now >= endBy) {
      sprite.mode = 'glide'
      sprite.gStart = now
      sprite.gDur = Math.max(80, Math.min(280, endBy - now))
      sprite.fromX = sprite.x
      sprite.fromY = sprite.y
      sprite.fromScale = sprite.scaleBump
      sprite.vx = 0
      sprite.vy = 0
    }
  }

  for (let iter = 0; iter < state.pbdIters; iter++) {
    grid.clear()
    for (let i = 0; i < state.sprites.length; i++) {
      const sprite = state.sprites[i]!
      if (sprite.mode === 'entry') {
        grid.insertIndex(i, sprite.x, sprite.y)
      }
    }
    for (let i = 0; i < state.sprites.length; i++) {
      const a = state.sprites[i]!
      if (a.mode !== 'entry') continue
      const aRadius = a.r * ((a as any).sizeMultiplier || 1.0)
      const neighbors = grid.neighbors(a.x, a.y, aRadius * 2.2)
      for (const j of neighbors) {
        if (j <= i) continue
        const b = state.sprites[j]!
        if (b.mode !== 'entry') continue
        const bRadius = b.r * ((b as any).sizeMultiplier || 1.0)
        let dx = b.x - a.x
        let dy = b.y - a.y
        const d2 = dx * dx + dy * dy
        const minD = aRadius + bRadius
        if (d2 >= minD * minD) continue
        const d = Math.max(1e-4, Math.sqrt(d2))
        const overlap = minD - d
        dx /= d
        dy /= d
        const wA = 1 / a.mass
        const wB = 1 / b.mass
        const sum = wA + wB
        const nearA = Math.hypot(a.tx - a.x, a.ty - a.y) < 0.2 * aRadius
        const nearB = Math.hypot(b.tx - b.x, b.ty - b.y) < 0.2 * bRadius
        const soften = nearA || nearB ? 0.5 : 1.0
        const pushA = (overlap * 0.5 * soften) * (wA / sum)
        const pushB = (overlap * 0.5 * soften) * (wB / sum)
        a.x -= dx * pushA
        a.y -= dy * pushA
        b.x += dx * pushB
        b.y += dy * pushB
      }
    }
  }

  state.entryActive =
    (state.sprites.some((s) => s.mode === 'entry') ||
      state.sprites.some((s) => s.mode === 'glide')) &&
    now < (state.entryEndBy || 0) + 200

  if (!state.entryActive) {
    for (const sprite of state.sprites) {
      if (sprite.mode !== 'idle') {
        sprite.mode = 'idle'
        sprite.x = sprite.tx + (Math.random() - 0.5) * 5
        sprite.y = sprite.ty + (Math.random() - 0.5) * 5
      }
    }
  }
}

export function resolveIdleCollisions(state: WorldState, dt: number) {
  if (state.entryActive) return

  for (let i = 0; i < state.sprites.length; i++) {
    const a = state.sprites[i]!
    if (a.mode !== 'idle') continue
    for (let j = i + 1; j < state.sprites.length; j++) {
      const b = state.sprites[j]!
      if (b.mode !== 'idle') continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const aRadius = a.r * ((a as any).sizeMultiplier || 1.0)
      const bRadius = b.r * ((b as any).sizeMultiplier || 1.0)
      const minDist = (aRadius + bRadius) * 0.9
      if (dist >= minDist || dist <= 0.1) continue
      const push = (minDist - dist) * 0.02 * dt * 60
      const pushX = (dx / dist) * push
      const pushY = (dy / dist) * push
      a.x -= pushX
      a.y -= pushY
      b.x += pushX
      b.y += pushY
    }
  }
}
