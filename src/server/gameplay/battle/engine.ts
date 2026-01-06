import type { PvpItem, PvpItemType } from '@/types'
import type {
  BattleContext,
  BattleOutcome,
  BattleLootResult,
  ParticipantState,
  BattleConfig,
  RandomProvider,
  BattleEffect,
} from './types'

const PRECISION = 1e6

// --- Utility Functions (Pure) ---

export function roundPoints(value: number): number {
  return Math.round(value * PRECISION) / PRECISION
}

function statForType(item: PvpItem | null | undefined, slot: PvpItemType): number {
  if (!item) return 0
  return slot === 'weapon' ? Number(item.op || 0) : Number(item.dp || 0)
}

// --- Engine Implementation ---

export class BattleEngine {
  /**
   * Resolve a battle purely from context, with no side effects.
   */
  static resolve(ctx: BattleContext, rng: RandomProvider): BattleOutcome {
    const { attacker, defender, config } = ctx
    
    // 1. Eligibility & Stats
    const attackerBase = statForType(attacker.loadout.weapon, 'weapon') + attacker.boosterLevel
    const defenderBase = statForType(defender.loadout.shield, 'shield') + defender.boosterLevel
    
    // 2. RNG Rolls
    const attackerRoll = roundPoints(attackerBase * this.luckMultiplier(config.luckVariance, rng))
    const defenderRoll = roundPoints(defenderBase * this.luckMultiplier(config.luckVariance, rng))
    
    // 3. Determine Winner
    const diff = attackerRoll - defenderRoll
    let winner: 'attacker' | 'defender'
    
    if (Math.abs(diff) <= config.tieBand) {
      winner = rng.unit() < 0.5 ? 'attacker' : 'defender'
    } else {
      winner = diff > 0 ? 'attacker' : 'defender'
    }
    
    const critical = rng.unit() <= config.criticalChance
    const winnerState = winner === 'attacker' ? attacker : defender
    const loserState = winner === 'attacker' ? defender : attacker
    const effects: BattleEffect[] = []
    if (critical) {
      effects.push({
        type: 'critical_hit',
        details: {
          winner,
          chance: config.criticalChance,
        },
      })
    }
    
    // 4. Calculate Transfer
    const transferStats = this.computeTransfer(loserState.points, config)
    
    // 5. Loot Logic (Steal Items)
    const loot: BattleLootResult[] = []
    const slotsToSteal = this.chooseSlotsToSteal(winner, critical)
    
    // We operate on copies to simulate equipping during the battle resolution (e.g. double steal)
    // Though current logic processes slots independently against initial state or sequential?
    // Legacy implementation: "stealSlot" modifies the participant object in place.
    // We will replicate that behavior via local mutable clones for the resolution scope.
    const winnerMutable = this.cloneParticipant(winnerState)
    const loserMutable = this.cloneParticipant(loserState)
    
    for (const slot of slotsToSteal) {
      const result = this.stealSlot(slot, winnerMutable, loserMutable)
      if (result) loot.push(result)
    }
    if (loot.length) {
      for (const entry of loot) {
        effects.push({
          type: 'loot_transfer',
          details: {
            slot: entry.slot,
            from: entry.from,
            to: entry.to,
            equipped: entry.equipped,
            itemId: entry.item.id,
          },
        })
      }
    }
    
    // 6. Finalize Points
    const attackerPointsAfter = winner === 'attacker'
      ? roundPoints(attacker.points + transferStats.winnerGain)
      : roundPoints(Math.max(0, attacker.points - transferStats.transfer))
    
    const defenderPointsAfter = winner === 'defender'
      ? roundPoints(defender.points + transferStats.winnerGain)
      : roundPoints(Math.max(0, defender.points - transferStats.transfer))

    if (transferStats.transfer > 0) {
      effects.push({
        type: 'points_transfer',
        details: {
          winner,
          loser: winner === 'attacker' ? defender.address : attacker.address,
          ...transferStats,
        },
      })
    }

    return {
      winner,
      critical,
      effects,
      transfer: transferStats,
      loot,
      cooldownUntil: config.cooldownEndsAtIso,
      attacker: {
        address: attacker.address,
        base: attackerBase,
        roll: attackerRoll,
        pointsBefore: attacker.points,
        pointsAfter: attackerPointsAfter,
        booster: attacker.boosterLevel,
      },
      defender: {
        address: defender.address,
        base: defenderBase,
        roll: defenderRoll,
        pointsBefore: defender.points,
        pointsAfter: defenderPointsAfter,
        booster: defender.boosterLevel,
      }
    }
  }
  
  private static luckMultiplier(variance: number, rng: RandomProvider): number {
    if (variance <= 0) return 1
    // Legacy: 1 + (random(-1..1) * variance)
    const offset = rng.unit() * 2 - 1
    return 1 + offset * Math.min(0.5, variance)
  }

  private static computeTransfer(loserPoints: number, config: BattleConfig) {
    // Determine house cut override (anti-farm)
    let houseBps = config.houseCutBps
    if (config.pairFreqLimit > 0 && config.pairBattlesLastHour >= config.pairFreqLimit) {
      if (config.pairSurchargeBps > 0) {
         houseBps = Math.min(10_000, Math.max(0, config.houseCutBps + config.pairSurchargeBps))
      }
    }
    
    const transferRate = config.transferBps / 10_000
    const houseRate = houseBps / 10_000
    
    const base = Math.ceil(loserPoints * transferRate)
    const floor = Math.max(config.minTransfer, base)
    const transfer = Math.min(loserPoints, floor)
    
    if (transfer <= 0) {
      return { transfer: 0, house: 0, winnerGain: 0 }
    }
    
    const house = transfer * houseRate
    const winnerGain = transfer - house
    
    return {
      transfer: roundPoints(transfer),
      house: roundPoints(house),
      winnerGain: roundPoints(winnerGain),
    }
  }

  private static chooseSlotsToSteal(winner: 'attacker' | 'defender', critical: boolean): PvpItemType[] {
    // Attacker targets Shield, Defender targets Weapon. Critical targets BOTH.
    const base: PvpItemType[] = winner === 'attacker' ? ['shield'] : ['weapon']
    if (critical) {
      base.push(winner === 'attacker' ? 'weapon' : 'shield')
    }
    return base
  }

  private static cloneParticipant(p: ParticipantState): ParticipantState {
    return {
      ...p,
      loadout: { ...p.loadout }
    }
  }

  private static stealSlot(
    slot: PvpItemType, 
    winner: ParticipantState, 
    loser: ParticipantState
  ): BattleLootResult | null {
    const loserItem = slot === 'weapon' ? loser.loadout.weapon : loser.loadout.shield
    
    // If loser has nothing in this slot, nothing to steal
    if (!loserItem) {
       // Side effect: Ensure loser slot is explicitly null (already is)
       return null
    }

    // Remove item from loser
    if (slot === 'weapon') loser.loadout.weapon = null
    else loser.loadout.shield = null

    // Check if winner upgrades
    const winnerItem = slot === 'weapon' ? winner.loadout.weapon : winner.loadout.shield
    const winnerStat = statForType(winnerItem, slot)
    const itemStat = statForType(loserItem, slot)
    
    let equipped = false
    if (itemStat > winnerStat) {
      if (slot === 'weapon') winner.loadout.weapon = loserItem
      else winner.loadout.shield = loserItem
      equipped = true
    }
    
    return {
      slot,
      item: loserItem,
      from: loser.address,
      to: winner.address,
      equipped
    }
  }
}
