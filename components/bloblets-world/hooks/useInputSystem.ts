import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

type PointerKind = 'mouse' | 'touch' | 'pen'

export interface InputSystemOptions {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  updatePointerType: (type: PointerKind) => void
  onPan: (dx: number, dy: number, clientX: number, clientY: number) => void
  onZoom: (factor: number, clientX: number, clientY: number, deltaY?: number) => void
  onTap: (clientX: number, clientY: number) => void
  onDoubleTap: (clientX: number, clientY: number) => void
  onInteractionStart: (clientX: number, clientY: number) => void
  onInteractionEnd: () => void
}

export function useInputSystem({
  canvasRef,
  updatePointerType,
  onPan,
  onZoom,
  onTap,
  onDoubleTap,
  onInteractionStart,
  onInteractionEnd,
}: InputSystemOptions) {
  // Internal state to track gestures
  const state = useRef({
    activePointers: new Map<number, PointerEvent>(),
    lastX: 0,
    lastY: 0,
    downX: 0,
    downY: 0,
    pinchDist: 0,
    dragging: false,
  }).current

  useEffect(() => {
    const cnv = canvasRef.current
    if (!cnv) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      updatePointerType('mouse')
      // Wheel zoom
      const factor = Math.pow(1.1, event.deltaY > 0 ? -1 : 1)
      onZoom(factor, event.clientX, event.clientY, event.deltaY)
    }

    const onPointerDown = (event: PointerEvent) => {
      const pointerType = event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse'
      updatePointerType(pointerType)
      
      try {
        if (typeof cnv.setPointerCapture === 'function') {
          cnv.setPointerCapture(event.pointerId)
        }
      } catch (e) {}

      state.activePointers.set(event.pointerId, event)

      if (state.activePointers.size === 1) {
        state.dragging = true
        state.lastX = event.clientX
        state.lastY = event.clientY
        state.downX = event.clientX
        state.downY = event.clientY
        onInteractionStart(event.clientX, event.clientY)
      } else if (state.activePointers.size === 2) {
         const values = Array.from(state.activePointers.values())
         const a = values[0]
         const b = values[1]
         if (a && b) {
             state.pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
         }
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!state.activePointers.has(event.pointerId)) return
      state.activePointers.set(event.pointerId, event)

      if (state.activePointers.size === 1 && state.dragging) {
        const dx = event.clientX - state.lastX
        const dy = event.clientY - state.lastY
        onPan(dx, dy, event.clientX, event.clientY)
        state.lastX = event.clientX
        state.lastY = event.clientY
      } else if (state.activePointers.size === 2) {
        const values = Array.from(state.activePointers.values())
        const a = values[0]
        const b = values[1]
        if (a && b) {
            const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
            const cx = (a.clientX + b.clientX) / 2
            const cy = (a.clientY + b.clientY) / 2
            
            const factor = dist / (state.pinchDist || dist)
            onZoom(factor, cx, cy)
            
            state.pinchDist = dist
        }
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (state.activePointers.size) state.activePointers.clear()
      
      if (state.dragging) {
        state.dragging = false
        onInteractionEnd()
        
        const dx = Math.abs(event.clientX - state.downX)
        const dy = Math.abs(event.clientY - state.downY)
        if (dx < 3 && dy < 3) {
          onTap(event.clientX, event.clientY)
        }
      }
    }

    const onDoubleClick = (event: MouseEvent) => {
       onDoubleTap(event.clientX, event.clientY)
    }

    cnv.addEventListener('wheel', onWheel, { passive: false })
    cnv.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    cnv.addEventListener('dblclick', onDoubleClick)

    return () => {
      cnv.removeEventListener('wheel', onWheel)
      cnv.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      cnv.removeEventListener('dblclick', onDoubleClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, updatePointerType, onPan, onZoom, onTap, onDoubleTap, onInteractionStart, onInteractionEnd])
}
