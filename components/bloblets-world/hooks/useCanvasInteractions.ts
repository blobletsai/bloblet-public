"use client"

import type { MutableRefObject } from 'react'
import { useInputSystem } from './useInputSystem'
import { useCameraSystem } from './useCameraSystem'
import { useGameLogicSystem } from './useGameLogicSystem'

type PointerKind = 'mouse' | 'touch' | 'pen'

type SelectOpponentFn = (address: string, opts?: { focus?: boolean; zoom?: number; duration?: number }) => void

type CanvasInteractionsOptions = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  stateRef: MutableRefObject<any>
  updatePointerType: (type: PointerKind) => void
  clearSelectedOpponent: () => void
  handleSelectOpponentAddress: SelectOpponentFn
  minScaleFor: (baseFit: number) => number
  maxScale: number
}

export function useCanvasInteractions({
  canvasRef,
  stateRef,
  updatePointerType,
  clearSelectedOpponent,
  handleSelectOpponentAddress,
  minScaleFor,
  maxScale,
}: CanvasInteractionsOptions) {

  const {
    onPan,
    onZoom,
    onInteractionStart,
    onInteractionEnd,
    onDoubleTap
  } = useCameraSystem({
    canvasRef,
    stateRef,
    minScaleFor,
    maxScale
  })

  const { onTap } = useGameLogicSystem({
    canvasRef,
    stateRef,
    clearSelectedOpponent,
    handleSelectOpponentAddress
  })

  useInputSystem({
    canvasRef,
    updatePointerType,
    onPan,
    onZoom,
    onTap,
    onDoubleTap,
    onInteractionStart,
    onInteractionEnd
  })
}

