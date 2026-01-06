"use client"

import { clamp } from './math'
import { WORLD_CENTER, WORLD_H, WORLD_W } from './constants'
import type { Holder } from './types'

type Vec2 = { x: number; y: number }

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasCustomAnchor(lm: Holder) {
  const ax = Number((lm as any).anchor_x ?? 0)
  const ay = Number((lm as any).anchor_y ?? 0)
  if (!isFiniteNumber(ax) || !isFiniteNumber(ay)) return false
  // Treat anchors within a pixel of world centre as unset (default)
  return Math.abs(ax - WORLD_CENTER.x) > 1 || Math.abs(ay - WORLD_CENTER.y) > 1
}

function ringCapacity(ring: number) {
  return 6 + ring * 6
}

function computeRingPosition(
  index: number,
  ring: number,
  capacity: number,
  radiusBase: number,
  radiusStep: number,
  margin: number,
): Vec2 {
  const angleStep = (Math.PI * 2) / capacity
  const angle = index * angleStep + ring * 0.12
  const radius = radiusBase + ring * radiusStep

  const aspectY = WORLD_H / WORLD_W
  const rawX = WORLD_CENTER.x + Math.cos(angle) * radius
  const rawY = WORLD_CENTER.y + Math.sin(angle) * radius * aspectY

  const minX = margin
  const maxX = WORLD_W - margin
  const minY = margin
  const maxY = WORLD_H - margin

  return {
    x: clamp(rawX, minX, maxX),
    y: clamp(rawY, minY, maxY),
  }
}

export function resolveLandmarkAnchors(landmarks: Holder[]) {
  const resolved = new Map<string, Vec2>()
  if (!Array.isArray(landmarks) || !landmarks.length) {
    return resolved
  }

  const sorted = [...landmarks].sort((a, b) => {
    const propA = Number((a as any).prop_id ?? 0)
    const propB = Number((b as any).prop_id ?? 0)
    if (propA !== propB) return propA - propB
    const addrA = String(a.address || '')
    const addrB = String(b.address || '')
    return addrA.localeCompare(addrB)
  })

  const defaults: Holder[] = []

  for (const lm of sorted) {
    const addrCanonical = String(lm.address || '').trim()
    if (!addrCanonical) continue
    if (hasCustomAnchor(lm)) {
      resolved.set(addrCanonical, {
        x: Number((lm as any).anchor_x),
        y: Number((lm as any).anchor_y),
      })
    } else {
      defaults.push(lm)
    }
  }

  if (defaults.length) {
    const minDim = Math.min(WORLD_W, WORLD_H)
    const radiusBase = minDim * 0.32
    const radiusStep = minDim * 0.16
    const margin = 120

    let ring = 0
    let indexInRing = 0
    let capacity = ringCapacity(ring)

    defaults.forEach((lm, i) => {
      if (indexInRing >= capacity) {
        ring += 1
        indexInRing = 0
        capacity = ringCapacity(ring)
      }
      const pos = computeRingPosition(
        indexInRing,
        ring,
        capacity,
        radiusBase,
        radiusStep,
        margin,
      )
      const addrCanonical = String(lm.address || '').trim()
      if (addrCanonical) {
        resolved.set(addrCanonical, pos)
      }
      indexInRing += 1
    })
  }

  return resolved
}
