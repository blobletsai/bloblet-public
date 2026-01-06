export type TierKind = 'top' | 'middle' | 'bottom'

export type HolderLayout = {
  tier: TierKind
  anchorX: number
  anchorY: number
}

export type TokenRowInput = {
  address: string
  address_canonical: string
  rank: number | null | undefined
}

export const SNAPSHOT_WORLD_WIDTH = 3840
export const SNAPSHOT_WORLD_HEIGHT = 2160
export const SNAPSHOT_WORLD_CENTER_X = SNAPSHOT_WORLD_WIDTH / 2
export const SNAPSHOT_WORLD_CENTER_Y = SNAPSHOT_WORLD_HEIGHT / 2

const GOLDEN_RATIO_CONJUGATE = 0.61803398875
const ANCHOR_MARGIN_X = 120
const ANCHOR_MARGIN_Y = 140
const ANCHOR_DECIMALS = 2
const COLLISION_RADIAL_ATTEMPTS = 64
const COLLISION_GRID_RINGS = 120
const COLLISION_GRID_STEP = 6
const COLLISION_COARSE_STEP = 20
const GLOBAL_MIN_SPACING = 45
const MIN_WORLD_X = ANCHOR_MARGIN_X
const MAX_WORLD_X = SNAPSHOT_WORLD_WIDTH - ANCHOR_MARGIN_X
const MIN_WORLD_Y = ANCHOR_MARGIN_Y
const MAX_WORLD_Y = SNAPSHOT_WORLD_HEIGHT - ANCHOR_MARGIN_Y

type TierLayoutConfig = {
  baseRadius: number
  maxRadius: number
  yScale: number
  jitterRadius: number
}

const TIER_LAYOUT: Record<TierKind, TierLayoutConfig> = {
  top: { baseRadius: 260, maxRadius: 460, yScale: 0.58, jitterRadius: 22 },
  middle: { baseRadius: 520, maxRadius: 860, yScale: 0.66, jitterRadius: 28 },
  bottom: { baseRadius: 900, maxRadius: 1400, yScale: 0.74, jitterRadius: 36 },
}

const TIER_MIN_SPACING: Record<TierKind, number> = {
  top: 120,
  middle: 95,
  bottom: 70,
}

type AnchorPoint = {
  x: number
  y: number
}

const DIRECTION_STEPS: AnchorPoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
]

export function hashUnit(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export function clampCoordinate(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return Math.min(Math.max((min + max) / 2, min), max)
  }
  if (value < min) return min
  if (value > max) return max
  return value
}

function roundCoordinate(value: number, min: number, max: number): number {
  const clamped = clampCoordinate(value, min, max)
  return Number(clamped.toFixed(ANCHOR_DECIMALS))
}

function sanitizeAnchorPoint(point: AnchorPoint): AnchorPoint {
  const x = Number.isFinite(point.x) ? point.x : SNAPSHOT_WORLD_CENTER_X
  const y = Number.isFinite(point.y) ? point.y : SNAPSHOT_WORLD_CENTER_Y
  return {
    x: roundCoordinate(x, MIN_WORLD_X, MAX_WORLD_X),
    y: roundCoordinate(y, MIN_WORLD_Y, MAX_WORLD_Y),
  }
}

function anchorKey(point: AnchorPoint): string {
  return `${point.x.toFixed(ANCHOR_DECIMALS)}:${point.y.toFixed(ANCHOR_DECIMALS)}`
}

function buildDirectionOrder(seed: string): AnchorPoint[] {
  const offset = Math.floor(hashUnit(`${seed}:dir`) * DIRECTION_STEPS.length) % DIRECTION_STEPS.length
  return DIRECTION_STEPS.map((_, idx) => DIRECTION_STEPS[(idx + offset) % DIRECTION_STEPS.length]!)
}

function computeRadiusFromCenter(point: AnchorPoint, config: TierLayoutConfig): number {
  const scale = config.yScale || 1
  const dx = point.x - SNAPSHOT_WORLD_CENTER_X
  const dy = (point.y - SNAPSHOT_WORLD_CENTER_Y) / scale
  return Math.sqrt(dx * dx + dy * dy)
}

const COARSE_GRID_POINTS = buildCoarseGridPoints()

function buildCoarseGridPoints(): AnchorPoint[] {
  const points: AnchorPoint[] = []
  for (let y = MIN_WORLD_Y; y <= MAX_WORLD_Y; y += COLLISION_COARSE_STEP) {
    for (let x = MIN_WORLD_X; x <= MAX_WORLD_X; x += COLLISION_COARSE_STEP) {
      points.push(sanitizeAnchorPoint({ x, y }))
    }
  }
  return points
}

type AnchorPlacement = {
  point: AnchorPoint
  minSpacing: number
}

function createAnchorAllocator() {
  const occupiedKeys = new Set<string>()
  const placements: AnchorPlacement[] = []

  function violatesSpacing(point: AnchorPoint, spacing: number): boolean {
    if (!placements.length) return false
    for (const placement of placements) {
      const limit = Math.max(spacing, placement.minSpacing, GLOBAL_MIN_SPACING)
      const threshold = limit * limit
      const dx = placement.point.x - point.x
      const dy = placement.point.y - point.y
      if (dx * dx + dy * dy < threshold) {
        return true
      }
    }
    return false
  }

  function claim(point: AnchorPoint, minSpacing: number): AnchorPoint | null {
    const sanitized = sanitizeAnchorPoint(point)
    const key = anchorKey(sanitized)
    if (occupiedKeys.has(key)) return null
    if (violatesSpacing(sanitized, minSpacing)) return null
    occupiedKeys.add(key)
    placements.push({ point: sanitized, minSpacing: Math.max(minSpacing, GLOBAL_MIN_SPACING) })
    return sanitized
  }

  function resolve(address: string, origin: AnchorPoint, config: TierLayoutConfig, baseAngle: number, minSpacing: number): AnchorPoint {
    const directions = buildDirectionOrder(address)
    const baseStep = Math.max(COLLISION_GRID_STEP, Math.round(config.jitterRadius) || COLLISION_GRID_STEP)
    for (let ring = 1; ring <= COLLISION_GRID_RINGS; ring += 1) {
      const distance = ring * baseStep
      for (const dir of directions) {
        const candidate = sanitizeAnchorPoint({
          x: origin.x + dir.x * distance,
          y: origin.y + dir.y * distance,
        })
        const claimed = claim(candidate, minSpacing)
        if (claimed) return claimed
      }
    }

    const baseRadius = computeRadiusFromCenter(origin, config)
    const spinSeed = hashUnit(`${address}:spin`)
    for (let attempt = 1; attempt <= COLLISION_RADIAL_ATTEMPTS; attempt += 1) {
      const ratio = attempt * GOLDEN_RATIO_CONJUGATE
      const attemptAngle = baseAngle + (spinSeed + ratio) * Math.PI * 2
      const radialDelta = attempt * (config.jitterRadius + COLLISION_GRID_STEP)
      const targetRadius = Math.min(
        config.maxRadius + config.jitterRadius * 2,
        Math.max(config.baseRadius * 0.5, baseRadius + radialDelta),
      )
      const candidate = sanitizeAnchorPoint({
        x: SNAPSHOT_WORLD_CENTER_X + Math.cos(attemptAngle) * targetRadius,
        y: SNAPSHOT_WORLD_CENTER_Y + Math.sin(attemptAngle) * targetRadius * config.yScale,
      })
      const claimed = claim(candidate, minSpacing)
      if (claimed) return claimed
    }

    const startIndex = Math.floor(hashUnit(`${address}:grid`) * COARSE_GRID_POINTS.length) % COARSE_GRID_POINTS.length
    for (let i = 0; i < COARSE_GRID_POINTS.length; i += 1) {
      const candidate = COARSE_GRID_POINTS[(startIndex + i) % COARSE_GRID_POINTS.length]!
      const claimed = claim(candidate, minSpacing)
      if (claimed) return claimed
    }

    return origin
  }

  function allocate(address: string, origin: AnchorPoint, config: TierLayoutConfig, baseAngle: number, tier: TierKind): AnchorPoint {
    const minSpacing = Math.max(TIER_MIN_SPACING[tier] ?? GLOBAL_MIN_SPACING, GLOBAL_MIN_SPACING)
    const claimed = claim(origin, minSpacing)
    if (claimed) return claimed
    return resolve(address, sanitizeAnchorPoint(origin), config, baseAngle, minSpacing)
  }

  return { allocate }
}

export function tierForRank(rank: number | null | undefined): TierKind {
  if (!Number.isFinite(rank) || !rank || rank <= 0) return 'bottom'
  if (rank <= 20) return 'top'
  if (rank <= 70) return 'middle'
  return 'bottom'
}

export function deriveHolderLayout(rows: TokenRowInput[]): Map<string, HolderLayout> {
  const buckets: Record<TierKind, TokenRowInput[]> = { top: [], middle: [], bottom: [] }
  for (const row of rows) {
    const tier = tierForRank(row.rank)
    buckets[tier].push(row)
  }

  const layouts = new Map<string, HolderLayout>()
  const allocator = createAnchorAllocator()
  for (const tierKey of Object.keys(buckets) as TierKind[]) {
    const list = buckets[tierKey]
    if (!list.length) continue
    const config = TIER_LAYOUT[tierKey]
    const span = Math.max(0, config.maxRadius - config.baseRadius)
    const count = list.length
    for (let idx = 0; idx < count; idx += 1) {
      const entry = list[idx]!
      const canonical = String(entry.address_canonical || entry.address || '').trim()
      if (!canonical) continue
      const hashKey = canonical
      const base = hashUnit(hashKey)
      const angleCycle = (base + (idx * GOLDEN_RATIO_CONJUGATE)) % 1
      const angle = angleCycle * Math.PI * 2
      const ratio = count > 1 ? idx / Math.max(1, count - 1) : 0
      const radialBase = config.baseRadius + ratio * span
      const jitter = (hashUnit(`${hashKey}:r`) - 0.5) * config.jitterRadius
      const radius = Math.max(config.baseRadius * 0.85, Math.min(config.maxRadius, radialBase + jitter))
      const xRaw = SNAPSHOT_WORLD_CENTER_X + Math.cos(angle) * radius
      const yRaw = SNAPSHOT_WORLD_CENTER_Y + Math.sin(angle) * radius * config.yScale
      const anchor = allocator.allocate(canonical, { x: xRaw, y: yRaw }, config, angle, tierKey)
      layouts.set(canonical, {
        tier: tierKey,
        anchorX: anchor.x,
        anchorY: anchor.y,
      })
    }
  }

  return layouts
}

export function gateThresholdRaw(decimals: number, unitsRaw: string): bigint {
  const match = unitsRaw.match(/^[0-9]+/)
  if (!match) return 0n
  const units = BigInt(match[0])
  if (units === 0n) return 0n
  const scale = 10n ** BigInt(Number.isFinite(decimals) ? Math.max(0, Math.floor(decimals)) : 0)
  return units * scale
}
