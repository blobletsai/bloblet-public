"use client"

import { useCallback } from 'react'
import type { MutableRefObject } from 'react'

import { WORLD_H, WORLD_W } from '../constants'
import { clamp } from '../math'

type UseCanvasViewportOptions = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  stateRef: MutableRefObject<any>
  computeDefaultScale: (fitWidth: number, fitHeight: number, baseFit: number) => number
  minScaleFor: (baseFit: number) => number
}

type EnsureSpriteOptions = {
  sprite: any
}

export function useCanvasViewport({
  canvasRef,
  stateRef,
  computeDefaultScale,
  minScaleFor,
}: UseCanvasViewportOptions) {
  const positionCameraToWorld = useCallback(
    (fitFully = false) => {
      const cnv = canvasRef.current
      if (!cnv) return
      const st = stateRef.current
      const w = cnv.width
      const h = cnv.height
      if (!w || !h) return

      const prevScaleRaw = st.scale
      const prevScale = Number.isFinite(prevScaleRaw) && prevScaleRaw > 0 ? prevScaleRaw : null
      const prevWidth = Number.isFinite(st.canvasWidth) ? st.canvasWidth : w
      const prevHeight = Number.isFinite(st.canvasHeight) ? st.canvasHeight : h
      const centerWorldX =
        prevScale != null ? (prevWidth * 0.5 - (st.tx || 0)) / prevScale : WORLD_W * 0.5
      const centerWorldY =
        prevScale != null ? (prevHeight * 0.5 - (st.ty || 0)) / prevScale : WORLD_H * 0.5

      const fitWidth = w / WORLD_W
      const fitHeight = h / WORLD_H
      const baseFit = Math.min(fitWidth, fitHeight)
      st.fitScale = baseFit

      let nextScale = st.scale
      if (fitFully || !st.initializedScale) {
        nextScale = computeDefaultScale(fitWidth, fitHeight, baseFit)
        st.initializedScale = true
      } else {
        const minScale = minScaleFor(baseFit)
        nextScale = clamp(nextScale, minScale, 10)
      }

      st.scale = nextScale
      if (fitFully || !prevScale || !st.initializedScale) {
        st.tx = (w - WORLD_W * st.scale) / 2
        st.ty = (h - WORLD_H * st.scale) / 2
      } else {
        const safeCenterX = Number.isFinite(centerWorldX) ? centerWorldX : WORLD_W * 0.5
        const safeCenterY = Number.isFinite(centerWorldY) ? centerWorldY : WORLD_H * 0.5
        st.tx = w * 0.5 - safeCenterX * st.scale
        st.ty = h * 0.5 - safeCenterY * st.scale
      }
      st.canvasWidth = w
      st.canvasHeight = h
    },
    [canvasRef, computeDefaultScale, minScaleFor, stateRef],
  )

  const ensureSpriteDisplaySize = useCallback(
    ({ sprite }: EnsureSpriteOptions) => {
      if (!sprite) return
      const st = stateRef.current
      const baseFit = st.fitScale || 1
      const zoom = st.scale || baseFit
      const radius = sprite.r * ((sprite as any).sizeMultiplier || 1)
      const sizePx = radius * zoom * 2
      const minPx = 220
      if (sizePx < minPx) {
        const requiredMultiplier = (minPx / 2) / (radius * zoom)
        ;(sprite as any).sizeMultiplierBoost = Math.max(requiredMultiplier, 1)
      } else {
        ;(sprite as any).sizeMultiplierBoost = 1
      }
    },
    [stateRef],
  )

  const recenterView = useCallback(() => {
    const st = stateRef.current
    st.dragging = false
    st.vx = 0
    st.vy = 0
    st.initializedScale = false
    requestAnimationFrame(() => positionCameraToWorld(true))
  }, [positionCameraToWorld, stateRef])

  return {
    positionCameraToWorld,
    ensureSpriteDisplaySize,
    recenterView,
  }
}
