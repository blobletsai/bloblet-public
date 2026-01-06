"use client"

import type { RewardsModalConfig } from '@/components/rewards-modal/types'
import SolCareTopUpModal from '@/components/SolCareTopUpModal'

type Props = {
  topUpModalOpen: boolean
  rewardsConfig?: RewardsModalConfig
  onCloseTopUp: () => void
  onRefreshRewards?: (options?: { silent?: boolean }) => Promise<unknown>
}

export default function RewardsModalsGateway({
  topUpModalOpen,
  rewardsConfig,
  onCloseTopUp,
  onRefreshRewards,
}: Props) {
  // Force Solana modal; BNB path is not active.
  return (
    <SolCareTopUpModal
      open={topUpModalOpen}
      onClose={onCloseTopUp}
      rewardsConfig={rewardsConfig}
      onRewardsUpdated={onRefreshRewards}
    />
  )
}
