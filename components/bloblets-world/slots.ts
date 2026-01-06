"use client"

import { clamp, hash32, rngSeed } from './math'
import { SpatialGrid } from './spatialGrid'
import {
  SIZE_SCALE_FOR_BOB,
  STAGGER_BUDGET_MS,
  TARGET_SIZES,
  TIERS,
  WORLD_CENTER,
  WORLD_H,
  WORLD_W,
  DEAD_FRACTION_DEMO,
} from './constants'
import type { Holder, Slot, Sprite } from './types'
import { resolveLandmarkAnchors } from './landmarkLayout'

const POCKETS = [
  { x: 0.20, y: 0.72, w: 0.26, h: 0.22, k: 2.4 },
  { x: 0.38, y: 0.56, w: 0.22, h: 0.16, k: 1.6 },
  { x: 0.62, y: 0.56, w: 0.22, h: 0.16, k: 1.6 },
  { x: 0.50, y: 0.78, w: 0.34, h: 0.20, k: 1.1 },
  { x: 0.15, y: 0.28, w: 0.18, h: 0.12, k: 0.8 },
  { x: 0.85, y: 0.28, w: 0.18, h: 0.12, k: 0.8 },
]

function densityAtNorm(nx: number, ny: number) {
  let density = 0
  for (const pocket of POCKETS) {
    const dx = (nx - pocket.x) / pocket.w
    const dy = (ny - pocket.y) / pocket.h
    const d = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy))
    density += pocket.k * d
  }
  return Math.min(1, density)
}

export function generateReferenceSlotsAsync(counts: number[], radii: number[]): Promise<Slot[][]> {
  return new Promise((resolve) => {
    const total = counts.reduce((a, b) => a + b, 0)
    const skeletonTotal = Math.min(400, total)
    const skeleton = counts.map((c) => Math.floor(c * (skeletonTotal / Math.max(1, total))))
    let diff = skeletonTotal - skeleton.reduce((a, b) => a + b, 0)
    const skLen = skeleton.length || 1
    for (let i = 0; diff > 0; i = (i + 1) % skLen) {
      skeleton[i % skLen]! = (skeleton[i % skLen] ?? 0) + 1
      diff--
    }

    const byTier: Slot[][] = counts.map(() => [])
    const minR = radii.length ? Math.min(...radii) : 8
    const grid = new SpatialGrid(Math.max(8, Math.floor(minR * 0.9)))
    const all: Slot[] = []
    const remaining = counts.map((c, i) => c - (skeleton[i] ?? 0))

    function placeOne(nx: number, ny: number, R: number) {
      const x = nx * WORLD_W
      const y = ny * WORLD_H
      if (x < R + 1 || y < R + 1 || x > WORLD_W - R - 1 || y > WORLD_H - R - 1) return false
      const neigh = grid.neighbors(x, y, R * 2.4)
      for (const j of neigh) {
        const s = all[j]!
        const dx = s.x - x
        const dy = s.y - y
        const sRadius = s.r * ((s as any).sizeMultiplier || 1.0)
        if (dx * dx + dy * dy < (sRadius + R + 1) * (sRadius + R + 1)) return false
      }
      const id = all.push({ x, y, tier: 0, r: R }) - 1
      grid.insertIndex(id, x, y)
      return id
    }

    function samplePocket() {
      const weights = POCKETS.map((p) => p.k)
      const sum = weights.reduce((a, b) => a + b, 0)
      let r = Math.random() * sum
      let idx = 0
      for (; idx < weights.length; idx++) {
        r -= weights[idx]!
        if (r <= 0) break
      }
      const p = POCKETS[Math.min(idx, POCKETS.length - 1)]!
      const th = Math.random() * Math.PI * 2
      const rr = Math.sqrt(Math.random())
      const nx = clamp(p.x + Math.cos(th) * p.w * 0.6 * rr, 0.02, 0.98)
      const ny = clamp(p.y + Math.sin(th) * p.h * 0.6 * rr, 0.02, 0.98)
      return { nx, ny }
    }

    function sampleAnywhere() {
      const nx = clamp(0.02 + 0.96 * Math.random(), 0.02, 0.98)
      const ny = clamp(0.02 + 0.96 * Math.random(), 0.02, 0.98)
      return { nx, ny }
    }

    let t = 0
    let phase: 'skeleton' | 'fill' = 'skeleton'
    const STEPS_PER_FRAME = 800

    function step() {
      let attempts = 0
      while (attempts < STEPS_PER_FRAME) {
        attempts++
        while (t < TIERS && ((phase === 'skeleton' && byTier[t]!.length >= skeleton[t]!) || (phase === 'fill' && remaining[t]! <= 0))) t++
        if (t >= TIERS) {
          if (phase === 'skeleton') {
            phase = 'fill'
            t = 0
            continue
          }
          resolve(byTier)
          return
        }
        const useFallback = phase === 'fill' && attempts % 64 === 0
        const { nx, ny } = useFallback ? sampleAnywhere() : samplePocket()
        const bias = phase === 'fill' && t >= 3 ? 0.15 : 0.0
        if (!useFallback && Math.random() > Math.min(1, densityAtNorm(nx, ny) + bias)) continue
        const R = radii[t]!
        const id = placeOne(nx, ny, R)
        if (id === false) continue
        const slot = all[id as number]!
        slot.tier = t
        byTier[t]!.push(slot)
        if (phase === 'fill') remaining[t]!--
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

export function demoSnapshot(n = 1000): Holder[] {
  const rng = rngSeed(0xB10B1E7 ^ n)
  const holders: Holder[] = []
  let bal = 1_000_000
  for (let i = 0; i < n; i++) {
    bal = Math.max(1, Math.floor(bal * (0.985 + 0.02 * rng())))
    const addr =
      '0x' +
      hash32('addr' + i).toString(16).padStart(8, '0') +
      hash32('x' + i).toString(16).padStart(8, '0')
    const alive = rng() > DEAD_FRACTION_DEMO
    holders.push({ address: addr, balance: bal, is_alive: alive, tier: 'middle' })
  }
  return holders
}

export function bucketHolders(holders: Holder[]) {
  const N = holders.length
  const sorted = [...holders].sort((a, b) => (b.balance || 0) - (a.balance || 0))
  for (let i = 0; i < N; i++) {
    const h = sorted[i] as any
    if (h.tier === 'top') h.tier = 0
    else if (h.tier === 'middle') h.tier = 1
    else if (h.tier === 'bottom') h.tier = 2
    else {
      const q = i / Math.max(1, N - 1)
      const tier = q < 0.1 ? 0 : q < 0.25 ? 1 : q < 0.55 ? 2 : 3
      h.tier = tier
    }
  }
  return sorted
}

export function tierCountsFor(N: number) {
  const ratios = [10, 15, 30, 45]
  const total = ratios.reduce((a, b) => a + b, 0)
  const counts = ratios.map((r) => Math.max(1, Math.floor((r / total) * N)))
  const last = Math.max(0, counts.length - 1)
  counts[last] = (counts[last] ?? 0) + (N - counts.reduce((a, b) => a + b, 0))
  return counts
}

export function enforceSpriteSeparation(sprites: Sprite[]) {
  if (!Array.isArray(sprites) || !sprites.length) return

  const landmarkSprites = sprites.filter((s) => String(s.address || '').startsWith('landmark_'))
  const blobSprites = sprites.filter((s) => !String(s.address || '').startsWith('landmark_'))
  const placeholderSprite = blobSprites.find((s) => s.address === 'placeholder_sprite') as (Sprite & {
    sizeMultiplier?: number
  }) | undefined

  const blobRadius = (sprite: Sprite) => sprite.r * ((sprite as any).sizeMultiplier || 1.0)

  const landmarkPadding = 18
  if (landmarkSprites.length && blobSprites.length) {
    for (const blob of blobSprites) {
      if (blob.address === 'placeholder_sprite') continue
      const blobR = blobRadius(blob)
      for (const landmark of landmarkSprites) {
        const landmarkR = blobRadius(landmark)
        const required = blobR + landmarkR + landmarkPadding
        let dx = blob.tx - landmark.tx
        let dy = blob.ty - landmark.ty
        let dist = Math.hypot(dx, dy)
        if (dist < required) {
          if (dist < 1e-3) {
            const seed = hash32(`${blob.address}:${landmark.address}`) || 1
            const angle = (seed % 360) * (Math.PI / 180)
            dx = Math.cos(angle)
            dy = Math.sin(angle)
            dist = 1
          } else {
            dx /= dist
            dy /= dist
          }
          blob.tx = landmark.tx + dx * required
          blob.ty = landmark.ty + dy * required
          blob.x = blob.tx
          blob.y = blob.ty
        }
      }
    }
  }

  if (placeholderSprite) {
    placeholderSprite.tx = WORLD_CENTER.x
    placeholderSprite.ty = WORLD_CENTER.y
    placeholderSprite.x = WORLD_CENTER.x
    placeholderSprite.y = WORLD_CENTER.y
    const placeholderR = blobRadius(placeholderSprite)
    const placeholderPadding = 24
    for (const blob of blobSprites) {
      if (blob === placeholderSprite) continue
      const blobR = blobRadius(blob)
      const required = placeholderR + blobR + placeholderPadding
      let dx = blob.tx - placeholderSprite.tx
      let dy = blob.ty - placeholderSprite.ty
      let dist = Math.hypot(dx, dy)
      if (dist < required) {
        if (dist < 1e-3) {
          const seed = hash32(`${blob.address}:placeholder`) || 1
          const angle = (seed % 360) * (Math.PI / 180)
          dx = Math.cos(angle)
          dy = Math.sin(angle)
          dist = 1
        } else {
          dx /= dist
          dy /= dist
        }
        blob.tx = placeholderSprite.tx + dx * required
        blob.ty = placeholderSprite.ty + dy * required
        blob.x = blob.tx
        blob.y = blob.ty
      }
    }
  }

  if (blobSprites.length > 1) {
    const blobPadding = 8
    const grid = new SpatialGrid(96)
    for (let i = 0; i < blobSprites.length; i++) {
      grid.insertIndex(i, blobSprites[i]!.tx, blobSprites[i]!.ty)
    }
    for (let i = 0; i < blobSprites.length; i++) {
      const a = blobSprites[i]!
      if (a.address === 'placeholder_sprite') continue
      const aRadius = blobRadius(a)
      const neigh = grid.neighbors(a.tx, a.ty, aRadius * 2 + blobPadding * 2)
      for (const j of neigh) {
        if (j <= i) continue
        const b = blobSprites[j]!
        if (b.address === 'placeholder_sprite') continue
        const bRadius = blobRadius(b)
        const required = aRadius + bRadius + blobPadding
        let dx = b.tx - a.tx
        let dy = b.ty - a.ty
        let dist = Math.hypot(dx, dy)
        if (dist < required) {
          if (dist < 1e-3) {
            const seed = hash32(`${a.address}:${b.address}`) || 1
            const angle = (seed % 360) * (Math.PI / 180)
            dx = Math.cos(angle)
            dy = Math.sin(angle)
            dist = 1
          } else {
            dx /= dist
            dy /= dist
          }
          const push = (required - dist) * 0.5
          a.tx -= dx * push
          a.ty -= dy * push
          b.tx += dx * push
          b.ty += dy * push
          a.x = a.tx
          a.y = a.ty
          b.x = b.tx
          b.y = b.ty
        }
      }
    }
  }
}

export function assignHoldersToSlots(holders: Holder[], byTierSlots: Slot[][]) {
  const landmarks = holders.filter((h) => h.entity_type === 'landmark')
  const regularHolders = holders.filter((h) => h.entity_type !== 'landmark')

  const sprites: Sprite[] = []
  const used: boolean[][] = byTierSlots.map((a) => new Array(a.length).fill(false))

  const LANDMARK_BASE_SIZES: Record<string, number> = {
    tree: 140,
    bush: 90,
    rock: 110,
    campfire: 105,
    bonfire: 120,
    boulder: 120,
    spire: 160,
    tower: 175,
    generator: 150,
    sanctum: 155,
    monolith: 150,
    barricade: 165,
    ward: 150,
    obelisk: 155,
    thicket: 145,
  }

  const landmarkAnchors = resolveLandmarkAnchors(landmarks)

  for (const lm of landmarks) {
    const addrKey = String(lm.address || '').trim()
    const anchor = landmarkAnchors.get(addrKey)
    if (!anchor) continue
    const propTypeRaw = String(lm.prop_type || '').toLowerCase()
    const propCategory = propTypeRaw.split(':')[0]
    const propType = propTypeRaw || propCategory || ''
    const baseSize = LANDMARK_BASE_SIZES[propTypeRaw] ?? LANDMARK_BASE_SIZES[propCategory!] ?? 140
    const baseRadius = baseSize / 2
    const sizeMultiplier = Math.max(0.5, Number(lm.size_multiplier || 2.0))
    const effectiveRadius = baseRadius * sizeMultiplier

    const ownerCased = lm.last_owner ? String(lm.last_owner).trim() : null
    const ownerCanonical = ownerCased || null
    const sprite: any = {
      address: lm.address,
      tier: 0,
      alive: true,
      tx: anchor.x,
      ty: anchor.y,
      r: baseRadius,
      x: anchor.x,
      y: anchor.y,
      vx: 0,
      vy: 0,
      mass: Math.max(1, effectiveRadius * effectiveRadius * 0.0005),
      alpha: 0,
      scaleBump: 0.2,
      phase: 0,
      speed: 0,
      bobAmp: 0,
      entryDelay: Math.random() * 200,
      mode: 'entry',
      name: propType,
      sizeMultiplier,
      entityType: 'landmark',
      landmarkId: lm.prop_id != null ? Number(lm.prop_id) : null,
      landmarkType: propType || null,
      landmarkName: lm.name != null ? String(lm.name) : null,
      renameCount: Number((lm as any).rename_count || 0),
      ownerAddress: ownerCanonical,
      ownerAddressCased: ownerCased,
      landmarkPrice: Number((lm as any).landmark_price_rp || 0),
    }

    if (lm.avatar_alive_url_256) {
      sprite.aliveKey = lm.avatar_alive_url_256.trim()
    }

    sprites.push(sprite)
  }

  for (const h of regularHolders) {
    if (h.address === 'placeholder_sprite') {
      const placeholderRadius = 150
      const mass = Math.max(1, placeholderRadius * placeholderRadius * 0.0005)
      sprites.push({
        address: h.address,
        tier: 0,
        alive: h.is_alive,
        tx: WORLD_CENTER.x,
        ty: WORLD_CENTER.y,
        r: placeholderRadius,
        x: WORLD_CENTER.x,
        y: WORLD_CENTER.y,
        vx: 0,
        vy: 0,
        mass,
        alpha: 0,
        scaleBump: 0.2,
        phase: 0,
        speed: 0.3,
        bobAmp: 2,
        entryDelay: 0,
        mode: 'entry',
        name: 'Mystery Bloblet',
        sizeMultiplier: Math.max(3, Number((h as any).size_multiplier || 0)) || 3.0,
      } as Sprite & { sizeMultiplier: number })
      continue
    }

    const tRaw = (h as any).tier as number
    const t = Number.isFinite(tRaw) ? Math.max(0, Math.min(TIERS - 1, Math.floor(tRaw))) : 0
    let tierSel = t
    let slots = byTierSlots[tierSel]
    if (!slots || slots.length === 0) continue
    if (!used[tierSel] || used[tierSel]!.length !== slots.length) used[tierSel] = new Array(slots.length).fill(false)
    let usedTier = used[tierSel]!
    const base = Math.abs(hash32(h.address)) % Math.max(1, slots.length)
    let idx = -1
    for (let k = 0; k < slots.length; k++) {
      const i = (base + k) % slots.length
      if (!usedTier[i]) {
        idx = i
        break
      }
    }
    if (idx < 0) {
      outer: for (let pass = 0; pass < 2; pass++) {
        const dir: number[] = pass === 0 ? [t + 1, t + 2, t + 3] : [t - 1, t - 2, t - 3]
        for (const off of dir) {
          const tt = ((off % TIERS) + TIERS) % TIERS
          const sl = byTierSlots[tt]
          if (!sl || sl.length === 0) continue
          if (!used[tt] || used[tt]!.length !== sl.length) used[tt] = new Array(sl.length).fill(false)
          const u = used[tt]!
          for (let j = 0; j < sl.length; j++) {
            if (!u[j]) {
              tierSel = tt
              slots = sl
              usedTier = u
              idx = j
              break outer
            }
          }
        }
      }
    }
    if (idx < 0) idx = 0
    usedTier[idx] = true
    const s = slots[idx]
    if (!s) continue
    const mass = Math.max(1, s.r * s.r * 0.0005)
    const bobScale = SIZE_SCALE_FOR_BOB[Math.max(0, Math.min(SIZE_SCALE_FOR_BOB.length - 1, tierSel))] || 1
    const finalX = (h as any).anchor_x || WORLD_CENTER.x
    const finalY = (h as any).anchor_y || WORLD_CENTER.y
    let deterministicX = finalX
    let deterministicY = finalY

    if (!(h as any).anchor_x || !(h as any).anchor_y) {
      deterministicX =
        WORLD_CENTER.x + ((hash32(h.address + 'x') % 1000) / 1000 - 0.5) * WORLD_W * 0.8
      deterministicY =
        WORLD_CENTER.y + ((hash32(h.address + 'y') % 1000) / 1000 - 0.5) * WORLD_H * 0.8
    }

    sprites.push({
      address: h.address,
      tier: tierSel,
      alive: h.is_alive,
      tx: deterministicX,
      ty: deterministicY,
      r: s.r,
      x: deterministicX,
      y: deterministicY,
      vx: 0,
      vy: 0,
      mass,
      alpha: 0,
      scaleBump: 0.2,
      phase: (hash32(h.address) % 1000) / 1000 * Math.PI * 2,
      speed: 0.25 + ((hash32(h.address + 'v') % 1000) / 1000) * 0.25,
      bobAmp: 2 * bobScale,
      entryDelay: 0,
      mode: 'entry',
      name: (h as any).name || undefined,
      sizeMultiplier: Number((h as any).size_multiplier || 1.0) || 1.0,
      entityType: 'bloblet',
    })
  }

  enforceSpriteSeparation(sprites)
  return sprites
}
