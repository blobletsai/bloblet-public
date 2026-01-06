import type { MutableRefObject } from 'react'
import { SpatialGrid } from './spatialGrid'
import { renderFrame } from './renderFrame'

type WorldStateRef = MutableRefObject<any>

interface RenderLoopOptions {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  state: WorldStateRef
  pixelPerfect: boolean
}

export function startRenderLoop({
  canvas,
  context,
  state,
  pixelPerfect,
}: RenderLoopOptions) {
  let lastTimestamp = performance.now()
  let gridCellSize = state.current?.gridCell ?? 24
  let collisionGrid = new SpatialGrid(gridCellSize)
  let rafId: number | null = null

  const frame = (timestamp: number) => {
    const currentState = state.current
    if (!currentState) {
      rafId = requestAnimationFrame(frame)
      return
    }

    if (currentState.gridCell && currentState.gridCell !== gridCellSize) {
      gridCellSize = currentState.gridCell
      collisionGrid = new SpatialGrid(gridCellSize)
    }

    let dt = (timestamp - lastTimestamp) / 1000
    lastTimestamp = timestamp
    dt = Math.min(dt, 0.033)

    const now = performance.now()

    renderFrame({
      canvas,
      context,
      state: currentState,
      dt,
      now,
      timestamp,
      pixelPerfect,
      collisionGrid,
    })

    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}
