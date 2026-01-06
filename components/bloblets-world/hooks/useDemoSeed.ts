"use client"

import { useEffect } from 'react'
import type { MutableRefObject } from 'react'

import {
  STAGGER_BUDGET_MS,
  ENTRY_TOTAL_BUDGET_MS,
  TARGET_SIZES,
  TIERS,
} from '../constants'
import {
  bucketHolders,
  demoSnapshot,
  generateReferenceSlotsAsync,
} from '../slots'
import type { Holder } from '../types'
import { appConfig } from '@/src/config/app'

const DEV_MODE = appConfig.isDev

function devLog(...args: unknown[]) {
  if (!DEV_MODE) return
  try {
    console.log(...args)
  } catch {
    // ignore logging failures
  }
}

type DemoSeedOptions = {
  enabled: boolean
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  stateRef: MutableRefObject<any>
  seedSpritesFromSnapshot: (snapshot: Holder[]) => void
  positionCameraToWorld: (fitFully?: boolean) => void
}

export function useDemoSeed({
  enabled,
  canvasRef,
  stateRef,
  seedSpritesFromSnapshot,
  positionCameraToWorld,
}: DemoSeedOptions) {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    ;(async () => {
      const st = stateRef.current
      if (st.lastSnapshot?.length) return
      const expectExternal =
        typeof window !== 'undefined' &&
        Boolean((window as any).BlobletsWorld_snapshotRequested)

      if (expectExternal) {
        devLog('[BlobletsWorld] Skipping demo seed; awaiting SSR snapshot')
        positionCameraToWorld(true)
        return
      }

      let holders: Holder[]
      if (
        typeof window !== 'undefined' &&
        Array.isArray((window as any).__BLOBLETS_DEMO_SNAPSHOT__)
      ) {
        holders = (window as any).__BLOBLETS_DEMO_SNAPSHOT__ as Holder[]
        devLog('[BlobletsWorld] Seeding demo snapshot from window payload', {
          total: holders.length,
        })
      } else {
        holders = bucketHolders(demoSnapshot(1000))
        devLog('[BlobletsWorld] Generated demo snapshot locally', {
          total: holders.length,
        })
      }

      const counts = new Array(TIERS).fill(0)
      for (const holder of holders) {
        const rawTier = (holder as any).tier as number
        const tier = Number.isFinite(rawTier)
          ? Math.max(0, Math.min(TIERS - 1, Math.floor(rawTier)))
          : 0
        counts[tier] = (counts[tier] ?? 0) + 1
      }

      const radii = TARGET_SIZES.map((px) => px * 0.5 * 1.05)

      st.byTierSlots = await generateReferenceSlotsAsync(counts, radii)
      if (cancelled) return

      seedSpritesFromSnapshot(holders)

      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      st.entryStart = now
      st.entryEndBy = now + ENTRY_TOTAL_BUDGET_MS
      st.entryActive = true
      const total = st.sprites.length || 1
      st.entryStagger = Math.max(
        0.3,
        Math.min(1.5, STAGGER_BUDGET_MS / total),
      )

      positionCameraToWorld(true)
      devLog('[BlobletsWorld] Demo snapshot seeded', { total })
    })().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [enabled, positionCameraToWorld, seedSpritesFromSnapshot, stateRef])

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.classList.add('bloblets-demo-seed')
    return () => {
      canvas.classList.remove('bloblets-demo-seed')
    }
  }, [canvasRef, enabled])
}
