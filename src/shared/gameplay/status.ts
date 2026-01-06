export const BATTLE_TERMS = {
  sleeping: {
    key: 'energy_sleep',
    label: 'Sleeping (no boosters)',
    description:
      'Boosters expired or the cooldown window passed. The guardian is still challengeable but fights without coverage bonuses.',
  },
  rewardDeficit: {
    key: 'reward_points_deficit',
    label: 'Stake depleted',
    description:
      'BlobCoin dropped below the minimum stake required for PvP. The guardian cannot be challenged until they top up.',
  },
} as const

export type BattleTermKey = typeof BATTLE_TERMS[keyof typeof BATTLE_TERMS]['key']
