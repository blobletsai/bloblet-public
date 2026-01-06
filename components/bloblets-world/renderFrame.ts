import { renderSprites } from './spriteRenderer'
import { renderZoomLabels } from './overlayRenderers'
import { applyCameraMomentum, renderBackgroundLayers } from './viewport'
import { resolveIdleCollisions, runEntryPhysics } from './physics'
import type { SpatialGrid } from './spatialGrid'

interface RenderFrameOptions {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  state: any
  dt: number
  now: number
  timestamp: number
  pixelPerfect: boolean
  collisionGrid: SpatialGrid
}

export function renderFrame({
  canvas,
  context,
  state,
  dt,
  now,
  timestamp,
  pixelPerfect,
  collisionGrid,
}: RenderFrameOptions) {
  applyCameraMomentum(state)
  renderBackgroundLayers(context, canvas, state)
  context.imageSmoothingEnabled = !pixelPerfect

  const width = canvas.width
  const height = canvas.height
  const visMargin = 256 * state.scale

  runEntryPhysics(state, dt, now, collisionGrid)
  resolveIdleCollisions(state, dt)

  const framesReady =
    (state.framesAlive && state.framesAlive.length > 0) &&
    (state.framesDead && state.framesDead.length > 0)

  if (!framesReady) {
    return
  }

  renderSprites({
    context,
    state,
    timestamp,
    now,
    pixelPerfect,
    width,
    height,
    visMargin,
  })

  renderZoomLabels({
    context,
    state,
    framesReady,
    timestamp,
    now,
    width,
    height,
    visMargin,
  })
}
