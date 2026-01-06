"use client"

import { useEffect } from 'react'
import type { MutableRefObject } from 'react'

type CanvasLifecycleOptions = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  hudRef: MutableRefObject<HTMLDivElement | null>
  stateRef: MutableRefObject<any>
  positionCameraToWorld: (fitFully?: boolean) => void
  pixelPerfect: boolean
  startRenderLoop: (params: {
    canvas: HTMLCanvasElement
    context: CanvasRenderingContext2D
    state: MutableRefObject<any>
    pixelPerfect: boolean
  }) => () => void | undefined
}

export function useCanvasLifecycle({
  canvasRef,
  hudRef,
  stateRef,
  positionCameraToWorld,
  pixelPerfect,
  startRenderLoop,
}: CanvasLifecycleOptions) {
  useEffect(() => {
    const cnv = canvasRef.current
    if (!cnv) return
    const ctx = cnv.getContext('2d', { alpha: false })
    if (!ctx) return
    return startRenderLoop({ canvas: cnv, context: ctx, state: stateRef, pixelPerfect })
  }, [canvasRef, pixelPerfect, startRenderLoop, stateRef])

  useEffect(() => {
    const cnv = canvasRef.current
    if (!cnv) return
    const st = stateRef.current

    cnv.style.touchAction = 'none'
    // @ts-ignore legacy vendor prop
    cnv.style.msTouchAction = 'none'

    const resize = () => {
      const ctx = cnv.getContext('2d', { alpha: false })
      if (!ctx) return

      const rect = cnv.getBoundingClientRect()
      const cssW = rect.width
      const cssH = rect.height
      if (!cssW || !cssH) return

      const budgetBytes = 120 * 1024 * 1024
      const maxDpr = Number.isFinite(st.maxDPR) ? st.maxDPR : 2
      const dprBudget = Math.sqrt(budgetBytes / Math.max(1, cssW * cssH * 4))
      const dpr = Math.min(maxDpr, dprBudget, Math.max(1, window.devicePixelRatio || 1))
      const width = Math.floor(cssW * dpr)
      const height = Math.floor(cssH * dpr)
      if (!width || !height) return

      if (cnv.width !== width || cnv.height !== height) {
        cnv.width = width
        cnv.height = height
        cnv.style.width = `${cssW}px`
        cnv.style.height = `${cssH}px`
      }

      st.canvasPixelBytes = width * height * 4
      st.canvasBudgetMet = st.canvasPixelBytes <= budgetBytes

      ctx.imageSmoothingEnabled = !pixelPerfect
      positionCameraToWorld(!st.initializedScale)

      if (hudRef.current) {
        hudRef.current.style.opacity = '1'
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(cnv)
    resize()

    return () => {
      observer.disconnect()
    }
  }, [canvasRef, hudRef, pixelPerfect, positionCameraToWorld, stateRef])
}
