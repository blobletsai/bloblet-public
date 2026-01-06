"use client"

import { useMemo } from 'react'

import { useChallengeModalState } from './modalState'
import { ArenaDockPanel } from '@/components/hud/ArenaDockPanel'
import { ArenaFeedPanel } from '@/components/hud/ArenaFeedPanel'
import type { PvpBattle, PvpItem } from '@/types'

type Args = {
  holderMeta: Parameters<typeof useChallengeModalState>[0]['holderMeta']
  battleFeed: PvpBattle[]
  myAddress?: string | null
  itemCatalog: Record<number, PvpItem>
  refreshRewards: Parameters<typeof useChallengeModalState>[0]['refreshRewards']
  minStake: number | null
  registerPairCooldown?: (address: string, untilIso?: string | null) => void
  getPairCooldown?: (address: string | null | undefined) => number | null
}

export function useChallengePanel({
  holderMeta,
  battleFeed,
  myAddress,
  itemCatalog,
  refreshRewards,
  minStake,
  registerPairCooldown,
  getPairCooldown,
}: Args) {
  const challengeState = useChallengeModalState({
    holderMeta,
    battleFeed,
    myAddress: myAddress || '',
    refreshRewards,
    minStake,
    registerPairCooldown,
  })

  const arenaPanel = useMemo(() => (
    <ArenaDockPanel
      onLaunch={() => challengeState.openChallengeModal()}
      battles={(
        <ArenaFeedPanel
          battles={battleFeed}
          myAddress={myAddress || ''}
          itemCatalog={itemCatalog}
          onChallenge={(target) => challengeState.openChallengeModal(target)}
        />
      )}
    />
  ), [battleFeed, itemCatalog, myAddress, challengeState])

  return {
    arenaPanel,
    getPairCooldown,
    ...challengeState,
  }
}
