"use client"

import React from 'react'

import type { LoadoutCard } from '../bloblets-world/loadoutSelectors'
import type { HubTab } from '../bloblets-world/types'
import { LifeHubModal } from './LifeHubModal'
import { LoadoutHubModal } from '../bloblets-world/LoadoutHubModal'
import { RewardsHubModal } from '../bloblets-world/RewardsHubModal'

type LoadoutModalProps = {
  primaryCards: LoadoutCard[]
  futureCards: LoadoutCard[]
  onManageGear: () => void
  onLaunchChallenge: () => void
}

type LifeHubDesktopModalProps = {
  activeTab: HubTab | null
  onClose: () => void
  loadout: LoadoutModalProps
  rewardsCard: React.ReactNode
  rewardsHistory: React.ReactNode
  showRewardsHub: boolean
}

export const LifeHubDesktopModal: React.FC<LifeHubDesktopModalProps> = ({
  activeTab,
  onClose,
  loadout,
  rewardsCard,
  rewardsHistory,
  showRewardsHub,
}) => {
  if (!activeTab || activeTab === 'opponents') return null

  if (activeTab === 'life') {
    return <LifeHubModal onClose={onClose} />
  }

  if (activeTab === 'loadout') {
    return (
      <LoadoutHubModal
        primaryCards={loadout.primaryCards}
        futureCards={loadout.futureCards}
        onClose={onClose}
        onManageGear={loadout.onManageGear}
        onLaunchChallenge={loadout.onLaunchChallenge}
      />
    )
  }

  if (activeTab === 'persona') return null

  if (activeTab === 'rewards') {
    if (!showRewardsHub) return null
    return (
      <RewardsHubModal
        onClose={onClose}
        rewardsCard={rewardsCard}
        rewardsHistory={rewardsHistory}
      />
    )
  }

  return null
}
