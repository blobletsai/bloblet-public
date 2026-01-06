"use client"

// Build a deterministic, seamless, screen-locked background tile.
// Notes:
// - No gradients or random stars inside the tile (these create visible seams).
// - The global vignette/light overlay remains in viewport.ts.
// - The grid uses 128x64 diamonds to match the reference density.
export function buildGroundTile() {
  // Use a larger tile for visual stability at DPR 1–2 without scaling.
  const tileSize = 512

  // Overscan by 2px to avoid anti-aliased edges at the pattern seam, then crop.
  const overscan = 2
  const src = document.createElement('canvas')
  src.width = tileSize + overscan
  src.height = tileSize + overscan
  const sctx = src.getContext('2d')

  const out = document.createElement('canvas')
  out.width = tileSize
  out.height = tileSize
  const octx = out.getContext('2d')

  if (!sctx || !octx) return out

  // Base fill — solid, no gradients to guarantee perfect periodicity.
  sctx.fillStyle = 'rgba(18, 6, 32, 1)'
  sctx.fillRect(0, 0, src.width, src.height)

  // Draw grid diamonds centered in the tile with consistent alpha.
  const diamondWidth = 128
  const diamondHeight = 64
  const halfW = diamondWidth / 2
  const halfH = diamondHeight / 2

  sctx.save()
  // Translate so that the working area we crop from (1..tileSize+1) aligns cleanly.
  sctx.translate(overscan / 2, overscan / 2)
  sctx.lineWidth = 1
  sctx.strokeStyle = 'rgba(148, 93, 255, 0.28)'
  sctx.lineJoin = 'miter'
  sctx.lineCap = 'butt'

  const drawDiamond = (cx: number, cy: number) => {
    sctx.beginPath()
    sctx.moveTo(cx, cy - halfH)
    sctx.lineTo(cx + halfW, cy)
    sctx.lineTo(cx, cy + halfH)
    sctx.lineTo(cx - halfW, cy)
    sctx.closePath()
    sctx.stroke()
  }

  // Plot a grid of centers; include a margin so partially clipped diamonds
  // continue seamlessly when the pattern repeats.
  const minX = -diamondWidth
  const maxX = tileSize + diamondWidth
  const minY = -diamondHeight
  const maxY = tileSize + diamondHeight

  // Use isometric transform for evenly spaced centers.
  // cx = (c - r) * (W/2) + centerX
  // cy = (c + r) * (H/2) + centerY
  const centerX = tileSize / 2
  const centerY = tileSize / 2

  // Conservative bounds to ensure coverage.
  const span = 8
  for (let r = -span; r <= span; r++) {
    for (let c = -span; c <= span; c++) {
      const cx = (c - r) * (diamondWidth / 2) + centerX
      const cy = (c + r) * (diamondHeight / 2) + centerY
      if (cx < minX || cx > maxX || cy < minY || cy > maxY) continue
      drawDiamond(cx, cy)
    }
  }
  sctx.restore()

  // Crop the overscan area back to a perfect tile to guarantee seamless repeat.
  octx.drawImage(src, overscan / 2, overscan / 2, tileSize, tileSize, 0, 0, tileSize, tileSize)
  return out
}
