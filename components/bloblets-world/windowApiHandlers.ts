"use client"

import { useMemo } from 'react'
import type { MutableRefObject } from 'react'

import { buildFixedFrames } from './frames'
import { loadImage } from './assetLoader'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import {
  ENTRY_TOTAL_BUDGET_MS,
  SIZE_SCALE_FOR_BOB,
  TARGET_SIZES,
  WORLD_CENTER,
  WORLD_H,
  WORLD_W,
} from './constants'
import { enforceSpriteSeparation } from './slots'
import { hash32 } from './math'
import type { Slot } from './types'
import { appConfig } from '@/src/config/app'

const DEV_MODE = appConfig.isDev

function devLog(...args: unknown[]) {
  if (!DEV_MODE) return
  try {
    console.log(...args)
  } catch {
    // noop — console logging is best effort in dev only
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

type DeltaChange = {
  address: string
  alive?: boolean
  name?: string
  remove?: boolean
  ownerAddress?: string | null
  ownerAddressCased?: string | null
  renameCount?: number | null
  landmarkPrice?: number | null
  landmarkName?: string | null
  propId?: number | null
}

type AddSpriteInput = {
  address: string
  alive: boolean
  name?: string
  socialHandle?: string
  aliveUrl?: string
  deadUrl?: string
  replace?: boolean
  size_multiplier?: number
}

interface WindowApiDeps {
  stRef: MutableRefObject<any>
  rebuildIndex: () => void
  applySnapshot: (snapshot: any[]) => Promise<unknown> | unknown
  setMyAddressState: (addr: string) => void
  setMyAddressDisplay: (addr: string) => void
}

export function createApplyDelta({
  stRef,
  rebuildIndex,
}: Pick<WindowApiDeps, 'stRef' | 'rebuildIndex'>) {
  return function applyDelta(changes: DeltaChange[]) {
    const st = stRef.current
    if (!Array.isArray(changes) || !changes.length) return false
    if (!st.addrToIdx || st.addrToIdx.size === 0) {
      devWarn('[BlobletsWorld] applyDelta skipped — sprite index not initialised')
      return false
    }

    let changed = 0

    for (const change of changes) {
      const key = String(change?.address || '').trim()
      if (!key) continue
      const index = st.addrToIdx.get(key)

      if (change.remove) {
        if (index === undefined) continue
        const removed = st.sprites[index]
        st.sprites.splice(index, 1)
        rebuildIndex()
        if (removed?.address === 'placeholder_sprite') {
          enforceSpriteSeparation(st.sprites)
          rebuildIndex()
        }
        changed++
        continue
      }

      if (index === undefined) {
        devLog('[BlobletsWorld] applyDelta — sprite not found for address', key)
        continue
      }

      const sprite = st.sprites[index]
      if (!sprite) continue

      if (change.alive !== undefined) {
        const nextAlive = Boolean(change.alive)
        if (sprite.alive !== nextAlive) {
          sprite.alive = nextAlive
          changed++
        }
      }
      if (change.name !== undefined) {
        const nextNameRaw = String(change.name ?? '').trim()
        const prevName = typeof sprite.name === 'string' ? sprite.name : ''
        if (nextNameRaw !== prevName) {
          if (nextNameRaw) sprite.name = nextNameRaw
          else sprite.name = ''
          changed++
        }
        if ((sprite as any).entityType === 'landmark') {
          const currentLandmarkName =
            typeof (sprite as any).landmarkName === 'string'
              ? (sprite as any).landmarkName
              : ''
          if (currentLandmarkName !== nextNameRaw) {
            (sprite as any).landmarkName = nextNameRaw || null
            changed++
          }
        }
      }
      if ((change as any).socialHandle !== undefined) {
        const nextHandle = String((change as any).socialHandle ?? '').trim()
        const prevHandle =
          typeof (sprite as any).socialHandle === 'string' ? (sprite as any).socialHandle : ''
        if (nextHandle !== prevHandle) {
          if (nextHandle) (sprite as any).socialHandle = nextHandle
          else delete (sprite as any).socialHandle
          changed++
        }
      }
      if (change.landmarkName !== undefined) {
        const nextLandmarkName = String(change.landmarkName ?? '').trim()
        const currentLandmarkName =
          typeof (sprite as any).landmarkName === 'string'
            ? (sprite as any).landmarkName
            : ''
        if (currentLandmarkName !== nextLandmarkName) {
          (sprite as any).landmarkName = nextLandmarkName || null
          changed++
        }
      }
      if (change.ownerAddress !== undefined || change.ownerAddressCased !== undefined) {
        if (change.ownerAddress !== undefined) {
          const nextOwnerAddress =
            change.ownerAddress != null ? String(change.ownerAddress).trim() : null
          const prevOwnerAddress =
            typeof (sprite as any).ownerAddress === 'string'
              ? String((sprite as any).ownerAddress)
              : null
          if (prevOwnerAddress !== nextOwnerAddress) {
            (sprite as any).ownerAddress = nextOwnerAddress
            changed++
          }
        }
        if (change.ownerAddressCased !== undefined) {
          const nextOwnerAddressCased =
            change.ownerAddressCased != null ? String(change.ownerAddressCased).trim() : null
          const prevOwnerAddressCased =
            typeof (sprite as any).ownerAddressCased === 'string'
              ? String((sprite as any).ownerAddressCased)
              : null
          if (prevOwnerAddressCased !== nextOwnerAddressCased) {
            (sprite as any).ownerAddressCased = nextOwnerAddressCased
            changed++
          }
        }
      }
      if (change.renameCount !== undefined) {
        const nextRenameCount =
          change.renameCount != null ? Number(change.renameCount) : null
        if ((sprite as any).renameCount !== nextRenameCount) {
          (sprite as any).renameCount = nextRenameCount
          changed++
        }
      }
      if (change.landmarkPrice !== undefined) {
        const nextPrice =
          change.landmarkPrice != null ? Number(change.landmarkPrice) : null
        if ((sprite as any).landmarkPrice !== nextPrice) {
          (sprite as any).landmarkPrice = nextPrice
          changed++
        }
      }
      if (change.propId !== undefined) {
        const nextPropId =
          change.propId != null && Number.isFinite(Number(change.propId))
            ? Number(change.propId)
            : null
        if ((sprite as any).landmarkId !== nextPropId) {
          (sprite as any).landmarkId = nextPropId
          changed++
        }
      }
    }

    if (changed > 0) {
      emitClientEvent(CLIENT_EVENT.SPRITES_UPDATED, {})
    }

    return changed > 0
  }
}

export function createRemovePlaceholder({
  stRef,
  applySnapshot,
  rebuildIndex,
}: Pick<WindowApiDeps, 'stRef' | 'applySnapshot' | 'rebuildIndex'>) {
  return async function removePlaceholder() {
    const st = stRef.current
    const baseSnapshot = (st.lastSnapshot || []).filter(
      (h: any) => String(h.address || '').trim() !== 'placeholder_sprite',
    )
    if (baseSnapshot.length) {
      await applySnapshot(baseSnapshot)
      return true
    }

    const idx = st.addrToIdx.get('placeholder_sprite')
    if (idx === undefined) return false

    st.sprites.splice(idx, 1)
    enforceSpriteSeparation(st.sprites)
    rebuildIndex()
    return true
  }
}

export function createReplayEntry({
  stRef,
  applySnapshot,
}: Pick<WindowApiDeps, 'stRef' | 'applySnapshot'>) {
  return async function replayEntry() {
    const st = stRef.current
    if (!st.lastSnapshot?.length) return false
    await applySnapshot(st.lastSnapshot.map((holder: any) => ({ ...holder })))
    return true
  }
}

export function createAddSprites({
  stRef,
  rebuildIndex,
}: Pick<WindowApiDeps, 'stRef' | 'rebuildIndex'>) {
  return async function addSprites(adds: AddSpriteInput[]) {
    try {
      if (!Array.isArray(adds) || adds.length === 0) return false
      const st = stRef.current
      let mutated = false

      const uniqueAlive = Array.from(
        new Set(adds.map((a) => (a.aliveUrl || '').trim()).filter(Boolean)),
      )
      const uniqueDead = Array.from(
        new Set(adds.map((a) => (a.deadUrl || '').trim()).filter(Boolean)),
      )
      const toLoadAlive = uniqueAlive.filter((url) => !st.framesAliveMap.has(url))
      const toLoadDead = uniqueDead.filter((url) => !st.framesDeadMap.has(url))

      if (toLoadAlive.length) {
        const imgs = await Promise.all(
          toLoadAlive.map((url) => loadImage(url).catch(() => null)),
        )
        for (let i = 0; i < toLoadAlive.length; i++) {
          const url = toLoadAlive[i]!
          const img = imgs[i]
          if (img) {
            st.framesAliveMap.set(url, buildFixedFrames(img, TARGET_SIZES))
          }
        }
      }

      if (toLoadDead.length) {
        const imgs = await Promise.all(
          toLoadDead.map((url) => loadImage(url).catch(() => null)),
        )
        for (let i = 0; i < toLoadDead.length; i++) {
          const url = toLoadDead[i]!
          const img = imgs[i]
          if (img) {
            st.framesDeadMap.set(url, buildFixedFrames(img, TARGET_SIZES))
          }
        }
      }

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()

      const pickFreeSlot = (): { slot: Slot; tier: number } | null => {
        const tiers = [3, 2, 1, 0]
        for (const tier of tiers) {
          const slots = st.byTierSlots[tier] || []
          for (const slot of slots) {
            let ok = true
            for (const sprite of st.sprites) {
              const spriteRadius =
                sprite.r * ((sprite as any).sizeMultiplier || 1.0)
              const slotRadius = slot.r
              if (
                Math.hypot(sprite.tx - slot.x, sprite.ty - slot.y) <
                spriteRadius + slotRadius + 1
              ) {
                ok = false
                break
              }
            }
            if (ok) return { slot, tier }
          }
        }
        return null
      }

      for (const add of adds) {
        const key = String(add?.address || '').trim()
        if (!key) continue

        const replace = Boolean((add as any).replace)
        const sizeMultRaw = (add as any).size_multiplier
        const hasExisting = st.addrToIdx.has(key)

        if (hasExisting && replace) {
          const idx = st.addrToIdx.get(key)
          if (idx !== undefined) {
            const sprite = st.sprites[idx]
            if (sprite) {
              if ((sprite as any).aliveKey) {
                st.framesAliveMap.delete((sprite as any).aliveKey)
              }
              if ((sprite as any).deadKey) {
                st.framesDeadMap.delete((sprite as any).deadKey)
              }
              sprite.alive = Boolean(add.alive)
              if (add.name !== undefined) sprite.name = add.name || undefined
              if (add.socialHandle !== undefined) {
                if (add.socialHandle) (sprite as any).socialHandle = add.socialHandle
                else delete (sprite as any).socialHandle
              }
              if (add.aliveUrl) sprite.aliveKey = add.aliveUrl.trim()
              if (add.deadUrl) sprite.deadKey = add.deadUrl.trim()
              if (sizeMultRaw !== undefined) {
                const mult = Number(sizeMultRaw)
                sprite.sizeMultiplier =
                  Number.isFinite(mult) && mult > 0 ? mult : 1.0
              }
              mutated = true
            }
          }
          continue
        }

        if (hasExisting) continue

        let slot: Slot
        let tier: number
        if (key === 'placeholder_sprite') {
          slot = { x: WORLD_CENTER.x, y: WORLD_CENTER.y, tier: 0, r: 150 }
          tier = 0
        } else {
          const pick = pickFreeSlot()
          if (!pick) {
            devWarn('[BlobletsWorld] addSprites — no free slot for', key)
            continue
          }
          slot = pick.slot
          tier = pick.tier
        }

        const mass = Math.max(1, slot.r * slot.r * 0.0005)
        let spawnX: number
        let spawnY: number

        if (key === 'placeholder_sprite') {
          spawnX = WORLD_CENTER.x
          spawnY = WORLD_CENTER.y
        } else {
          spawnX =
            WORLD_CENTER.x +
            ((hash32(`${key}x`) % 1000) / 1000 - 0.5) * WORLD_W * 0.8
          spawnY =
            WORLD_CENTER.y +
            ((hash32(`${key}y`) % 1000) / 1000 - 0.5) * WORLD_H * 0.8

          for (const existing of st.sprites) {
            const dx = spawnX - existing.x
            const dy = spawnY - existing.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const isLandmark = existing.address.startsWith('landmark_')
            const padding = isLandmark ? 20 : 10
            const newRadius =
              slot.r * ((add as any).size_multiplier || 1.0)
            const existingRadius =
              existing.r * ((existing as any).sizeMultiplier || 1.0)
            const collisionDistance = newRadius + existingRadius + padding

            if (distance < collisionDistance && distance > 0) {
              const push = collisionDistance - distance
              const angle = Math.atan2(dy, dx)
              spawnX += Math.cos(angle) * push
              spawnY += Math.sin(angle) * push
            }
          }
        }

        const sizeMultiplier = (() => {
          if (sizeMultRaw === undefined) return 1.0
          const mult = Number(sizeMultRaw)
          return Number.isFinite(mult) && mult > 0 ? mult : 1.0
        })()

        const sprite: any = {
          address: key,
          tier,
          alive: Boolean(add.alive),
          tx: spawnX,
          ty: spawnY,
          r: slot.r,
          x: spawnX,
          y: spawnY,
          vx: 0,
          vy: 0,
          mass,
          alpha: 0,
          scaleBump: 0.2,
          phase: 0,
          speed: 0.3,
          bobAmp: 2 * (SIZE_SCALE_FOR_BOB[tier] || 1),
          entryDelay: 0,
          mode: 'entry',
          name: add.name || undefined,
          socialHandle: add.socialHandle || undefined,
          sizeMultiplier,
        }

        if (add.aliveUrl) sprite.aliveKey = add.aliveUrl.trim()
        if (add.deadUrl) sprite.deadKey = add.deadUrl.trim()

        st.sprites.push(sprite)
        st.addrToIdx.set(key, st.sprites.length - 1)
        if (!st.entryActive) {
          st.entryActive = true
          st.entryStart = now
          st.entryEndBy = now + ENTRY_TOTAL_BUDGET_MS
        }
        mutated = true
      }

      enforceSpriteSeparation(st.sprites)
      rebuildIndex()
      if (mutated) {
        emitClientEvent(CLIENT_EVENT.SPRITES_UPDATED, {})
      }
      return true
    } catch (err) {
      devWarn('[BlobletsWorld] addSprites error', err)
      return false
    }
  }
}

export function createSetHighlightAddress({
  stRef,
}: Pick<WindowApiDeps, 'stRef'>) {
  return function setHighlightAddress(addressCanonical: string) {
    const key = String(addressCanonical || '').trim()
    if (!key) return false
    if (stRef.current.myAddrCanonical && key !== stRef.current.myAddrCanonical) {
      return false
    }
    stRef.current.highlightAddr = key
    try {
      localStorage.setItem('blob:highlight_addr', key)
    } catch {}
    return true
  }
}

export function createSetMyAddressForSession({
  stRef,
  setMyAddressState,
  setMyAddressDisplay,
}: Pick<
  WindowApiDeps,
  'stRef' | 'setMyAddressState' | 'setMyAddressDisplay'
>) {
  return function setMyAddressForSession(
    addressCanonical: string,
    displayAddress?: string,
  ) {
    const canonical = String(addressCanonical || '').trim()
    if (!canonical) return false
    const display = displayAddress ? String(displayAddress).trim() : canonical
    const st = stRef.current
    st.myAddrCanonical = canonical
    st.myAddrDisplay = display
    setMyAddressState(canonical)
    setMyAddressDisplay(display)
    st.highlightOwnedLandmarks = false

    try {
      localStorage.setItem('blob:my_addr', canonical)
      localStorage.setItem('blob:my_addr_display', display)
      localStorage.setItem('blob:highlight_addr', canonical)
    } catch {}

    st.highlightAddr = canonical
    return true
  }
}

export function createClearSessionForWindow({
  stRef,
  setMyAddressState,
  setMyAddressDisplay,
}: Pick<
  WindowApiDeps,
  'stRef' | 'setMyAddressState' | 'setMyAddressDisplay'
>) {
  return function clearSessionForWindow() {
    const st = stRef.current
    st.myAddrCanonical = ''
    st.myAddrDisplay = ''
    st.highlightAddr = ''
    st.highlightOwnedLandmarks = false
    setMyAddressState('')
    setMyAddressDisplay('')

    try {
      localStorage.removeItem('blob:my_addr')
    } catch {}
    try {
      localStorage.removeItem('blob:my_addr_display')
    } catch {}
    try {
      localStorage.removeItem('blob:highlight_addr')
    } catch {}

    return true
  }
}

export function useWindowApiHandlers({
  stRef,
  rebuildIndex,
  applySnapshot,
  setMyAddressState,
  setMyAddressDisplay,
}: WindowApiDeps) {
  const applyDelta = useMemo(
    () => createApplyDelta({ stRef, rebuildIndex }),
    [stRef, rebuildIndex],
  )
  const removePlaceholder = useMemo(
    () => createRemovePlaceholder({ stRef, applySnapshot, rebuildIndex }),
    [stRef, applySnapshot, rebuildIndex],
  )
  const replayEntry = useMemo(
    () => createReplayEntry({ stRef, applySnapshot }),
    [stRef, applySnapshot],
  )
  const addSprites = useMemo(
    () => createAddSprites({ stRef, rebuildIndex }),
    [stRef, rebuildIndex],
  )
  const setHighlightAddress = useMemo(
    () => createSetHighlightAddress({ stRef }),
    [stRef],
  )
  const setMyAddressForSession = useMemo(
    () =>
      createSetMyAddressForSession({
        stRef,
        setMyAddressState,
        setMyAddressDisplay,
      }),
    [stRef, setMyAddressState, setMyAddressDisplay],
  )
  const clearSessionForWindow = useMemo(
    () =>
      createClearSessionForWindow({
        stRef,
        setMyAddressState,
        setMyAddressDisplay,
      }),
    [stRef, setMyAddressState, setMyAddressDisplay],
  )

  return useMemo(
    () => ({
      applyDelta,
      removePlaceholder,
      replayEntry,
      addSprites,
      setHighlightAddress,
      setMyAddressForSession,
      clearSessionForWindow,
    }),
    [
      applyDelta,
      removePlaceholder,
      replayEntry,
      addSprites,
      setHighlightAddress,
      setMyAddressForSession,
      clearSessionForWindow,
    ],
  )
}
