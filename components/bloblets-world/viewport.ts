import { buildGroundTile } from './ground'
import { WORLD_CENTER } from './constants'

type WorldState = {
  dragging?: boolean
  tx: number
  ty: number
  vx: number
  vy: number
  scale: number
  groundTile?: HTMLCanvasElement | null
  groundPattern?: CanvasPattern | null
}

export function applyCameraMomentum(state: WorldState) {
  if (state.dragging) return
  state.tx += state.vx
  state.ty += state.vy
  state.vx *= 0.92
  state.vy *= 0.92
}

export function renderBackgroundLayers(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: WorldState,
) {
  if (!state.groundTile && typeof document !== 'undefined') {
    state.groundTile = buildGroundTile()
  }

  if (!state.groundPattern && state.groundTile) {
    try {
      state.groundPattern = context.createPattern(state.groundTile, 'repeat')
    } catch {}
  }

  if (state.groundPattern) {
    context.fillStyle = state.groundPattern
    context.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    context.fillStyle = '#150b2a'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  const cx = state.tx + WORLD_CENTER.x * state.scale
  const cy = state.ty + WORLD_CENTER.y * state.scale
  const maxRadius = Math.max(canvas.width, canvas.height) * 0.9
  const inner = maxRadius * 0.18

  const light = context.createRadialGradient(cx, cy, inner, cx, cy, maxRadius)
  light.addColorStop(0, 'rgba(186,140,255,0.28)')
  light.addColorStop(0.45, 'rgba(133,79,255,0.18)')
  light.addColorStop(1, 'rgba(0,0,0,0)')

  context.save()
  context.globalCompositeOperation = 'lighter'
  context.fillStyle = light
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()

  const vignette = context.createRadialGradient(
    cx,
    cy,
    maxRadius * 0.55,
    cx,
    cy,
    maxRadius,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(6,0,18,0.55)')

  context.save()
  context.fillStyle = vignette
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()
}
