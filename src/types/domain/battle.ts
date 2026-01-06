/**
 * PVP Battle Types
 */

import { PvpItemType } from './items'

export interface BattleLoot {
  slot: PvpItemType
  item_id: number
  item_slug: string
  from: string
  to: string
  equipped: boolean
}

export interface PvpBattle {
  id: number
  attacker: string
  defender: string
  attacker_booster: number
  defender_booster: number
  attacker_base: number
  defender_base: number
  attacker_total: number
  defender_total: number
  winner: 'attacker' | 'defender'
  transfer_points: number
  house_points: number
  loot: BattleLoot[]
  critical: boolean
  created_at: string
}
