import type { RiskTone } from '@/src/shared/pvp'
import { RISK_TONE_AURAS, RISK_TONE_TEXT, SCOUT_RETICLE_COLOR } from './riskTone'
import { VISUAL_THEME } from '../visualTheme'

export interface RenderScoutAuraOptions {
  context: CanvasRenderingContext2D
  sx: number
  sy: number
  now: number
  address: string
  scoutedMeta: { label: string; tone: RiskTone }
  isHoveringOpponent: boolean
  isSelectedOpponent: boolean
  state: any
}

export function renderScoutAura({
  context: ctx,
  sx,
  sy,
  now,
  address,
  scoutedMeta,
  isHoveringOpponent,
  isSelectedOpponent,
  state,
}: RenderScoutAuraOptions) {
  ctx.save()
  const aura = RISK_TONE_AURAS[scoutedMeta.tone] || RISK_TONE_AURAS.neutral
  const baseR = Math.max(state.scale * 24 + 14, 32)
  const pulseSeed = (address.charCodeAt(0) || 0) * 13.37
  const pulsePhase = ((now - (state.scoutPulseStart || now)) + pulseSeed) * 0.0026
  const pulse = 0.94 + 0.08 * Math.sin(pulsePhase)
  const rr = baseR * pulse
  ctx.beginPath()
  ctx.setLineDash([(isHoveringOpponent || isSelectedOpponent) ? 5 : 9, 6])
  ctx.lineWidth = Math.max(2.6, Math.min(6.5, rr * 0.08))
  ctx.strokeStyle = aura.ring
  ctx.shadowColor = aura.ring
  ctx.shadowBlur = isHoveringOpponent || isSelectedOpponent ? 28 : 18
  ctx.arc(sx, sy, rr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.setLineDash([])
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = isHoveringOpponent || isSelectedOpponent ? 0.36 : 0.24
  ctx.fillStyle = aura.fill
  ctx.beginPath()
  ctx.arc(sx, sy, rr - 6, 0, Math.PI * 2)
  ctx.fill()
  const tagText = 'TARGET'
  ctx.save()
  ctx.font = `10px ${VISUAL_THEME.typography.fontFamily}`
  const tagTw = Math.ceil(ctx.measureText(tagText).width)
  const tagPadX = 10
  const tagPadY = 4
  const tagW = tagTw + tagPadX * 2
  const tagH = 12 + tagPadY * 2
  const tagX = sx
  const tagY = sy - rr - tagH - 8
  const tagRadius = 8
  ctx.fillStyle = aura.tag
  ctx.beginPath()
  ctx.moveTo(tagX - tagW / 2 + tagRadius, tagY - tagH / 2)
  ctx.lineTo(tagX + tagW / 2 - tagRadius, tagY - tagH / 2)
  ctx.quadraticCurveTo(
    tagX + tagW / 2,
    tagY - tagH / 2,
    tagX + tagW / 2,
    tagY - tagH / 2 + tagRadius,
  )
  ctx.lineTo(tagX + tagW / 2, tagY + tagH / 2 - tagRadius)
  ctx.quadraticCurveTo(
    tagX + tagW / 2,
    tagY + tagH / 2,
    tagX + tagW / 2 - tagRadius,
    tagY + tagH / 2,
  )
  ctx.lineTo(tagX - tagW / 2 + tagRadius, tagY + tagH / 2)
  ctx.quadraticCurveTo(
    tagX - tagW / 2,
    tagY + tagH / 2,
    tagX - tagW / 2,
    tagY + tagH / 2 - tagRadius,
  )
  ctx.lineTo(tagX - tagW / 2, tagY - tagH / 2 + tagRadius)
  ctx.quadraticCurveTo(
    tagX - tagW / 2,
    tagY - tagH / 2,
    tagX - tagW / 2 + tagRadius,
    tagY - tagH / 2,
  )
  ctx.fill()
  ctx.fillStyle = '#140314'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(tagText, tagX, tagY)
  ctx.restore()
  ctx.globalAlpha = 0.18
  ctx.beginPath()
  ctx.arc(
    sx,
    sy,
    Math.max(rr - 18, baseR * 0.72),
    0,
    Math.PI * 2,
  )
  ctx.strokeStyle = aura.ring
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()
  const crossRadius = rr + 14
  ctx.beginPath()
  ctx.strokeStyle = SCOUT_RETICLE_COLOR
  ctx.lineWidth = 1.2
  ctx.moveTo(sx - crossRadius, sy)
  ctx.lineTo(sx - crossRadius + 16, sy)
  ctx.moveTo(sx + crossRadius, sy)
  ctx.lineTo(sx + crossRadius - 16, sy)
  ctx.moveTo(sx, sy - crossRadius)
  ctx.lineTo(sx, sy - crossRadius + 16)
  ctx.moveTo(sx, sy + crossRadius)
  ctx.lineTo(sx, sy + crossRadius - 16)
  ctx.stroke()
  if (!isSelectedOpponent) {
    const label = scoutedMeta.label.toUpperCase()
    // Larger, bold font
    ctx.font = `${VISUAL_THEME.typography.weightBold} ${VISUAL_THEME.typography.sizeScout}px ${VISUAL_THEME.typography.fontFamily}`
    const tw = Math.ceil(ctx.measureText(label).width)
    const padX = VISUAL_THEME.layout.labelPadX + 2
    const padY = VISUAL_THEME.layout.labelPadY + 1
    const pillW = tw + padX * 2
    const pillH = VISUAL_THEME.typography.sizeScout + padY * 2
    const lx = sx
    const ly = sy - rr - 26
    const rx = VISUAL_THEME.layout.pillRadius + 3
    ctx.fillStyle = VISUAL_THEME.colors.pillBgScout
    ctx.beginPath()
    ctx.moveTo(lx - pillW / 2 + rx, ly - pillH / 2)
    ctx.lineTo(lx + pillW / 2 - rx, ly - pillH / 2)
    ctx.quadraticCurveTo(lx + pillW / 2, ly - pillH / 2, lx + pillW / 2, ly - pillH / 2 + rx)
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
    ctx.strokeStyle = aura.ring
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.beginPath()
    ctx.fillStyle = VISUAL_THEME.colors.pillBgScout
    ctx.moveTo(lx, ly + pillH / 2)
    ctx.lineTo(lx - 7.5, ly + pillH / 2 + 10)
    ctx.lineTo(lx + 7.5, ly + pillH / 2 + 10)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = RISK_TONE_TEXT[scoutedMeta.tone]
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, lx, ly)
  }
  ctx.restore()
}
