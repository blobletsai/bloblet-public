import { describe, expect, it, vi } from 'vitest'
import { createCanvas } from 'canvas'
import { renderFrame } from '../../components/bloblets-world/renderFrame'
import { SpatialGrid } from '../../components/bloblets-world/spatialGrid'
import { computeHighlightAlpha } from '../../components/bloblets-world/overlayRenderers'
import type { Frame, Sprite } from '../../components/bloblets-world/types'

function createTestFrame(size: number): Frame {
  const frameCanvas = createCanvas(size, size)
  return {
    canvas: frameCanvas as unknown as HTMLCanvasElement,
    w: size,
    h: size,
    scale: 1,
  }
}

function createBaseState() {
  const frame = createTestFrame(64)
  const sprite: Sprite = {
    address: '0xabc',
    tier: 0,
    alive: true,
    tx: 150,
    ty: 120,
    r: 24,
    x: 150,
    y: 120,
    vx: 0,
    vy: 0,
    mass: 1,
    alpha: 1,
    scaleBump: 1,
    phase: 0,
    speed: 0,
    bobAmp: 0,
    entryDelay: 0,
    mode: 'idle',
    gStart: undefined,
    gDur: undefined,
    fromX: 150,
    fromY: 120,
    fromScale: 1,
  }

  return {
    scale: 1.3,
    tx: 0,
    ty: 0,
    highlightAddr: null,
    inspectHighlight: null,
    hoverHighlight: null,
    myAddrCanonical: null,
    scoutModeActive: false,
    scoutedMap: new Map(),
    energizeStatus: null,
    sprites: [sprite],
    framesAlive: [frame],
    framesDead: [frame],
    framesAliveMap: new Map<string, Frame[]>(),
    framesDeadMap: new Map<string, Frame[]>(),
    entryActive: false,
    entryStart: performance.now(),
    entryDur: 1000,
    pressureK0: 0,
    pressureDecayMs: 1,
    springK0: 0,
    springK1: 0,
    damping: 0.9,
    pbdIters: 1,
    gridCell: 24,
  }
}

describe('renderFrame', () => {
  it('draws visible sprites and zoom labels', () => {
    const canvas = createCanvas(640, 360)
    const context = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
    const drawImageSpy = vi.spyOn(context, 'drawImage')
    const fillTextSpy = vi.spyOn(context, 'fillText')

    const state = createBaseState()

    renderFrame({
      canvas: canvas as unknown as HTMLCanvasElement,
      context,
      state,
      dt: 0.016,
      now: performance.now(),
      timestamp: performance.now(),
      pixelPerfect: false,
      collisionGrid: new SpatialGrid(24),
    })

    expect(drawImageSpy).toHaveBeenCalledTimes(1)
    expect(fillTextSpy).toHaveBeenCalled()
  })
})

describe('computeHighlightAlpha', () => {
  it('dims non-highlighted opponents during scout mode', () => {
    const alpha = computeHighlightAlpha(1, {
      highlightModeActive: true,
      isHighlightedOpponent: false,
      address: '0x123',
      highlightAddr: '0x456',
      inspectHighlight: null,
      myAddress: '0x789',
    })
    expect(alpha).toBeCloseTo(0.35)
  })

  it('keeps alpha when address matches highlight', () => {
    const alpha = computeHighlightAlpha(0.8, {
      highlightModeActive: true,
      isHighlightedOpponent: false,
      address: '0xabc',
      highlightAddr: '0xabc',
      inspectHighlight: null,
      myAddress: '0x789',
    })
    expect(alpha).toBeCloseTo(0.8)
  })
})
