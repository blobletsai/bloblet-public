import type { Sprite } from './types'
import type { SpriteFrameState } from './spriteRenderUtils'
import {
  computeSpriteWorldTransform,
  resolveSpriteFrame,
} from './spriteRenderUtils'
import {
  computeHighlightAlpha,
  computeWorldY,
  renderEnergizeBubble,
  renderLandmarkOwnershipRing,
  renderScoutAura,
  renderSelectedOpponent,
  renderSelfHighlight,
} from './overlayRenderers'

interface RenderSpritesOptions {
  context: CanvasRenderingContext2D
  state: any
  timestamp: number
  now: number
  pixelPerfect: boolean
  width: number
  height: number
  visMargin: number
}

export function renderSprites({
  context,
  state,
  timestamp,
  now,
  pixelPerfect,
  width,
  height,
  visMargin,
}: RenderSpritesOptions) {
  const frameState = state as SpriteFrameState
  const ordered = (state.sprites as Sprite[])
    .slice()
    .sort(
      (a, b) =>
        computeWorldY(a, now, timestamp) - computeWorldY(b, now, timestamp),
    )

  const highlightAddr =
    typeof state.highlightAddr === 'string' ? state.highlightAddr : null
  const inspectHighlight =
    typeof state.inspectHighlight === 'string' ? state.inspectHighlight : null
  const myAddrCanonical =
    typeof state.myAddrCanonical === 'string' ? state.myAddrCanonical : null
  const highlightOwned =
    state.highlightOwnedLandmarks === true && typeof myAddrCanonical === 'string'

  for (const sprite of ordered) {
    if (sprite.address === 'placeholder_sprite' && state.myAddrCanonical) continue

    const frame = resolveSpriteFrame(frameState, sprite)
    if (!frame) continue

    const {
      wx,
      wy,
      scaleB,
      alpha: baseAlpha,
      shouldResetMode,
    } = computeSpriteWorldTransform(sprite, now, timestamp)

    if (shouldResetMode) {
      sprite.mode = 'idle'
    }

    const sizeMultiplier = (sprite as any).sizeMultiplier || 1.0
    const sx = wx * state.scale + state.tx
    const sy = wy * state.scale + state.ty
    const dw = frame.w * state.scale * scaleB * sizeMultiplier
    const dh = frame.h * state.scale * scaleB * sizeMultiplier

    if (
      sx + dw < -visMargin ||
      sy + dh < -visMargin ||
      sx - visMargin > width ||
      sy - visMargin > height
    ) {
      continue
    }

    const dx = pixelPerfect ? Math.round(sx - dw / 2) : sx - dw / 2
    const dy = pixelPerfect ? Math.round(sy - dh / 2) : sy - dh / 2

    const addrCanonical =
      typeof sprite.address === 'string' ? sprite.address.trim() : ''
    const highlightModeActive = state.scoutModeActive === true
    const scoutedMeta =
      highlightModeActive && addrCanonical
        ? state.scoutedMap?.get(addrCanonical)
        : null
    const isHighlightedOpponent = Boolean(scoutedMeta)
    const isLandmark = String(sprite.address || '').startsWith('landmark_')

    context.save()

    if (isLandmark) {
      const glowRadius = Math.max(dw, dh) * 1.4
      const glow = context.createRadialGradient(
        sx,
        sy,
        glowRadius * 0.1,
        sx,
        sy,
        glowRadius,
      )
      glow.addColorStop(0, 'rgba(186,140,255,0.42)')
      glow.addColorStop(0.4, 'rgba(122,240,255,0.20)')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      context.save()
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha = 0.8
      context.fillStyle = glow
      context.fillRect(
        sx - glowRadius,
        sy - glowRadius,
        glowRadius * 2,
        glowRadius * 2,
      )
      context.restore()
      const ownerAddress = (sprite as any).ownerAddress || null
      const isOwnedLandmark =
        !!(highlightOwned && ownerAddress && myAddrCanonical && ownerAddress === myAddrCanonical)
      if (isOwnedLandmark) {
        renderLandmarkOwnershipRing(context, sx, sy, dw, dh, now)
        context.save()
        context.globalCompositeOperation = 'lighter'
        const pulse = 0.35 + 0.25 * (1 + Math.sin(now * 0.006))
        const overlayRadius = Math.max(dw, dh) * (0.5 + pulse * 0.12)
        context.fillStyle = `rgba(125,211,252,${0.18 + pulse * 0.22})`
        context.beginPath()
        context.arc(sx, sy, overlayRadius, 0, Math.PI * 2)
        context.fill()
        context.restore()
      }
    }

    const alpha = computeHighlightAlpha(baseAlpha, {
      highlightModeActive,
      isHighlightedOpponent,
      address: addrCanonical,
      highlightAddr,
      inspectHighlight,
      myAddress: myAddrCanonical,
    })
    context.globalAlpha = alpha
    context.drawImage(frame.canvas, dx, dy, dw, dh)
    context.globalAlpha = 1

    const isSelectedOpponent =
      !!(addrCanonical && state.inspectHighlight && addrCanonical === state.inspectHighlight)
    const isHoveringOpponent =
      !!(addrCanonical && state.hoverHighlight && addrCanonical === state.hoverHighlight)

    const isSelfHighlighted =
      !!(
        sprite.address &&
        state.highlightAddr &&
        addrCanonical === state.highlightAddr &&
        state.myAddrCanonical &&
        state.highlightAddr === state.myAddrCanonical
      )

    if (isSelfHighlighted) {
      renderSelfHighlight(context, sx, sy, sprite, state, now)
    }

    const energizeStatus = state.energizeStatus
    if (isSelfHighlighted && energizeStatus && energizeStatus.state === 'ready') {
      renderEnergizeBubble(context, sx, sy, energizeStatus, state, sprite)
    }

    if (
      highlightModeActive &&
      scoutedMeta &&
      (!state.myAddrCanonical || addrCanonical !== state.myAddrCanonical)
    ) {
      renderScoutAura({
        context,
        sx,
        sy,
        now,
        address: addrCanonical,
        scoutedMeta,
        isHoveringOpponent,
        isSelectedOpponent,
        state,
      })
    }

    if (isSelectedOpponent) {
      renderSelectedOpponent({
        context,
        sx,
        sy,
        now,
        sprite,
      })
    }

    context.restore()
  }
}
