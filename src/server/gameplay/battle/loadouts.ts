import type { PvpItem } from '@/types'
import type { BattleLootResult } from './types'

type LoadoutSnapshot = { weapon: PvpItem | null; shield: PvpItem | null }

const cloneLoadout = (loadout: LoadoutSnapshot): LoadoutSnapshot => ({
  weapon: loadout.weapon || null,
  shield: loadout.shield || null,
})

export function buildFinalLoadouts(
  attackerAddress: string,
  defenderAddress: string,
  attackerLoadout: LoadoutSnapshot,
  defenderLoadout: LoadoutSnapshot,
  loot: BattleLootResult[],
) {
  const loadoutMap = new Map<string, LoadoutSnapshot>([
    [attackerAddress, cloneLoadout(attackerLoadout)],
    [defenderAddress, cloneLoadout(defenderLoadout)],
  ])

  for (const entry of loot) {
    const fromLoadout = loadoutMap.get(entry.from)
    if (fromLoadout) {
      if (entry.slot === 'weapon') fromLoadout.weapon = null
      else fromLoadout.shield = null
    }

    const toLoadout = loadoutMap.get(entry.to)
    if (toLoadout && entry.equipped) {
      if (entry.slot === 'weapon') toLoadout.weapon = entry.item
      else toLoadout.shield = entry.item
    }
  }

  return loadoutMap
}
