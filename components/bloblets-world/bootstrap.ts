"use client"

import { useEffect } from 'react'
import type { MutableRefObject } from 'react'

import { loadImage } from './assetLoader'
import { buildFixedFrames } from './frames'
import { TARGET_SIZES, WORLD_CENTER } from './constants'
import { assignHoldersToSlots } from './slots'
import type { Frame, Holder, Slot, Sprite } from './types'
import { appConfig } from '@/src/config/app'

const DEV_MODE = appConfig.isDev

function devLog(...args: unknown[]) {
  if (!DEV_MODE) return
  try {
    console.log(...args)
  } catch {
    // noop in non-browser environments
  }
}

function devWarn(...args: unknown[]) {
  if (!DEV_MODE) return
  try {
    console.warn(...args)
  } catch {
    // noop
  }
}

interface SeedDeps {
  stRef: MutableRefObject<any>
  rebuildIndex: () => void
  signalReady: () => void
}

export function createSeedSpritesFromSnapshot({
  stRef,
  rebuildIndex,
  signalReady,
}: SeedDeps) {
  return function seedSprites(tagged: Holder[]) {
    const st = stRef.current
    const sprites = assignHoldersToSlots(tagged, st.byTierSlots) as Sprite[]

    sprites.sort(
      (a, b) =>
        Math.hypot(a.tx - WORLD_CENTER.x, a.ty - WORLD_CENTER.y) -
        Math.hypot(b.tx - WORLD_CENTER.x, b.ty - WORLD_CENTER.y),
    )

    for (let i = 0; i < sprites.length; i++) {
      sprites[i]!.entryDelay = i * st.entryStagger
    }

    st.sprites = sprites
    rebuildIndex()
    signalReady()
  }
}

interface AtlasOptions {
  stRef: MutableRefObject<any>
  aliveSrc: string
  deadSrc: string
}

export function useCanvasBootstrap({
  stRef,
  aliveSrc,
  deadSrc,
}: AtlasOptions) {
  useEffect(() => {
    let cancelled = false

    async function loadAtlas() {
      if (!aliveSrc || !deadSrc) {
        devWarn('[BlobletsWorld] Missing sprite atlas sources', {
          aliveSrc,
          deadSrc,
        })
        return
      }

      try {
        const [alive, dead] = await Promise.all([
          loadImage(aliveSrc),
          loadImage(deadSrc),
        ])
        if (cancelled) return
        const st = stRef.current
        const framesAlive: Frame[] = buildFixedFrames(alive, TARGET_SIZES)
        const framesDead: Frame[] = buildFixedFrames(dead, TARGET_SIZES)
        st.framesAlive = framesAlive
        st.framesDead = framesDead
        const minR = Math.min(...framesAlive.map((fr) => fr.w * 0.5))
        st.gridCell = Math.max(12, Math.floor(minR * 1.2))
        devLog('[BlobletsWorld] Sprite atlas cached', {
          alive: st.framesAlive.length,
          dead: st.framesDead.length,
        })
      } catch (error) {
        devWarn('[BlobletsWorld] Failed to load sprite atlas', error)
      }
    }

    ;(async () => {
      await loadAtlas()
    })()

    return () => {
      cancelled = true
    }
  }, [
    aliveSrc,
    deadSrc,
    stRef,
  ])
}
