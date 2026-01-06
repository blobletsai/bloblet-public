export function renderLandmarkOwnershipRing(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  dw: number,
  dh: number,
  now: number,
) {
  ctx.save()
  const pulse = 0.9 + 0.1 * (1 + Math.sin(now * 0.005))
  const baseR = Math.max(Math.max(dw, dh) * 0.5 + 14, 32)
  const ringR = baseR * pulse
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)'
  ctx.lineWidth = Math.max(3, Math.min(8, ringR * 0.08))
  ctx.setLineDash([8, 6])
  ctx.arc(sx, sy, ringR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.setLineDash([])
  ctx.strokeStyle = '#7dd3fc'
  ctx.lineWidth = Math.max(2, Math.min(5, ringR * 0.06))
  ctx.arc(sx, sy, ringR - 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}
