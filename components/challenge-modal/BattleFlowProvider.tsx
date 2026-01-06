"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'

import ChallengeModal, { type ChallengeLoadoutState } from '@/components/ChallengeModal'
import { BattleAlertProvider } from '@/components/challenge-modal/BattleAlertProvider'
import type { ChallengeAvatarResolver } from '@/components/challenge-modal/avatarResolver'
import type { ChallengeHandlerResult } from '@/components/ChallengeModal'
import type { PvpItem } from '@/types'

type HandlerMap = Record<string, (...args: any[]) => unknown>

export type BattleFlowBindings = {
  challengeModalOpen: boolean
  challengePresetTarget: { normalized: string; display: string } | null
  recentOpponents: string[]
  openChallengeModal: (target?: string) => void
  closeChallengeModal: () => void
  handleChallengeSubmit: (target: string) => Promise<ChallengeHandlerResult>
  resolveChallengeAvatar?: ChallengeAvatarResolver
  minStake: number | null
  getStakeInfo: (address: string) => { balance: number | null; stakeReady: boolean; minStake: number | null }
  getPairCooldown?: (address: string) => number | null
  challengeWindowHandlers: HandlerMap
  arenaPanel: ReactNode
  refreshViewerLoadout?: (options?: { force?: boolean }) => Promise<any>
}

export type BattleFlowContextValue = {
  challengeModalOpen: boolean
  openChallengeModal: (target?: string) => void
  closeChallengeModal: () => void
  challengeWindowHandlers: HandlerMap
  arenaPanel: ReactNode
}

const BattleFlowContext = createContext<BattleFlowContextValue | null>(null)

type BattleFlowProviderProps = {
  children: ReactNode
  bindings: BattleFlowBindings
  myAddress: string
  loadouts: ChallengeLoadoutState
  itemCatalog: Record<number, PvpItem>
  onRequestLifeHub: () => void
  refreshViewerLoadout?: (options?: { force?: boolean }) => Promise<any>
}

export function BattleFlowProvider({
  children,
  bindings,
  myAddress,
  loadouts,
  itemCatalog,
  onRequestLifeHub,
  refreshViewerLoadout,
}: BattleFlowProviderProps) {
  const {
    challengeModalOpen,
    challengePresetTarget,
    recentOpponents,
    openChallengeModal,
    closeChallengeModal,
    handleChallengeSubmit,
    resolveChallengeAvatar,
    minStake,
    getStakeInfo,
    getPairCooldown,
    challengeWindowHandlers,
    arenaPanel,
  } = bindings

  const pendingLifeHubRef = useRef(false)

  const handleEnergizeNow = useCallback(() => {
    if (pendingLifeHubRef.current) return
    pendingLifeHubRef.current = true
    closeChallengeModal()
  }, [closeChallengeModal])

  useEffect(() => {
    if (!pendingLifeHubRef.current) return
    if (challengeModalOpen) return
    pendingLifeHubRef.current = false
    onRequestLifeHub()
  }, [challengeModalOpen, onRequestLifeHub])

  const contextValue = useMemo<BattleFlowContextValue>(() => ({
    challengeModalOpen,
    openChallengeModal,
    closeChallengeModal,
    challengeWindowHandlers,
    arenaPanel,
  }), [
    arenaPanel,
    challengeModalOpen,
    challengeWindowHandlers,
    closeChallengeModal,
    openChallengeModal,
  ])

  return (
    <BattleAlertProvider>
      <BattleFlowContext.Provider value={contextValue}>
        {children}
        <ChallengeModal
          open={challengeModalOpen}
          myAddress={myAddress}
          loadouts={loadouts}
          suggestedTargets={recentOpponents}
          initialTarget={challengePresetTarget?.display || undefined}
          onClose={closeChallengeModal}
          onSubmit={handleChallengeSubmit}
          onEnergizeNow={handleEnergizeNow}
          resolveAvatarUrl={resolveChallengeAvatar}
          minStake={minStake}
          getStakeInfo={getStakeInfo}
          getPairCooldown={getPairCooldown}
          itemCatalog={itemCatalog}
          refreshViewerLoadout={refreshViewerLoadout}
        />
      </BattleFlowContext.Provider>
    </BattleAlertProvider>
  )
}

export function useBattleFlow(optional = false): BattleFlowContextValue | null {
  const ctx = useContext(BattleFlowContext)
  if (!ctx && !optional) {
    throw new Error('useBattleFlow must be used within a BattleFlowProvider')
  }
  return ctx
}
