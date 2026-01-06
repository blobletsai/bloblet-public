import { shortAddress } from '@/src/shared/pvp'
import { clamp, easeOutCubic, lerp } from '../math'
import { TIERS } from '../constants'
import type { Frame, Sprite } from '../types'
import { computeWorldY } from './geometry'
import { VISUAL_THEME } from '../visualTheme'

const MIN_ZOOM_THRESHOLD = 1.0
const MAX_ZOOM_THRESHOLD = 1.8
const LEGACY_ZOOM_THRESHOLDS = [1.0, 1.1, 1.35, 1.8]

const ZOOM_LABEL_THRESHOLDS = (() => {
  if (TIERS <= 0) return [MIN_ZOOM_THRESHOLD]
  if (TIERS <= LEGACY_ZOOM_THRESHOLDS.length) {
    return LEGACY_ZOOM_THRESHOLDS.slice(0, TIERS)
  }
  const result = [...LEGACY_ZOOM_THRESHOLDS]
  const lastLegacy = result.at(-1) ?? MIN_ZOOM_THRESHOLD
  const extraSlots = TIERS - result.length
  const rawStep = extraSlots > 0 ? (MAX_ZOOM_THRESHOLD - lastLegacy) / extraSlots : 0
  const step = rawStep > 0 ? rawStep : 0.1
  while (result.length < TIERS) {
    const previous = result.at(-1) ?? MIN_ZOOM_THRESHOLD
    const next = Number(Math.min(MAX_ZOOM_THRESHOLD, previous + step).toFixed(3))
    result.push(next)
  }
  return result
})()

export interface RenderZoomLabelsOptions {
  context: CanvasRenderingContext2D
  state: any
  framesReady: boolean
  timestamp: number
  now: number
  width: number
  height: number
  visMargin: number
}

export function renderZoomLabels({
  context: ctx,
  state,
  framesReady,
  timestamp,
  now,
  width,
  height,
  visMargin,
}: RenderZoomLabelsOptions) {
  // Initialize alpha map if missing
  if (!state.labelAlphaMap) {
    state.labelAlphaMap = new Map<string, number>()
  }
  const alphaMap = state.labelAlphaMap as Map<string, number>

  const thresholds =
    Array.isArray(state.zoomLabelThresholds) && state.zoomLabelThresholds.length
      ? state.zoomLabelThresholds
      : ZOOM_LABEL_THRESHOLDS
  const zoom = state.scale
  const cap = zoom < 1.2 ? 80 : zoom < 1.6 ? 160 : 320
  
  if (!framesReady || zoom < 1.0) {
    // If we're zoomed out too far, fade everyone out
    for (const [key, val] of alphaMap) {
      const next = Math.max(0, val - VISUAL_THEME.animation.fadeOutSpeed)
      if (next <= 0) alphaMap.delete(key)
      else alphaMap.set(key, next)
    }
    return
  }

  type Candidate = {
    sprite: Sprite
    sx: number
    sy: number
    dw: number
    dh: number
    tier: number
    dist: number
    label: string
    handle?: string
    nameFontPx: number
    handleFontPx: number
    lineGap: number
    pillW: number
    pillH: number
    lx: number
    ly: number
  }
  const cands: Candidate[] = []
  const cx = width * 0.5
  const cy = height * 0.5

  // Setup font for measurement
  const fontPx = Math.max(
    VISUAL_THEME.typography.sizeZoomLabelMin, 
    Math.min(VISUAL_THEME.typography.sizeZoomLabelMax, Math.floor(15 * (1 / Math.min(1.5, zoom))))
  )
  ctx.font = `${VISUAL_THEME.typography.weightBold} ${fontPx}px ${VISUAL_THEME.typography.fontFamily}`
  const padX = VISUAL_THEME.layout.labelPadX
  const padY = VISUAL_THEME.layout.labelPadY
  const lineGap = 3
  
  const ordered = (state.sprites as Sprite[])
    .slice()
    .sort((a, b) => computeWorldY(a, now, timestamp) - computeWorldY(b, now, timestamp))
    
  for (const sprite of ordered) {
    let frameSet: Frame[] | undefined
    if ((sprite as any).aliveKey && sprite.alive) {
      frameSet = state.framesAliveMap.get((sprite as any).aliveKey!)
    } else if ((sprite as any).deadKey && !sprite.alive) {
      frameSet = state.framesDeadMap.get((sprite as any).deadKey!)
    }
    const fr = (frameSet || (sprite.alive ? state.framesAlive : state.framesDead))[sprite.tier] as Frame
    if (!fr) continue
    let wx = sprite.tx
    if (sprite.mode === 'entry') {
      wx = sprite.x
    } else if (sprite.mode === 'glide') {
      const tt = clamp(((now - (sprite.gStart || now)) / (sprite.gDur || 1)), 0, 1)
      const e = easeOutCubic(tt)
      wx = lerp(sprite.fromX || sprite.tx, sprite.tx, e)
    }
    const wy = computeWorldY(sprite, now, timestamp)
    const sx = wx * state.scale + state.tx
    const sy = wy * state.scale + state.ty
    const dw = fr.w * state.scale
    const dh = fr.h * state.scale
    if (sx + dw < -visMargin || sy + dh < -visMargin || sx - visMargin > width || sy - visMargin > height) {
      continue
    }
    const threshIndex = Math.max(0, Math.min(thresholds.length - 1, sprite.tier))
    const thresh = thresholds[threshIndex] ?? Infinity
    if (zoom < thresh) continue
    
    const addrDisp = (sprite as any).addressCased || sprite.address
    const name =
      sprite.name && String(sprite.name).trim().length
        ? String(sprite.name).trim()
        : shortAddress(addrDisp)
    const handleRaw =
      typeof (sprite as any).socialHandle === 'string'
        ? (sprite as any).socialHandle
        : typeof (sprite as any).social_handle === 'string'
          ? (sprite as any).social_handle
          : ''
    const handleTrimmed = handleRaw.trim()
    const handle = handleTrimmed ? (handleTrimmed.startsWith('@') ? handleTrimmed : `@${handleTrimmed}`) : ''
    const dist = Math.hypot(sx - cx, sy - cy)
    
    const nameWidth = Math.ceil(ctx.measureText(name).width)
    const handleFontPx = Math.max(10, Math.floor(fontPx * 0.8))
    const handleWidth = handle
      ? Math.ceil(
          (() => {
            ctx.font = `${VISUAL_THEME.typography.weightBold} ${handleFontPx}px ${VISUAL_THEME.typography.fontFamily}`
            return ctx.measureText(handle).width
          })(),
        )
      : 0
    // Restore font for downstream consumers
    ctx.font = `${VISUAL_THEME.typography.weightBold} ${fontPx}px ${VISUAL_THEME.typography.fontFamily}`

    const pillW = Math.max(nameWidth, handleWidth) + padX * 2
    const pillH =
      fontPx +
      (handle ? lineGap + handleFontPx : 0) +
      padY * 2
    const lx = sx
    const ly = sy - dh / 2 - 12

    cands.push({ 
      sprite, sx, sy, dw, dh, tier: sprite.tier, dist, label: name, handle: handle || undefined,
      nameFontPx: fontPx, handleFontPx, lineGap,
      pillW, pillH, lx, ly
    })
  }

  // Sort by priority: Tier 0 (Top) first, then by distance to center
  cands.sort((a, b) => a.tier - b.tier || a.dist - b.dist)

  const accepted: Candidate[] = []
  
  // Helper: Check overlap
  const intersects = (a: Candidate, b: Candidate) => {
    // Simple AABB check on the pill rects
    // Expand slightly to give breathing room
    const margin = 2 
    return (
      Math.abs(a.lx - b.lx) * 2 < (a.pillW + b.pillW) + margin &&
      Math.abs(a.ly - b.ly) * 2 < (a.pillH + b.pillH) + margin
    )
  }

  for (const c of cands) {
    if (accepted.length >= cap) break
    
    // Collision check
    // Always accept Tier 0 (Top Blobs) regardless of overlap? 
    // Or just let them win because they are sorted first.
    // We'll skip candidates that collide with already accepted ones.
    let blocked = false
    for (const existing of accepted) {
      if (intersects(c, existing)) {
        blocked = true
        break
      }
    }
    
    if (!blocked) {
      accepted.push(c)
    }
  }

  const targetIds = new Set(accepted.map(c => c.sprite.address))

  // Update Alphas
  // 1. Fade IN accepted targets
  for (const c of accepted) {
    const curr = alphaMap.get(c.sprite.address) || 0
    if (curr < 1) {
      alphaMap.set(c.sprite.address, Math.min(1, curr + VISUAL_THEME.animation.fadeInSpeed))
    }
  }
  // 2. Fade OUT rejected targets
  // We iterate the map to find keys not in targetIds
  for (const [key, val] of alphaMap) {
    if (!targetIds.has(key)) {
      const next = Math.max(0, val - VISUAL_THEME.animation.fadeOutSpeed)
      if (next <= 0) alphaMap.delete(key)
      else alphaMap.set(key, next)
    }
  }

  if (alphaMap.size === 0) return

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // Re-loop to draw ONLY if alpha > 0. We need coordinate data for fading-out labels too.
  // Optimization: We can just draw 'accepted' with their current alpha, 
  // AND we need to find the coordinates for the fading-out ones.
  // To save perf, we can look them up in 'cands' (since we calculated coords for everyone visible).
  
  const candMap = new Map<string, Candidate>()
  for (const c of cands) candMap.set(c.sprite.address, c)

  for (const [addr, alpha] of alphaMap) {
    const c = candMap.get(addr)
    if (!c) {
      // Sprite went off screen or got culled by zoom logic before collision check
      // Just delete it to stop processing
      alphaMap.delete(addr)
      continue
    }

    ctx.globalAlpha = alpha
    
    const { pillW, pillH, lx, ly, nameFontPx, handleFontPx, handle, lineGap } = c
    const rx = VISUAL_THEME.layout.pillRadius
    
    ctx.fillStyle = VISUAL_THEME.colors.pillBg
    ctx.beginPath()
    ctx.moveTo(lx - pillW / 2 + rx, ly - pillH / 2)
    ctx.lineTo(lx + pillW / 2 - rx, ly - pillH / 2)
    ctx.quadraticCurveTo(lx + pillW / 2, ly - pillH / 2, lx + pillW / 2, ly - pillH / 2 + rx)
    ctx.lineTo(lx + pillW / 2, ly + pillH / 2 - rx)
    ctx.quadraticCurveTo(lx + pillW / 2, ly + pillH / 2, lx + pillW / 2 - rx, ly + pillH / 2)
    ctx.lineTo(lx - pillW / 2 + rx, ly + pillH / 2)
    ctx.quadraticCurveTo(lx - pillW / 2, ly + pillH / 2, lx - pillW / 2, ly + pillH / 2 - rx)
    ctx.lineTo(lx - pillW / 2, ly - pillH / 2 + rx)
    ctx.quadraticCurveTo(lx - pillW / 2, ly - pillH / 2, lx - pillW / 2 + rx, ly - pillH / 2)
    ctx.fill()
    
    ctx.fillStyle = VISUAL_THEME.colors.textPrimary
    const top = ly - pillH / 2 + padY
    const nameY = top + nameFontPx / 2
    ctx.font = `${VISUAL_THEME.typography.weightBold} ${nameFontPx}px ${VISUAL_THEME.typography.fontFamily}`
    ctx.fillText(c.label, lx, nameY)

    if (handle) {
      const handleY = nameY + nameFontPx / 2 + lineGap + handleFontPx / 2
      ctx.font = `${VISUAL_THEME.typography.weightBold} ${handleFontPx}px ${VISUAL_THEME.typography.fontFamily}`
      ctx.fillStyle = VISUAL_THEME.colors.textPrimary
      if ((VISUAL_THEME.colors as any).textSecondary) {
        ctx.fillStyle = (VISUAL_THEME.colors as any).textSecondary
      }
      ctx.fillText(handle, lx, handleY)
      ctx.fillStyle = VISUAL_THEME.colors.textPrimary
    }
  }
  
  ctx.globalAlpha = 1.0
}
