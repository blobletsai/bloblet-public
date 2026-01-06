import { afterEach, describe, expect, it, vi } from 'vitest'

import { deriveHolderLayout } from '@/src/shared/holders/layout'

describe('deriveHolderLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ensures anchors remain unique even if trig math collapses coordinates', () => {
    vi.spyOn(Math, 'cos').mockReturnValue(0)
    vi.spyOn(Math, 'sin').mockReturnValue(0)
    const rows = Array.from({ length: 18 }, (_, idx) => ({
      address: `holder-${idx}`,
      address_canonical: `holder-${idx}`,
      rank: idx + 1,
    }))
    const layoutMap = deriveHolderLayout(rows)
    expect(layoutMap.size).toBe(rows.length)
    const seen = new Set<string>()
    for (const layout of layoutMap.values()) {
      const key = `${layout.anchorX}:${layout.anchorY}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('keeps tier-specific spacing so sprites have breathing room', () => {
    const rows = Array.from({ length: 25 }, (_, idx) => ({
      address: `top-holder-${idx}`,
      address_canonical: `top-holder-${idx}`,
      rank: idx + 1,
    }))
    const layoutMap = deriveHolderLayout(rows)
    const layouts = Array.from(layoutMap.values())
    let minDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < layouts.length; i += 1) {
      for (let j = i + 1; j < layouts.length; j += 1) {
        const dx = layouts[i]!.anchorX - layouts[j]!.anchorX
        const dy = layouts[i]!.anchorY - layouts[j]!.anchorY
        const dist = Math.hypot(dx, dy)
        if (dist < minDistance) minDistance = dist
      }
    }
    expect(minDistance).toBeGreaterThan(100)
  })
})
