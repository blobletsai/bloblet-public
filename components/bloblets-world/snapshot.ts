"use client"

import type { MutableRefObject } from 'react'
import { loadImage } from './assetLoader'
import { buildFixedFrames } from './frames'
import {
  ENTRY_TOTAL_BUDGET_MS,
  STAGGER_BUDGET_MS,
  TARGET_SIZES,
  TIERS,
  WORLD_CENTER,
} from './constants'
import {
  assignHoldersToSlots,
  bucketHolders,
  generateReferenceSlotsAsync,
} from './slots'
import type { Holder, Sprite } from './types'

type HolderMeta = Record<
  string,
  {
    balance: number | null
    name?: string | null
    addressCased?: string | null
    aliveUrl?: string | null
    deadUrl?: string | null
  }
>

interface SnapshotDeps {
  stRef: MutableRefObject<any>
  setHolderMeta: (meta: HolderMeta) => void
  getSelectedOpponent: () => string | null
  clearSelectedOpponent: () => void
  rebuildIndex: () => void
  signalReady: () => void
}

export function createApplySnapshot({
  stRef,
  setHolderMeta,
  getSelectedOpponent,
  clearSelectedOpponent,
  rebuildIndex,
  signalReady,
}: SnapshotDeps) {
  return async function applySnapshot(holdersRaw: Holder[]) {
    console.log(
      '[BlobletsWorld] applySnapshot called with',
      holdersRaw.length,
      'holders',
    )
    const st = stRef.current
    st.lastSnapshot = Array.isArray(holdersRaw)
      ? holdersRaw.map((h) => ({ ...h }))
      : []

    const holders = bucketHolders(holdersRaw)

    const metaMap: HolderMeta = {}
    for (const h of holders) {
      const key = String(h.address || '').trim()
      const rewardBalanceRaw = (h as any).rewardBalance
      const rewardBalance =
        rewardBalanceRaw != null && Number.isFinite(Number(rewardBalanceRaw))
          ? Number(rewardBalanceRaw)
          : null
      metaMap[key] = {
        balance: rewardBalance,
        name: (h as any).name ?? (typeof h.name === 'string' ? h.name : null),
        addressCased:
          (h as any).addressCased ??
          (typeof h.address === 'string' ? h.address : null),
        aliveUrl: h.avatar_alive_url_256 ?? null,
        deadUrl: h.dead_url ?? null,
      }
    }
    setHolderMeta(metaMap)

    const selectedOpponent = getSelectedOpponent()
    if (selectedOpponent && !metaMap[selectedOpponent]) {
      clearSelectedOpponent()
    } else if (selectedOpponent) {
      st.inspectHighlight = selectedOpponent
    }

    const counts: number[] = new Array(TIERS).fill(0).map(() => 0)
    for (const h of holders) {
      const tRaw = (h as any).tier as number
      const t = Number.isFinite(tRaw)
        ? Math.max(0, Math.min(TIERS - 1, Math.floor(tRaw)))
        : 0
      counts[t] = (counts[t] ?? 0) + 1
    }
    const radii = TARGET_SIZES.map((px) => px * 0.5 * 1.05)

    try {
      const uniqueAlive = Array.from(
        new Set(
          (holdersRaw || [])
            .map((h) => (h.avatar_alive_url_256 || '').trim())
            .filter(Boolean),
        ),
      )
      const uniqueDead = Array.from(
        new Set(
          (holdersRaw || [])
            .map((h) => (h.dead_url || '').trim())
            .filter(Boolean),
        ),
      )
      const toLoadAlive = uniqueAlive.filter(
        (u) => !st.framesAliveMap.has(u),
      )
      const toLoadDead = uniqueDead.filter(
        (u) => !st.framesDeadMap.has(u),
      )

      if (toLoadAlive.length || toLoadDead.length) {
        const aliveImgs = await Promise.all(
          toLoadAlive.map((u) =>
            loadImage(u).catch(() => null),
          ),
        )
        for (let i = 0; i < toLoadAlive.length; i++) {
          const url = toLoadAlive[i]!
          const img = aliveImgs[i]
          if (img) {
            st.framesAliveMap.set(url, buildFixedFrames(img, TARGET_SIZES))
          }
        }

        const deadImgs = await Promise.all(
          toLoadDead.map((u) =>
            loadImage(u).catch(() => null),
          ),
        )
        for (let i = 0; i < toLoadDead.length; i++) {
          const url = toLoadDead[i]!
          const img = deadImgs[i]
          if (img) {
            st.framesDeadMap.set(url, buildFixedFrames(img, TARGET_SIZES))
          }
        }

        console.log('[BlobletsWorld] Variant frames cached', {
          alive: st.framesAliveMap.size,
          dead: st.framesDeadMap.size,
        })
      }
    } catch {}

    st.byTierSlots = await generateReferenceSlotsAsync(counts, radii)

    const next = assignHoldersToSlots(
      holders,
      st.byTierSlots,
    ) as (Sprite & {
      aliveKey?: string
      deadKey?: string
      addressCased?: string
    })[]

    const byAddr = new Map<
      string,
      { aliveUrl?: string; deadUrl?: string; name?: string; addressCased?: string; socialHandle?: string }
    >(
      holdersRaw.map((h) => [
        String(h.address || '').trim(),
        {
          aliveUrl: h.avatar_alive_url_256 || undefined,
          deadUrl: h.dead_url || undefined,
          name: h.name || undefined,
          addressCased: (h as any).addressCased,
          socialHandle: (h as any).socialHandle ?? (h as any).social_handle,
        },
      ]),
    )

    for (const s of next) {
      const meta = byAddr.get(String(s.address || '').trim())
      if (meta) {
        s.aliveKey = (meta.aliveUrl || '').trim() || undefined
        s.deadKey = (meta.deadUrl || '').trim() || undefined
        if (meta.name) (s as any).name = meta.name
        if (meta.socialHandle) (s as any).socialHandle = meta.socialHandle
        if (meta.addressCased) (s as any).addressCased = meta.addressCased
      }
    }

    const now = performance.now()
    st.entryStart = now
    st.entryEndBy = now + ENTRY_TOTAL_BUDGET_MS
    st.entryActive = true

    next.sort(
      (a, b) =>
        Math.hypot(a.tx - WORLD_CENTER.x, a.ty - WORLD_CENTER.y) -
        Math.hypot(b.tx - WORLD_CENTER.x, b.ty - WORLD_CENTER.y),
    )
    const N = next.length || 1
    st.entryStagger = Math.max(0.3, Math.min(1.5, STAGGER_BUDGET_MS / N))

    for (let i = 0; i < next.length; i++) {
      const ns = next[i]!
      ns.entryDelay = i * st.entryStagger
      ns.x = WORLD_CENTER.x
      ns.y = WORLD_CENTER.y
      ns.vx = 0
      ns.vy = 0
      ns.alpha = 0
      ns.scaleBump = 0.2
      ns.mode = 'entry'
    }

    st.sprites = next
    console.log('[BlobletsWorld] Created', st.sprites.length, 'sprites')

    rebuildIndex()
    signalReady()
    console.log(
      '[BlobletsWorld] Rebuilt index with',
      st.addrToIdx.size,
      'addresses',
    )

    if (st.addrToIdx.size > 0) {
      const samples = Array.from(st.addrToIdx.keys()).slice(0, 3)
      console.log('[BlobletsWorld] Sample addresses in index:', samples)
    }
  }
}
