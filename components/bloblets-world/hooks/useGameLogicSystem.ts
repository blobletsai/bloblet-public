import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import { useClientEventPublisher } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import type { Sprite } from '../types'

interface GameLogicSystemOptions {
    canvasRef: MutableRefObject<HTMLCanvasElement | null>
    stateRef: MutableRefObject<any>
    clearSelectedOpponent: () => void
    handleSelectOpponentAddress: (address: string, opts?: { focus?: boolean }) => void
}

export function useGameLogicSystem({
    canvasRef,
    stateRef,
    clearSelectedOpponent,
    handleSelectOpponentAddress,
}: GameLogicSystemOptions) {
    const eventPublisher = useClientEventPublisher()

    const onTap = useCallback((clientX: number, clientY: number) => {
        const cnv = canvasRef.current
        if (!cnv) return
        const st = stateRef.current

        const rect = cnv.getBoundingClientRect()
        const dpr = cnv.width / rect.width
        const fx = (clientX - rect.left) * dpr
        const fy = (clientY - rect.top) * dpr
        const wx = (fx - st.tx) / st.scale
        const wy = (fy - st.ty) / st.scale

        let best: Sprite | null = null
        let bestDistance = Infinity

        // Hit testing
        for (const sprite of st.sprites as Sprite[]) {
            const dxSprite = sprite.tx - wx
            const dySprite = sprite.ty - wy
            const dist = Math.hypot(dxSprite, dySprite)
            if (dist < sprite.r * 0.9 && dist < bestDistance) {
                best = sprite
                bestDistance = dist
            }
        }

        if (best && best.address) {
            const entityType = (best as any).entityType || 'bloblet'
            const addrCanonical = String(best.address || '').trim()

            if (entityType === 'landmark') {
                try {
                    (window as any).BlobletsWorld_setHighlight?.(addrCanonical)
                } catch { }
                const ownerAddress = (best as any).ownerAddress || null
                const propIdRaw = (best as any).landmarkId ?? (best as any).propId ?? null
                const propId = propIdRaw != null ? Number(propIdRaw) : null
                if (!propId || !Number.isFinite(propId) || propId <= 0) {
                    console.warn('[CanvasInteractions] landmark missing propId', {
                        address: best.address,
                        landmarkId: (best as any).landmarkId,
                        propId: (best as any).propId,
                    })
                    eventPublisher.emit(CLIENT_EVENT.PERSONA_CLOSE, {})
                    return
                }
                const detail = {
                    address: best.address,
                    addressCanonical: addrCanonical,
                    propId,
                    propType: (best as any).landmarkType ?? null,
                    name: (best as any).landmarkName ?? null,
                    renameCount: Number((best as any).renameCount || 0),
                    ownerAddress: ownerAddress,
                    ownerAddressCased: (best as any).ownerAddressCased || null,
                    worldX: best.tx,
                    worldY: best.ty,
                    radius: best.r || 48,
                    lastPrice: Number((best as any).landmarkPrice || 0),
                }
                eventPublisher.emit(CLIENT_EVENT.PERSONA_FOCUS_LANDMARK, detail)
                clearSelectedOpponent()
                return
            }

            if (st.myAddrCanonical && addrCanonical === st.myAddrCanonical) {
                try {
                    (window as any).BlobletsWorld_setHighlight?.(addrCanonical)
                } catch { }
                const display = (best as any).addressCased || best.address
                const blobletName = (best as any).name ?? null
                eventPublisher.emit(CLIENT_EVENT.PERSONA_FOCUS_BLOBLET, {
                    address: display,
                    addressCanonical: addrCanonical,
                    name: typeof blobletName === 'string' ? blobletName : null,
                    worldX: best.tx,
                    worldY: best.ty,
                })
                clearSelectedOpponent()
            } else {
                eventPublisher.emit(CLIENT_EVENT.PERSONA_CLOSE, {})
                handleSelectOpponentAddress(addrCanonical, { focus: true })
            }
            return
        }

        eventPublisher.emit(CLIENT_EVENT.PERSONA_CLOSE, {})
    }, [canvasRef, stateRef, clearSelectedOpponent, handleSelectOpponentAddress, eventPublisher])

    return {
        onTap
    }
}
