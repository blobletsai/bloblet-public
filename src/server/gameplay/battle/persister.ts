import type { PoolClient } from 'pg'
import {
  REWARD_LEDGER_ENABLED,
  applyLedgerEntries,
  ledgerTreasuryAddress,
  roundPoints,
} from '@/src/server/rewards'
import type { RewardLedgerEntryInput } from '@/src/server/rewards'
import { resolveChainKind } from '@/src/server/chains'
import { recordBattleLoot } from '../gearService'
import { buildFinalLoadouts } from './loadouts'
import type { BattleOutcome, ParticipantState } from './types'

export class BattlePersister {
  constructor(private client: PoolClient) {}

  async commit(
    outcome: BattleOutcome,
    attacker: ParticipantState,
    defender: ParticipantState,
    now: Date
  ): Promise<number> {
    // 1. Update Loadouts
    const loadoutMap = buildFinalLoadouts(
      attacker.address,
      defender.address,
      attacker.loadout,
      defender.loadout,
      outcome.loot,
    )

    // Persist Loadouts
    for (const [addr, load] of loadoutMap.entries()) {
      await this.client.query(
        `insert into public.bloblet_loadout (bloblet_address, weapon_item_id, shield_item_id)
         values ($1, $2, $3)
         on conflict (bloblet_address) do update set
           weapon_item_id = excluded.weapon_item_id,
           shield_item_id = excluded.shield_item_id,
           updated_at = now()`,
        [addr, load.weapon?.id ?? null, load.shield?.id ?? null],
      )
    }
    
    // 2. Persist Battle Record
    const battleInsert = await this.client.query(
      `insert into public.pvp_battles (
         attacker, defender,
         attacker_weapon_item_id, attacker_shield_item_id,
         defender_weapon_item_id, defender_shield_item_id,
         attacker_booster, defender_booster,
         attacker_base, defender_base,
         attacker_total, defender_total,
         winner, transfer_points, house_points, loot, critical, effects
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning id`,
      [
        outcome.attacker.address,
        outcome.defender.address,
        // Initial loadout IDs (Snapshot at start of battle)
        attacker.loadout.weapon?.id ?? null,
        attacker.loadout.shield?.id ?? null,
        defender.loadout.weapon?.id ?? null,
        defender.loadout.shield?.id ?? null,
        // Stats
        outcome.attacker.booster,
        outcome.defender.booster,
        outcome.attacker.base,
        outcome.defender.base,
        outcome.attacker.roll,
        outcome.defender.roll,
        outcome.winner,
        outcome.transfer.transfer,
        outcome.transfer.house,
        JSON.stringify(
          outcome.loot.map((entry) => ({
            slot: entry.slot,
            item_id: entry.item.id,
            item_slug: entry.item.slug,
            from: entry.from,
            to: entry.to,
            equipped: entry.equipped,
          })),
        ),
        outcome.critical,
        JSON.stringify(outcome.effects || []),
      ],
    )
    const battleId = Number(battleInsert.rows?.[0]?.id || 0)
    
    // 3. Record Loot History (Item lineage)
    for (const entry of outcome.loot) {
      await recordBattleLoot(this.client, {
        addressCanonical: entry.to,
        slot: entry.slot,
        item: entry.item,
        now,
        metadata: {
          battleId,
          from: entry.from,
          equipped: entry.equipped,
          critical: outcome.critical,
        },
      })
    }
    
    // 4. Apply Reward Transfers
    if (REWARD_LEDGER_ENABLED) {
      const ledgerEntries: RewardLedgerEntryInput[] = []
      const { transfer, house, winnerGain } = outcome.transfer
      
      if (transfer > 0) {
        const winnerAddr = outcome.winner === 'attacker' ? outcome.attacker.address : outcome.defender.address
        const loserAddr = outcome.winner === 'attacker' ? outcome.defender.address : outcome.attacker.address
        
        if (winnerGain > 0) {
          ledgerEntries.push({
            address: winnerAddr,
            delta: winnerGain,
            reason: 'battle_win',
            battleId,
            metadata: {
              opponent: loserAddr,
              transfer,
              house,
              critical: outcome.critical,
              role: 'winner',
            },
          })
        }
        
        ledgerEntries.push({
          address: loserAddr,
          delta: -transfer,
          reason: 'battle_loss',
          battleId,
          metadata: {
            opponent: winnerAddr,
            transfer,
            house,
            critical: outcome.critical,
            role: 'loser',
          },
        })
        
        const treasuryAddress = ledgerTreasuryAddress()
        if (treasuryAddress && house > 0) {
          ledgerEntries.push({
            address: treasuryAddress,
            delta: house,
            reason: 'treasury_cut',
            battleId,
            metadata: {
              from: loserAddr,
              to: winnerAddr,
              critical: outcome.critical,
              role: 'house',
            },
          })
        }
        
        if (ledgerEntries.length) {
          await applyLedgerEntries(this.client, ledgerEntries, { now })
        }
      }
    } else {
      // Legacy Token Holders update (Double write)
      const chainKind = resolveChainKind()
      const nowIso = now.toISOString()
      await this.client.query(
        `insert into public.token_holders (address, address_cased, address_canonical, chain_kind, balance, updated_at)
           values ($1, $1, $1, $6, $2, $3),
                  ($4, $4, $4, $6, $5, $3)
         on conflict (address_canonical, chain_kind) do update set balance = excluded.balance, updated_at = excluded.updated_at`,
        [
          outcome.attacker.address,
          outcome.attacker.pointsAfter,
          nowIso,
          outcome.defender.address,
          outcome.defender.pointsAfter,
          chainKind,
        ],
      )
    }
    
    // 5. Update Cooldowns
    await this.client.query(
      `insert into public.pvp_cooldowns (attacker, defender, next_allowed_at)
       values ($1, $2, $3), ($2, $1, $3)
       on conflict (attacker, defender) do update set next_allowed_at = excluded.next_allowed_at, updated_at = now()`,
      [outcome.attacker.address, outcome.defender.address, outcome.cooldownUntil],
    )
    
    return battleId
  }
}
