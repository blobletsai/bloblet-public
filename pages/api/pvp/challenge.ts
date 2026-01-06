import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { runBattle, BattleError, buildMaskedOpponent } from '@/src/server/gameplay/battleService'
import { rateLimiter } from '@/src/server/rateLimit'
import { getSolanaAddressContext } from '@/src/shared/address/solana'
import type { PvpItem } from '@/types'

type LootView = {
  slot: 'weapon' | 'shield'
  to: 'me' | 'opponent'
  equipped: boolean
}

type LoadoutView = {
  weapon: PvpItem | null
  shield: PvpItem | null
}

type BattleResponse = {
  winner: 'attacker' | 'defender'
  critical: boolean
  effects: Array<{ type: string; details: any }>
  loot: LootView[]
  transfer: { transfer: number; house: number; winnerGain: number }
  cooldownEndsAt: string
  battleId: number
  attacker: {
    address: string
    pointsBefore: number
    pointsAfter: number
    booster: number
    base: number
    roll: number
    weapon: PvpItem | null
    shield: PvpItem | null
  }
  opponent: {
    address: string
    maskedId: string
    displayHint: string
  }
}

function normalizeAddress(raw: any) {
  try {
    return getSolanaAddressContext(String(raw || '')).canonical
  } catch {
    return ''
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const session = getSessionFromRequest(req)
    if (!session || !session.address) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const ip = (req.headers['x-forwarded-for'] as string) || 'pvp'
    const { success } = await rateLimiter.limit(`pvp:challenge:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate_limited' })

    const body = req.body || {}
    const attacker = normalizeAddress(session.address)
    if (!attacker) {
      return res.status(400).json({ error: 'invalid_address' })
    }
    const defender = normalizeAddress(
      body.targetAddress || body.defender || body.address || body.opponent,
    )
    if (!defender) {
      return res.status(400).json({ error: 'target_missing' })
    }

    // Additional rate limits to reduce spam/farming from a single address and per pair
    const attackerLimit = await rateLimiter.limit(`pvp:addr:${attacker}`)
    if (!attackerLimit.success) {
      return res.status(429).json({ error: 'rate_limited_attacker' })
    }
    const pairKey = attacker < defender ? `${attacker}:${defender}` : `${defender}:${attacker}`
    const pairLimit = await rateLimiter.limit(`pvp:pair:${pairKey}`)
    if (!pairLimit.success) {
      return res.status(429).json({ error: 'rate_limited_pair' })
    }

    const result = await runBattle(attacker, defender)

    const attackerLoadout: LoadoutView = {
      weapon: result.attackerLoadout?.weapon ?? null,
      shield: result.attackerLoadout?.shield ?? null,
    }
    const opponent = buildMaskedOpponent(result.defender.address)

    const response: BattleResponse = {
      winner: result.winner,
      critical: result.critical,
      effects: result.effects,
      loot: result.loot.map((entry) => ({
        slot: entry.slot,
        to: entry.to === attacker ? 'me' : 'opponent',
        equipped: entry.equipped,
      })),
      transfer: result.transfer,
      cooldownEndsAt: result.cooldownUntil,
      battleId: result.battleId,
      attacker: {
        address: result.attacker.address,
        pointsBefore: result.attacker.pointsBefore,
        pointsAfter: result.attacker.pointsAfter,
        booster: result.attacker.booster,
        base: result.attacker.base,
        roll: result.attacker.roll,
        weapon: attackerLoadout.weapon,
        shield: attackerLoadout.shield,
      },
      opponent: { ...opponent, address: result.defender.address },
    }

    return res.status(200).json({ ok: true, result: response })
  } catch (err: unknown) {
    if (err instanceof BattleError) {
      return res
        .status(err.status)
        .json({ error: err.message, details: err.details || null })
    }
    console.error('[pvp/challenge] unexpected', err)
    return res.status(500).json({ error: 'battle_failed' })
  }
}
