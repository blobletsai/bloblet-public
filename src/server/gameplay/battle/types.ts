import type { PvpItem, PvpItemType } from '@/types'
import type { ChargeStatus } from '@/src/shared/care'

// --- Input Context (Read-only state) ---

export type ParticipantState = {
  address: string
  isAlive: boolean
  points: number
  boosterLevel: number
  status: ChargeStatus
  loadout: {
    weapon: PvpItem | null
    shield: PvpItem | null
  }
}

export type BattleConfig = {
  pairCooldownMs: number
  luckVariance: number
  tieBand: number
  criticalChance: number
  // Transfer rules
  transferBps: number
  houseCutBps: number
  minTransfer: number
  // Anti-farm surcharge
  pairBattlesLastHour: number
  pairFreqLimit: number
  pairSurchargeBps: number
  // Defender protection
  defenderGraceMs: number
  defenderLastLossAt: number | null
  nowMs: number
  cooldownEndsAtIso: string
}

export type BattleContext = {
  attacker: ParticipantState
  defender: ParticipantState
  config: BattleConfig
}

export type RandomProvider = {
  unit(): number
}

// --- Output Result (Pure outcome) ---

export type BattleLootResult = {
  slot: PvpItemType
  item: PvpItem
  from: string
  to: string
  equipped: boolean
}

export type BattleEffect = {
  type: string
  details: any
}

export type BattleTransferResult = {
  transfer: number
  house: number
  winnerGain: number
}

export type BattleParticipantOutcome = {
  address: string
  base: number
  roll: number
  pointsBefore: number
  pointsAfter: number
  booster: number
}

export type BattleOutcome = {
  winner: 'attacker' | 'defender'
  critical: boolean
  effects: BattleEffect[]
  attacker: BattleParticipantOutcome
  defender: BattleParticipantOutcome
  loot: BattleLootResult[]
  transfer: BattleTransferResult
  cooldownUntil: string
}
