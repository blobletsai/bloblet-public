"use client"

import { TOP_SIZE } from './constants'

const PROP_HEIGHT_U: Record<string, number> = {
  tree: 1.22,
  bush: 0.71,
  rock: 0.51,
  boulder: 0.61,
  campfire: 0.41,
  animal: 0.6,
  house: 3.8,
  playground: 2.8,
  statue: 2.2,
  'shop:cafe': 3.0,
  'shop:salon': 3.0,
  'shop:grocery': 3.2,
  'shop:mall': 3.6,
}

const FIXED_LANDMARK_HEIGHTS: Record<string, number> = {
  tree: 120,
  bush: 70,
  rock: 50,
  boulder: 60,
  campfire: 40,
}

const U = TOP_SIZE

export function targetPropHeightPx(type: string, scale: number | null | undefined) {
  const t = String(type || '').toLowerCase()

  if (FIXED_LANDMARK_HEIGHTS[t]) {
    return FIXED_LANDMARK_HEIGHTS[t]
  }

  const baseU = PROP_HEIGHT_U[t] ?? 1.2
  const userScale = Number(scale || 1)
  const s = Math.max(0.4, Math.min(2.5, userScale))
  return Math.max(8, Math.round(baseU * U * s))
}
