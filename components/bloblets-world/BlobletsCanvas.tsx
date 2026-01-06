"use client"

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { startRenderLoop } from './renderLoop'
import { createApplySnapshot } from './snapshot'
import { emptyEnergizeUi } from './energizeState'
import { createSeedSpritesFromSnapshot, useCanvasBootstrap } from './bootstrap'
import { useCanvasViewport } from './hooks/useCanvasViewport'
import { useCanvasInteractions } from './hooks/useCanvasInteractions'
import { useCanvasLifecycle } from './hooks/useCanvasLifecycle'
import { useSpriteFocus } from './hooks/useSpriteFocus'
import { useDemoSeed } from './hooks/useDemoSeed'
import { useGameplayReactions } from './hooks/useGameplayReactions'
import { useOpponentHighlights } from './hooks/useOpponentHighlights'
import { useWindowApiHandlers } from './windowApiHandlers'
import { useWindowBridgeHandlers } from './hooks/useWindowBridgeHandlers'
import { useWindowBindings } from './hooks/useWindowBindings'
import {
  CLIENT_EVENT,
} from '@/src/client/events/clientEventMap'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'
import type { Frame, Holder, HolderMetaEntry, Slot, Sprite, HubTab, WorldProp } from './types'
import type { HighlightedTarget } from './opponentSelectors'
import { defaultAvatars } from './avatar'
import { useGameplayRealtime } from "@/src/client/realtime/gameplay"
import { gameplayConfig } from '@/src/config/gameplay'
import { featuresConfig } from '@/src/config/features'
import { useWorldCanvas } from './WorldContext'

const MAX_CANVAS_SCALE = gameplayConfig.world.maxZoom
const DEMO_SEED_ENABLED = featuresConfig.demoSeed

const SCOUTED_LIMIT = 3

const worldToScreen = (
  worldX: number,
  worldY: number,
  state: any,
  canvas: HTMLCanvasElement | null,
) => {
  if (!canvas || !state) return null
  const rect = canvas.getBoundingClientRect()
  const dpr = canvas.width / (rect.width || 1)
  const fx = state.tx + worldX * state.scale
  const fy = state.ty + worldY * state.scale
  const left = rect.left + fx / dpr
  const top = rect.top + fy / dpr
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null
  return { left, top }
}

export interface WorldCanvasHandle {
  focusOnAddress: (address: string, options?: any) => void
  previewOpponent: (address: string | null) => void
  clearSelectedOpponent: () => void
  updateSelectedRef: (address: string | null) => void
  projectWorldToScreen: (worldX: number, worldY: number) => { left: number; top: number } | null
  handleSelectOpponentAddress: (address: string, options?: { focus?: boolean }) => void
  getState: () => any
}

export const BlobletsCanvas = forwardRef<WorldCanvasHandle>(function BlobletsCanvas(_, ref) {
  const {
    gameplay,
    energizeUi,
    myAddressCanonical,
    activeHubTab,
    highlightOwnedLandmarks,
    onEnergizeUiChange: setEnergizeUi,
    pendingEnergizeActionRef,
    onEnergizeAlert: setEnergizeAlert,
    refreshRewards,
    prependBattle,
    updateLoadout,
    loadoutState,
    holderMeta,
    onHolderMetaSnapshot: setHolderMeta,
    minStake,
    myWeaponStat,
    selectedOpponent,
    onSelectOpponent: setSelectedOpponent,
    onOpenHubTab: openHubTab,
    onCloseHub: closeHub,
    challengeWindowHandlers,
    rewardsWindowHandlers,
    onPointerTypeChange: updatePointerType,
    applyLoadouts,
    applyBattles,
    onHighlightsUpdate,
    onMyAddressResolved: setMyAddressState,
    onMyAddressDisplay: setMyAddressDisplay,
  } = useWorldCanvas()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hudRef = useRef<HTMLDivElement | null>(null)
  
  const [pixelPerfect] = useState(true)
  const selectedOpponentRef = useRef<string | null>(null)
  
  const stRef = useRef({
    framesAlive: [] as Frame[], framesDead: [] as Frame[],
    framesAliveMap: new Map<string, Frame[]>(), framesDeadMap: new Map<string, Frame[]>(),
    byTierSlots: [] as Slot[][],
    sprites: [] as Sprite[],
    addrToIdx: new Map<string, number>(),
    scale: 0.5, tx: 0, ty: 0, vx: 0, vy: 0, dragging: false, lastX: 0, lastY: 0, pinchDist: 0,
    downX: 0, downY: 0,
    fitScale: 0.5,
    entryActive: true, entryStart: 0, entryEndBy: 0,
    entryDur: 1600, entryStagger: 3,
    pressureK0: 2400, pressureDecayMs: 1400, springK0: 0.0, springK1: 14.0, damping: 0.85,
    pbdIters: 2, gridCell: 18,
    maxDPR: 1.75,
    highlightAddr: '' as string,
    inspectHighlight: '' as string,
    inspectPulseStart: 0,
    hoverHighlight: '' as string,
    hoverPulseStart: 0,
    scoutedMap: new Map<string, { label: string; tone: any }>(),
    scoutPulseStart: 0,
    scoutModeActive: false,
    myAddrCanonical: '' as string,
    myAddrDisplay: '' as string,
    // Care state (client-polled)
    energizeStatus: emptyEnergizeUi(),
    // Props cache/state
    props: [] as WorldProp[],
    propCache: new Map<number, { key: string; oc?: HTMLCanvasElement; w: number; h: number; ready: boolean }>(),
    lastSnapshot: [] as Holder[],
    groundPattern: null as CanvasPattern | null,
    groundTile: null as HTMLCanvasElement | null,
    initializedScale: false,
    readySignaled: false,
    highlightOwnedLandmarks: false,
  });

  useEffect(() => {
    stRef.current.energizeStatus = energizeUi
  }, [energizeUi])

  // Sync refs

  useEffect(() => {
    stRef.current.highlightOwnedLandmarks = highlightOwnedLandmarks
  }, [highlightOwnedLandmarks])

  useEffect(() => {
    stRef.current.myAddrCanonical = myAddressCanonical
  }, [myAddressCanonical])

  useEffect(() => {
    stRef.current.scoutModeActive = activeHubTab === 'opponents'
  }, [activeHubTab])

  const ALIVE_SRC_VAL = (defaultAvatars.alive || '').trim();
  const DEAD_SRC_VAL = (defaultAvatars.dead || '').trim();

  const computeDefaultScale = (fitWidth: number, fitHeight: number, baseFit: number) => {
    if (!Number.isFinite(baseFit) || baseFit <= 0) return baseFit
    return baseFit
  }

  const minScaleFor = (baseFit: number) => baseFit * 0.6

  const { positionCameraToWorld, ensureSpriteDisplaySize } = useCanvasViewport({
    canvasRef,
    stateRef: stRef,
    computeDefaultScale,
    minScaleFor,
  })

  const signalReady = useCallback(() => {
    const st = stRef.current;
    st.readySignaled = true;
    emitClientEvent(CLIENT_EVENT.CANVAS_READY, {})
  }, []);

  const rebuildIndex = useCallback(() => {
    const st = stRef.current;
    st.addrToIdx = new Map();
    for (let i = 0; i < st.sprites.length; i++) {
      st.addrToIdx.set(st.sprites[i]!.address, i);
    }
  }, []);

  const seedSpritesFromSnapshot = useMemo(
    () =>
      createSeedSpritesFromSnapshot({
        stRef,
        rebuildIndex,
        signalReady,
      }),
    [rebuildIndex, signalReady],
  )

  const {
    focusOnAddress,
    previewOpponent,
    clearSelectedOpponent,
    handleSelectOpponentAddress,
    updateSelectedRef,
  } = useSpriteFocus({
    canvasRef,
    stateRef: stRef,
    ensureSpriteDisplaySize,
    minScaleFor,
    setActiveHubTab: openHubTab,
    setSelectedOpponent,
    selectedOpponentRef,
    maxScale: MAX_CANVAS_SCALE,
  })

  const applySnapshot = useMemo(
    () =>
      createApplySnapshot({
        stRef,
        setHolderMeta,
        getSelectedOpponent: () => selectedOpponentRef.current,
        clearSelectedOpponent,
        rebuildIndex,
        signalReady,
      }),
    [clearSelectedOpponent, rebuildIndex, setHolderMeta, signalReady],
  )

  const {
    applyDelta,
    removePlaceholder,
    replayEntry,
    addSprites,
    setHighlightAddress,
    setMyAddressForSession,
    clearSessionForWindow,
  } = useWindowApiHandlers({
    stRef,
    rebuildIndex,
    applySnapshot,
    setMyAddressState,
    setMyAddressDisplay,
  })

  useGameplayReactions({
    gameplay,
    myAddressCanonical,
    setEnergizeUi,
    pendingEnergizeActionRef,
    setEnergizeAlert,
    refreshRewards,
    prependBattle,
    updateLoadout,
    stateRef: stRef,
  })

  const windowBindingHandlers = useWindowBridgeHandlers({
    applyLoadouts,
    updateLoadout,
    applyBattles,
    prependBattle,
    applySnapshot,
    applyDelta,
    removePlaceholder,
    replayEntry,
    addSprites,
    focusOnAddress,
    setHighlightAddress,
    setMyAddressForSession,
    clearSessionForWindow,
    openHubTab,
    closeHubTab: closeHub,
    challengeWindowHandlers,
    rewardsWindowHandlers,
  })

  const clientEventHandlers = useMemo(() => ({}), []) 

  useWindowBindings(windowBindingHandlers, clientEventHandlers)

  useCanvasBootstrap({
    stRef,
    aliveSrc: ALIVE_SRC_VAL,
    deadSrc: DEAD_SRC_VAL,
  })

  useDemoSeed({
    enabled: DEMO_SEED_ENABLED,
    canvasRef,
    stateRef: stRef,
    seedSpritesFromSnapshot,
    positionCameraToWorld,
  })

  useCanvasInteractions({
    canvasRef,
    stateRef: stRef,
    updatePointerType,
    clearSelectedOpponent,
    handleSelectOpponentAddress,
    minScaleFor,
    maxScale: MAX_CANVAS_SCALE,
  })

  useCanvasLifecycle({
    canvasRef,
    hudRef,
    stateRef: stRef,
    positionCameraToWorld,
    pixelPerfect,
    startRenderLoop,
  })

  const { selectedOpponentMeta, highlightedTargets } = useOpponentHighlights({
    selectedOpponent,
    loadoutState,
    holderMeta,
    myWeaponStat,
    myAddressCanonical,
    activeHubTab,
    stRef,
    scoutedLimit: SCOUTED_LIMIT,
    updateSelectedRef,
    clearSelectedOpponent,
    minStake,
  })

  useEffect(() => {
    onHighlightsUpdate({ selectedOpponentMeta, highlightedTargets })
  }, [selectedOpponentMeta, highlightedTargets, onHighlightsUpdate])


  useImperativeHandle(ref, () => ({
    focusOnAddress,
    previewOpponent,
    clearSelectedOpponent,
    updateSelectedRef,
    projectWorldToScreen: (x, y) => worldToScreen(x, y, stRef.current, canvasRef.current),
    handleSelectOpponentAddress,
    getState: () => stRef.current
  }))

  return (
    <div className="absolute inset-0 bg-[rgba(9,2,17,0.85)]">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
})
