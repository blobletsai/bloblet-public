import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import { clamp } from '../math'

interface CameraSystemOptions {
    canvasRef: MutableRefObject<HTMLCanvasElement | null>
    stateRef: MutableRefObject<any>
    minScaleFor: (baseFit: number) => number
    maxScale: number
}

export function useCameraSystem({
    canvasRef,
    stateRef,
    minScaleFor,
    maxScale,
}: CameraSystemOptions) {
    const onPan = useCallback((dx: number, dy: number) => {
        const cnv = canvasRef.current
        if (!cnv) return
        const st = stateRef.current

        const multiplier = cnv.width / cnv.getBoundingClientRect().width
        st.tx += dx * multiplier
        st.ty += dy * multiplier
        st.vx = dx * multiplier
        st.vy = dy * multiplier
    }, [canvasRef, stateRef])

    const onZoom = useCallback((factor: number, clientX: number, clientY: number) => {
        const cnv = canvasRef.current
        if (!cnv) return
        const st = stateRef.current

        const rect = cnv.getBoundingClientRect()
        const dpr = cnv.width / rect.width
        const fx = (clientX - rect.left) * dpr
        const fy = (clientY - rect.top) * dpr
        const wx = (fx - st.tx) / st.scale
        const wy = (fy - st.ty) / st.scale
        const minScale = minScaleFor(st.fitScale)
        const nextScale = clamp(st.scale * factor, minScale, maxScale)

        st.tx = fx - wx * nextScale
        st.ty = fy - wy * nextScale
        st.scale = nextScale
    }, [canvasRef, stateRef, minScaleFor, maxScale])

    const onInteractionStart = useCallback(() => {
        const st = stateRef.current
        st.dragging = true
        st.vx = 0
        st.vy = 0
    }, [stateRef])

    const onInteractionEnd = useCallback(() => {
        const st = stateRef.current
        st.dragging = false
    }, [stateRef])

    const onDoubleTap = useCallback((clientX: number, clientY: number) => {
        // Double tap zooms in 1.6x
        onZoom(1.6, clientX, clientY)
    }, [onZoom])

    return {
        onPan,
        onZoom,
        onInteractionStart,
        onInteractionEnd,
        onDoubleTap
    }
}
