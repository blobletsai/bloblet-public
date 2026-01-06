import type { ChargeStatus } from '@/src/shared/care'
import { BATTLE_TERMS } from '@/src/shared/gameplay/status'

export type EligibilityParticipantInput = {
  address: string
  status: ChargeStatus
  pointsBefore: number
  isAlive?: boolean | null
}

export type EligibilityParticipantView = {
  address: string
  pointsBefore: number
  minStakeMet: boolean
  isAlive: boolean
  energyState: ChargeStatus['state']
  overdue: boolean
  sleeping: boolean
  boosterLevel: number
  boostersActiveUntil: string | null
  cooldownEndsAt: string | null
  energyTerm: typeof BATTLE_TERMS.sleeping | null
}

export type BattleEligibilityBlocker =
  | {
      role: 'attacker'
      code: 'attacker_overdue'
      details: { cooldownEndsAt: string | null; boostersActiveUntil: string | null }
    }
  | {
      role: 'attacker'
      code: 'attacker_balance_low'
      details: { balance: number; minPoints: number }
    }
  | {
      role: 'attacker'
      code: 'attacker_dead'
      details: { balance: number }
    }
  | {
      role: 'defender'
      code: 'defender_balance_low'
      details: { balance: number; minPoints: number }
    }
  | {
      role: 'defender'
      code: 'defender_dead'
      details: { balance: number; address: string }
    }

export type BattleEligibilityResult =
  | {
      allowed: true
      attacker: EligibilityParticipantView
      defender: EligibilityParticipantView
    }
  | {
      allowed: false
      blocker: BattleEligibilityBlocker
      attacker: EligibilityParticipantView
      defender: EligibilityParticipantView
    }

function buildParticipantView(
  participant: EligibilityParticipantInput,
  minStake: number,
): EligibilityParticipantView {
  const { address, status, pointsBefore } = participant
  const sleeping = status.state !== 'covered'
  return {
    address,
    pointsBefore,
    minStakeMet: pointsBefore >= minStake,
    isAlive: participant.isAlive !== false,
    energyState: status.state,
    overdue: status.overdue,
    sleeping,
    boosterLevel: status.boosterLevel,
    boostersActiveUntil: status.boostersActiveUntil,
    cooldownEndsAt: status.cooldownEndsAt,
    energyTerm: sleeping ? BATTLE_TERMS.sleeping : null,
  }
}

export function evaluateBattleEligibility(
  attackerInput: EligibilityParticipantInput,
  defenderInput: EligibilityParticipantInput,
  minStake: number,
): BattleEligibilityResult {
  const attacker = buildParticipantView(attackerInput, minStake)
  const defender = buildParticipantView(defenderInput, minStake)

  if (!attacker.isAlive) {
    return {
      allowed: false,
      blocker: {
        role: 'attacker',
        code: 'attacker_dead',
        details: { balance: attacker.pointsBefore },
      },
      attacker,
      defender,
    }
  }

  if (attacker.overdue) {
    return {
      allowed: false,
      blocker: {
        role: 'attacker',
        code: 'attacker_overdue',
        details: {
          cooldownEndsAt: attacker.cooldownEndsAt,
          boostersActiveUntil: attacker.boostersActiveUntil,
        },
      },
      attacker,
      defender,
    }
  }

  if (!attacker.minStakeMet) {
    return {
      allowed: false,
      blocker: {
        role: 'attacker',
        code: 'attacker_balance_low',
        details: { balance: attacker.pointsBefore, minPoints: minStake },
      },
      attacker,
      defender,
    }
  }

  if (!defender.minStakeMet) {
    return {
      allowed: false,
      blocker: {
        role: 'defender',
        code: 'defender_balance_low',
        details: { balance: defender.pointsBefore, minPoints: minStake },
      },
      attacker,
      defender,
    }
  }

  if (!defender.isAlive) {
    return {
      allowed: false,
      blocker: {
        role: 'defender',
        code: 'defender_dead',
        details: { balance: defender.pointsBefore, address: defender.address },
      },
      attacker,
      defender,
    }
  }

  return {
    allowed: true,
    attacker,
    defender,
  }
}
