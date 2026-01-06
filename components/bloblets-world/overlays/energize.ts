import { formatDisplayPoints } from '@/src/shared/points'
import type { EnergizeUiState } from '../energizeState'
import type { Sprite } from '../types'

export function renderEnergizeBubble(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  energize: EnergizeUiState,
  state: any,
  sprite: Sprite,
) {
  const costLabel =
    energize.energizeCost != null && Number.isFinite(energize.energizeCost)
      ? `${formatDisplayPoints(energize.energizeCost)} BC`
      : null
  const msg = costLabel ? `Nourish (${costLabel})` : 'Nourish ready'
  const baseR = Math.max(sprite.r * state.scale, 24)
  const by = sy - baseR - 18
  ctx.save()
  ctx.font = `12px system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial`
  const bw = Math.ceil(ctx.measureText(msg).width) + 16
  const bh = 18
  const bx = sx
  ctx.fillStyle = 'rgba(38,50,20,0.85)'
  const rr = 6
  ctx.beginPath()
  ctx.moveTo(bx - bw / 2 + rr, by - bh)
  ctx.lineTo(bx + bw / 2 - rr, by - bh)
  ctx.quadraticCurveTo(bx + bw / 2, by - bh, bx + bw / 2, by - bh + rr)
  ctx.lineTo(bx + bw / 2, by - rr)
  ctx.quadraticCurveTo(bx + bw / 2, by, bx + bw / 2 - rr, by)
  ctx.lineTo(bx - bw / 2 + rr, by)
  ctx.quadraticCurveTo(bx - bw / 2, by, bx - bw / 2, by - rr)
  ctx.lineTo(bx - bw / 2, by - bh + rr)
  ctx.quadraticCurveTo(bx - bw / 2, by - bh, bx - bw / 2 + rr, by - bh)
  ctx.fill()
  ctx.fillStyle = '#e7f0b8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(msg, bx, by - 5)
  ctx.restore()
}
