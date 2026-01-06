"use client"

import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

import { WORLD_W, WORLD_H } from '../constants'
import { easeInOutCubic, lerp } from '../math'
import type { Sprite, HubTab } from '../types'

type FocusOptions = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  stateRef: MutableRefObject<any>
  ensureSpriteDisplaySize: (options: { sprite: Sprite }) => void
  minScaleFor: (baseFit: number) => number
  setActiveHubTab: (tab: HubTab) => void
  setSelectedOpponent: (addr: string | null) => void
  selectedOpponentRef: MutableRefObject<string | null>
  maxScale: number
}

export function useSpriteFocus({
  canvasRef,
  stateRef,
  ensureSpriteDisplaySize,
  minScaleFor,
  setActiveHubTab,
  setSelectedOpponent,
  selectedOpponentRef,
  maxScale,
}: FocusOptions) {
  const worldWidth = WORLD_W
  const worldHeight = WORLD_H
  const maxScaleRef = useRef(maxScale)

  useEffect(() => {
    maxScaleRef.current = maxScale
  }, [maxScale])

  const focusOnAddress = useCallback(
    (address: string, opts?: { zoom?: number; duration?: number }) => {
      const st = stateRef.current
      const cnv = canvasRef.current
      if (!st || !cnv) return false
      const key = String(address || '').trim()
      if (!key) return false
      const idx = st.addrToIdx?.get?.(key)
      if (idx === undefined) return false
      const sprite: Sprite | undefined = st.sprites?.[idx]
      if (!sprite) return false

      ensureSpriteDisplaySize({ sprite })

      const width = cnv.width || cnv.clientWidth || 0
      const height = cnv.height || cnv.clientHeight || 0
      if (!width || !height) return false

      const baseFit =
        st.fitScale ||
        Math.min(width / worldWidth, height / worldHeight) ||
        1
      const minScale = minScaleFor(baseFit)
      const zoomFactor = Number.isFinite(opts?.zoom) ? Number(opts?.zoom) : 1.2
      const desiredScale = Math.max(
        minScale,
        Math.min(maxScaleRef.current, zoomFactor * baseFit),
      )

      const duration = Math.max(
        120,
        Math.min(1500, Number(opts?.duration) || 600),
      )
      const start = performance.now()
      const startScale = st.scale || baseFit
      const startTx = st.tx || 0
      const startTy = st.ty || 0
      const targetTx = width * 0.5 - sprite.tx * desiredScale
      const targetTy = height * 0.5 - sprite.ty * desiredScale

      st.dragging = false
      st.vx = 0
      st.vy = 0

      const animate = () => {
        const now = performance.now()
        const t = Math.min(1, (now - start) / duration)
        const eased = easeInOutCubic(t)
        st.scale = lerp(startScale, desiredScale, eased)
        st.tx = lerp(startTx, targetTx, eased)
        st.ty = lerp(startTy, targetTy, eased)
        ensureSpriteDisplaySize({ sprite })
        if (t < 1) requestAnimationFrame(animate)
      }

      requestAnimationFrame(animate)
      return true
    },
    [canvasRef, ensureSpriteDisplaySize, minScaleFor, stateRef, worldHeight, worldWidth],
  )

  const previewOpponent = useCallback((address: string | null) => {
    const st = stateRef.current
    if (address) {
      const key = String(address).trim()
      st.hoverHighlight = key
      st.hoverPulseStart = typeof performance !== 'undefined' ? performance.now() : Date.now()
    } else {
      st.hoverHighlight = ''
      st.hoverPulseStart = 0
    }
  }, [stateRef])

  const clearSelectedOpponent = useCallback(() => {
    setSelectedOpponent(null)
    stateRef.current.inspectHighlight = ''
    stateRef.current.inspectPulseStart = 0
    previewOpponent(null)
  }, [previewOpponent, setSelectedOpponent, stateRef])

  const handleSelectOpponentAddress = useCallback(
    (address: string, opts?: { focus?: boolean; zoom?: number; duration?: number }) => {
      const key = String(address || '').trim()
      if (!key) return
      setSelectedOpponent(key)
      setActiveHubTab('opponents')
      stateRef.current.inspectHighlight = key
      stateRef.current.inspectPulseStart = performance.now()
      previewOpponent(null)
      if (opts?.focus) {
        focusOnAddress(key, { zoom: opts.zoom ?? 1.6, duration: opts.duration ?? 600 })
      }
    },
    [focusOnAddress, previewOpponent, setActiveHubTab, setSelectedOpponent, stateRef],
  )

  const updateSelectedRef = useCallback((value: string | null) => {
    selectedOpponentRef.current = value
  }, [selectedOpponentRef])

  return {
    focusOnAddress,
    previewOpponent,
    clearSelectedOpponent,
    handleSelectOpponentAddress,
    updateSelectedRef,
  }
}
