import { describe, it, expect } from 'vitest'
import { BattleEngine } from '@/src/server/gameplay/battle/engine'
import type { BattleContext, ParticipantState, RandomProvider } from '@/src/server/gameplay/battle/types'
import type { PvpItem } from '@/types'

const MOCK_ITEM: PvpItem = {
  id: 1, slug: 'sword_t1', type: 'weapon', name: 'Sword',
  rarity: 'common', op: 10, dp: 0
}

const MOCK_SHIELD: PvpItem = {
  id: 2, slug: 'shield_t1', type: 'shield', name: 'Shield',
  rarity: 'common', op: 0, dp: 10
}

const BASE_CONFIG = {
  pairCooldownMs: 60000,
  luckVariance: 0.2,
  tieBand: 0.2,
  criticalChance: 0,
  transferBps: 1000,
  houseCutBps: 1000,
  minTransfer: 5,
  pairBattlesLastHour: 0,
  pairFreqLimit: 0,
  pairSurchargeBps: 0,
  defenderGraceMs: 0,
  defenderLastLossAt: null,
  nowMs: 100000,
  cooldownEndsAtIso: new Date(160000).toISOString(),
}

function createParticipant(address: string, points: number, op: number, dp: number): ParticipantState {
  const w = op > 0 ? { ...MOCK_ITEM, op } : null
  const s = dp > 0 ? { ...MOCK_SHIELD, dp } : null
  return {
    address,
    isAlive: true,
    points,
    boosterLevel: 0,
    status: {
      state: 'ready',
      boosterLevel: 0,
      cooldownEndsAt: null,
      boostersActiveUntil: null
    },
    loadout: { weapon: w, shield: s }
  }
}

function createSeededRandomProvider(seed = 1): RandomProvider {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return {
    unit() {
      state = (state * 16807) % 2147483647
      return (state - 1) / 2147483646
    },
  }
}

describe('BattleEngine', () => {
  it('should resolve a standard battle (Attacker Wins)', () => {
    const ctx: BattleContext = {
      attacker: createParticipant('A', 100, 20, 0), // OP 20
      defender: createParticipant('B', 100, 0, 10), // DP 10
      config: { ...BASE_CONFIG, luckVariance: 0 } // Disable luck for deterministic result
    }
    
    const result = BattleEngine.resolve(ctx, createSeededRandomProvider(1))
    
    expect(result.winner).toBe('attacker')
    expect(result.transfer.transfer).toBeGreaterThan(0)
    expect(result.attacker.pointsAfter).toBeGreaterThan(100)
    expect(result.defender.pointsAfter).toBeLessThan(100)
    
    // Attacker steals shield
    const stolen = result.loot.find(l => l.slot === 'shield')
    expect(stolen).toBeDefined()
    expect(stolen?.equipped).toBe(true) // Upgrade from null
  })

  it('should apply house cut correctly', () => {
    const ctx: BattleContext = {
      attacker: createParticipant('A', 1000, 50, 0),
      defender: createParticipant('B', 1000, 0, 10),
      config: { ...BASE_CONFIG, luckVariance: 0, transferBps: 1000, houseCutBps: 1000 } // 10% transfer, 10% house
    }
    
    const result = BattleEngine.resolve(ctx, createSeededRandomProvider(2))
    
    // Transfer = 10% of 1000 = 100
    // House = 10% of 100 = 10
    // Winner Gain = 90
    expect(result.transfer.transfer).toBe(100)
    expect(result.transfer.house).toBe(10)
    expect(result.transfer.winnerGain).toBe(90)
  })

  it('should handle critical hits', () => {
    const ctx: BattleContext = {
      attacker: createParticipant('A', 100, 50, 0),
      defender: createParticipant('B', 100, 0, 10), // Has shield
      config: { ...BASE_CONFIG, luckVariance: 0, criticalChance: 1.0 } // Force crit
    }
    
    const result = BattleEngine.resolve(ctx, createSeededRandomProvider(3))
    expect(result.critical).toBe(true)
    expect(result.effects.find((eff) => eff.type === 'critical_hit')).toBeTruthy()
    
    // Attacker wins + Critical -> Steals Shield (Standard) AND Weapon (Critical bonus)
    // Defender has no weapon to steal, so loot should just be shield
    expect(result.loot.length).toBe(1)
    expect(result.loot[0].slot).toBe('shield')
    
    // Give defender a weapon to steal
    ctx.defender.loadout.weapon = { ...MOCK_ITEM, op: 5 }
    const result2 = BattleEngine.resolve(ctx, createSeededRandomProvider(3))
    expect(result2.loot.length).toBe(2) // Shield + Weapon
  })

  it('should apply anti-farm surcharge', () => {
    const ctx: BattleContext = {
      attacker: createParticipant('A', 1000, 50, 0),
      defender: createParticipant('B', 1000, 0, 10),
      config: { 
        ...BASE_CONFIG, 
        luckVariance: 0, 
        pairFreqLimit: 3, 
        pairBattlesLastHour: 3, // Trigger limit
        pairSurchargeBps: 5000, // +50% house cut
        houseCutBps: 1000 // 10% base
      } 
    }
    
    const result = BattleEngine.resolve(ctx, createSeededRandomProvider(4))
    
    // Transfer = 100
    // House Cut = 10% + 50% = 60%
    // House = 60
    // Winner Gain = 40
    expect(result.transfer.transfer).toBe(100)
    expect(result.transfer.house).toBe(60)
    expect(result.transfer.winnerGain).toBe(40)
  })
})
