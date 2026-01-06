import { shortAddress } from '@/src/shared/pvp'
import type { Sprite } from '../types'
import { VISUAL_THEME } from '../visualTheme'

export interface HighlightAlphaOptions {
  highlightModeActive: boolean
  isHighlightedOpponent: boolean
  address: string
  highlightAddr?: string | null
  inspectHighlight?: string | null
  myAddress?: string | null
}

export function computeHighlightAlpha(baseAlpha: number, options: HighlightAlphaOptions) {
  if (!options.highlightModeActive || options.isHighlightedOpponent) {
    return baseAlpha
  }
  const { address, highlightAddr, inspectHighlight, myAddress } = options
  const matchesHighlight = Boolean(address && highlightAddr && address === highlightAddr)
  const matchesInspect = Boolean(address && inspectHighlight && address === inspectHighlight)
  if (!matchesHighlight && !matchesInspect) {
    if (!myAddress || address !== myAddress) {
      return baseAlpha * 0.35
    }
  }
  return baseAlpha
}

export function renderSelfHighlight(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sprite: Sprite,
  state: any,
  now: number,
) {
  ctx.save()
  const pulse = 0.92 + 0.08 * (1 + Math.sin(now * 0.006))
  const baseR = Math.max(sprite.r * state.scale + 8, 28)
  const rr = baseR * pulse
  ctx.beginPath()
  ctx.strokeStyle = VISUAL_THEME.colors.selfRingPulse
  // Thicker rings
  ctx.lineWidth = Math.max(4, Math.min(9, rr * 0.1))
  ctx.setLineDash([8, 6])
  ctx.arc(sx, sy, rr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.setLineDash([])
  ctx.strokeStyle = VISUAL_THEME.colors.selfRing
  ctx.lineWidth = Math.max(3, Math.min(6, rr * 0.08))
  ctx.arc(sx, sy, rr - 3, 0, Math.PI * 2)
  ctx.stroke()
  
  // Use name if available, otherwise fallback
  const name = (sprite as any).name && String((sprite as any).name).trim().length
    ? String((sprite as any).name).trim()
    : 'YOU'
  const label = name === 'YOU' ? 'YOU' : `${name} (YOU)`

  // Larger, bold font
  ctx.font = `${VISUAL_THEME.typography.weightBold} ${VISUAL_THEME.typography.sizeHighlight}px ${VISUAL_THEME.typography.fontFamily}`
  const tw = Math.ceil(ctx.measureText(label).width)
  const padX = VISUAL_THEME.layout.labelPadX
  const padY = VISUAL_THEME.layout.labelPadY
  const pillW = tw + padX * 2
  const pillH = VISUAL_THEME.typography.sizeHighlight + padY * 2
  const lx = sx
  const ly = sy - rr - 16
  ctx.fillStyle = VISUAL_THEME.colors.pillBgHighlight
  const rx = VISUAL_THEME.layout.pillRadius
  ctx.beginPath()
  ctx.moveTo(lx - pillW / 2 + rx, ly - pillH / 2)
  ctx.lineTo(lx + pillW / 2 - rx, ly - pillH / 2)
  ctx.quadraticCurveTo(
    lx + pillW / 2,
    ly - pillH / 2,
    lx + pillW / 2,
    ly - pillH / 2 + rx,
  )
  ctx.lineTo(lx + pillW / 2, ly + pillH / 2 - rx)
  ctx.quadraticCurveTo(
    lx + pillW / 2,
    ly + pillH / 2,
    lx + pillW / 2 - rx,
    ly + pillH / 2,
  )
  ctx.lineTo(lx - pillW / 2 + rx, ly + pillH / 2)
  ctx.quadraticCurveTo(lx - pillW / 2, ly + pillH / 2, lx - pillW / 2, ly + pillH / 2 - rx)
  ctx.lineTo(lx - pillW / 2, ly - pillH / 2 + rx)
  ctx.quadraticCurveTo(lx - pillW / 2, ly - pillH / 2, lx - pillW / 2 + rx, ly - pillH / 2)
  ctx.fill()
  ctx.fillStyle = VISUAL_THEME.colors.selfRingBg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, lx, ly + 0.5)
  ctx.restore()
}

export interface RenderSelectedOpponentOptions {
  context: CanvasRenderingContext2D
  sx: number
  sy: number
  now: number
  sprite: Sprite
}

export function renderSelectedOpponent({
  context: ctx,
  sx,
  sy,
  now,
  sprite,
}: RenderSelectedOpponentOptions) {
  ctx.save()
  const pulse = 0.95 + 0.07 * (1 + Math.sin(now * 0.005))
  const baseR = Math.max(sprite.r * 1 + 10, 30)
  const rr = baseR * pulse
  ctx.beginPath()
  ctx.setLineDash([10, 6])
  // Thicker rings
  ctx.lineWidth = Math.max(4, Math.min(8, rr * 0.1))
  ctx.strokeStyle = VISUAL_THEME.colors.opponentRingPulse
  ctx.arc(sx, sy, rr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineWidth = Math.max(3, Math.min(6, rr * 0.07))
  ctx.strokeStyle = VISUAL_THEME.colors.opponentRing
  ctx.beginPath()
  ctx.arc(sx, sy, rr - 4, 0, Math.PI * 2)
  ctx.stroke()
  const label = (sprite as any).name || shortAddress(sprite.address)
  // Larger, bold font
  ctx.font = `${VISUAL_THEME.typography.weightBold} ${VISUAL_THEME.typography.sizeHighlight}px ${VISUAL_THEME.typography.fontFamily}`
  const tw = Math.ceil(ctx.measureText(label).width)
  const padX = VISUAL_THEME.layout.labelPadX
  const padY = VISUAL_THEME.layout.labelPadY
  const pillW = tw + padX * 2
  const pillH = VISUAL_THEME.typography.sizeHighlight + padY * 2
  const lx = sx
  const ly = sy - rr - 18
  // Darker background for better contrast
  ctx.fillStyle = VISUAL_THEME.colors.pillBgSelected
  const rx = VISUAL_THEME.layout.pillRadius
  ctx.beginPath()
  ctx.moveTo(lx - pillW / 2 + rx, ly - pillH / 2)
  ctx.lineTo(lx + pillW / 2 - rx, ly - pillH / 2)
  ctx.quadraticCurveTo(
    lx + pillW / 2,
    ly - pillH / 2,
    lx + pillW / 2,
    ly - pillH / 2 + rx,
  )
  ctx.lineTo(lx + pillW / 2, ly + pillH / 2 - rx)
  ctx.quadraticCurveTo(
    lx + pillW / 2,
    ly + pillH / 2,
    lx + pillW / 2 - rx,
    ly + pillH / 2,
  )
  ctx.lineTo(lx - pillW / 2 + rx, ly + pillH / 2)
  ctx.quadraticCurveTo(
    lx - pillW / 2,
    ly + pillH / 2,
    lx - pillW / 2,
    ly + pillH / 2 - rx,
  )
  ctx.lineTo(lx - pillW / 2, ly - pillH / 2 + rx)
  ctx.quadraticCurveTo(
    lx - pillW / 2,
    ly - pillH / 2,
    lx - pillW / 2 + rx,
    ly - pillH / 2,
  )
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,157,225,0.45)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.fillStyle = '#ff9de1'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, lx, ly)
  ctx.restore()
}
