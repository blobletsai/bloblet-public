import type { PoolClient } from 'pg'

import { assetConfig } from '@/src/config/assets'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'
import { withPgClient } from '@/src/server/pg'
import {
  applyLedgerEntries,
  fetchRewardBalances,
  roundPoints,
} from '@/src/server/rewards'
import { chargeCareWithClient } from '@/src/server/gameplay/careService'
import { CareError } from '@/src/server/gameplay/careErrors'
import {
  runBattle,
  BattleError,
} from '@/src/server/gameplay/battleService'

type Tier = 'top' | 'middle' | 'bottom'

export type SandboxWalletSeed = {
  address: string
  tokenAmount?: number
  tier?: Tier
  name?: string
  notes?: string | null
}

export type SandboxGameplaySeedOptions = {
  wallets: SandboxWalletSeed[]
  chainKind?: string
  careChargesPerWallet?: number
  assignLoadouts?: boolean
  runBattles?: boolean
  battlesToRun?: number
}

export type SandboxGameplaySeedResult = {
  wallets: Array<{
    address: string
    tier: Tier
    tokenTarget: number
    credited: number
    careApplied: boolean
    loadoutAssigned: boolean
  }>
  battles: Array<{
    battleId: number
    attacker: string
    defender: string
    winner: 'attacker' | 'defender'
    critical: boolean
    transfer: number
  }>
  errors: Array<{ scope: 'wallet' | 'battle'; address?: string; attacker?: string; defender?: string; message: string }>
}

type NormalizedWallet = {
  address: string
  addressCased: string
  tokenTarget: number
  tier: Tier
  name: string
  notes: string | null
}

type LoadoutPreset = {
  weaponSlug: string
  shieldSlug: string
}

type LoadoutCatalog = {
  weaponBySlug: Map<string, number>
  shieldBySlug: Map<string, number>
}

const LOADOUT_PRESETS: Record<Tier, LoadoutPreset> = {
  top: { weaponSlug: 'photon-saber', shieldSlug: 'tin-dome' },
  middle: { weaponSlug: 'photon-saber', shieldSlug: 'cloth-wrap' },
  bottom: { weaponSlug: 'rusty-sword', shieldSlug: 'cloth-wrap' },
}

function inferTier(tokenTarget: number): Tier {
  if (tokenTarget >= 25000) return 'top'
  if (tokenTarget >= 15000) return 'middle'
  return 'bottom'
}

function normalizeWallets(wallets: SandboxWalletSeed[], chainKind: string): NormalizedWallet[] {
  const seen = new Map<string, NormalizedWallet>()
  wallets.forEach((wallet, index) => {
    const rawAddress = String(wallet.address || '').trim()
    if (!rawAddress) return
    let addressCanonical: string
    try {
      addressCanonical = normalizeChainAddress(rawAddress, chainKind)
    } catch {
      return
    }
    if (!addressCanonical) return
    if (seen.has(addressCanonical)) return
    const numericTarget = Number(wallet.tokenAmount)
    const tokenTarget = Number.isFinite(numericTarget) && numericTarget > 0 ? numericTarget : 20000
    const tier = wallet.tier ?? inferTier(tokenTarget)
    const name = wallet.name?.trim() || `Demo Bloblet ${index + 1}`
    seen.set(addressCanonical, {
      address: addressCanonical,
      addressCased: rawAddress || addressCanonical,
      tokenTarget,
      tier,
      name,
      notes: wallet.notes ?? null,
    })
  })
  return Array.from(seen.values())
}

async function fetchLoadoutCatalog(client: PoolClient): Promise<LoadoutCatalog> {
  const res = await client.query(
    `select id, slug, type
       from public.pvp_items`,
  )
  const weaponBySlug = new Map<string, number>()
  const shieldBySlug = new Map<string, number>()
  for (const row of res.rows) {
    const slug = String(row.slug || '').toLowerCase()
    const id = Number(row.id)
    if (!slug || !Number.isFinite(id)) continue
    if (row.type === 'shield') shieldBySlug.set(slug, id)
    else weaponBySlug.set(slug, id)
  }
  return { weaponBySlug, shieldBySlug }
}

function selectLoadoutIds(catalog: LoadoutCatalog, tier: Tier) {
  const preset = LOADOUT_PRESETS[tier] || LOADOUT_PRESETS.bottom
  const fallbackWeapon = catalog.weaponBySlug.get('rusty-sword') ?? null
  const fallbackShield = catalog.shieldBySlug.get('cloth-wrap') ?? null
  const weaponId = catalog.weaponBySlug.get(preset.weaponSlug) ?? fallbackWeapon
  const shieldId = catalog.shieldBySlug.get(preset.shieldSlug) ?? fallbackShield
  return { weaponId, shieldId }
}

function computeRanks(wallets: NormalizedWallet[]) {
  const sorted = [...wallets].sort((a, b) => b.tokenTarget - a.tokenTarget)
  const rankByAddress = new Map<string, number>()
  sorted.forEach((wallet, idx) => rankByAddress.set(wallet.address, idx + 1))

  const total = sorted.reduce((sum, wallet) => sum + wallet.tokenTarget, 0)
  const percentByAddress = new Map<string, number>()
  sorted.forEach((wallet) => {
    if (total <= 0) {
      percentByAddress.set(wallet.address, 0)
    } else {
      percentByAddress.set(wallet.address, roundPoints((wallet.tokenTarget / total) * 100))
    }
  })

  return { rankByAddress, percentByAddress }
}

async function ensureWalletRows(
  client: PoolClient,
  chainKind: string,
  wallets: NormalizedWallet[],
  catalog: LoadoutCatalog,
) {
  const nowIso = new Date().toISOString()
  const defaultSprite = assetConfig.sprites.defaultAlive || null

  const { rankByAddress, percentByAddress } = computeRanks(wallets)

  for (const wallet of wallets) {
    const { weaponId, shieldId } = selectLoadoutIds(catalog, wallet.tier)
    await client.query(
      `insert into public.token_holders (address, address_canonical, address_cased, chain_kind, balance, percent, rank, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (address_canonical, chain_kind) do update
         set balance = excluded.balance,
             percent = excluded.percent,
             rank = excluded.rank,
             address_cased = excluded.address_cased,
             updated_at = excluded.updated_at`,
      [
        wallet.address,
        wallet.address,
        wallet.addressCased,
        chainKind,
        wallet.tokenTarget,
        percentByAddress.get(wallet.address) ?? null,
        rankByAddress.get(wallet.address) ?? null,
        nowIso,
      ],
    )

    await client.query(
      `insert into public.bloblets (
         address,
         address_canonical,
         address_cased,
         chain_kind,
         is_alive,
         tier,
         name,
         avatar_alive_url_256,
         last_seen_at
       )
       values ($1, $2, $3, $4, true, $5, $6, $7, $8)
       on conflict (address_canonical, chain_kind) do update
         set tier = excluded.tier,
             name = excluded.name,
             avatar_alive_url_256 = coalesce(excluded.avatar_alive_url_256, public.bloblets.avatar_alive_url_256),
             last_seen_at = excluded.last_seen_at,
             address_cased = excluded.address_cased`,
      [
        wallet.address,
        wallet.address,
        wallet.addressCased,
        chainKind,
        wallet.tier,
        wallet.name,
        defaultSprite,
        nowIso,
      ],
    )

    if (weaponId != null || shieldId != null) {
      await client.query(
        `insert into public.bloblet_loadout (bloblet_address, weapon_item_id, shield_item_id)
         values ($1, $2, $3)
         on conflict (bloblet_address) do update
           set weapon_item_id = excluded.weapon_item_id,
               shield_item_id = excluded.shield_item_id,
               updated_at = now()`,
        [wallet.address, weaponId, shieldId],
      )
    }
  }
}

async function grantLedgerBalances(
  client: PoolClient,
  chainKind: string,
  wallets: NormalizedWallet[],
): Promise<Map<string, number>> {
  const snapshots = await fetchRewardBalances(
    client,
    wallets.map((w) => w.address),
    { lockRows: true },
  )

  const entries = []
  for (const wallet of wallets) {
    const snap = snapshots.get(wallet.address)
    const current = snap?.currentBalance ?? 0
    const delta = roundPoints(wallet.tokenTarget - current)
    if (delta > 0) {
      entries.push({
        address: wallet.address,
        delta,
        reason: 'manual_adjustment' as const,
        metadata: { source: 'sandbox_seed', chainKind },
      })
    }
  }

  if (entries.length) {
    await applyLedgerEntries(client, entries, { updateTokenHolders: false })
  }

  const post = await fetchRewardBalances(client, wallets.map((w) => w.address), { lockRows: true })
  const credited = new Map<string, number>()
  for (const wallet of wallets) {
    const snap = post.get(wallet.address)
    credited.set(wallet.address, snap?.currentBalance ?? 0)
  }
  return credited
}

async function applyCareCharge(
  client: PoolClient,
  chainKind: string,
  wallet: NormalizedWallet,
): Promise<boolean> {
  try {
    await chargeCareWithClient(client, wallet.address, chainKind, new Date(), {
      chargeCost: 0,
      skipDebit: true,
      useExistingTransaction: true,
    })
    return true
  } catch (err) {
    if (err instanceof CareError) {
      if (err.message === 'charge_cooldown') return false
      if (err.message === 'bloblet_not_found') return false
    }
    throw err
  }
}

function buildBattlePairs(wallets: NormalizedWallet[], limit: number): Array<{ attacker: string; defender: string }> {
  if (wallets.length < 2) return []
  const pairs: Array<{ attacker: string; defender: string }> = []
  for (let i = 0; i < wallets.length && pairs.length < limit; i += 1) {
    const attacker = wallets[i]?.address
    const defender = wallets[(i + 1) % wallets.length]?.address
    if (!attacker || !defender || attacker === defender) continue
    pairs.push({ attacker, defender })
  }
  return pairs
}

export async function seedSandboxGameplay(
  options: SandboxGameplaySeedOptions,
): Promise<SandboxGameplaySeedResult> {
  const chainKind = options.chainKind || resolveChainKind()
  const wallets = normalizeWallets(options.wallets || [], chainKind)
  if (!wallets.length) {
    throw new Error('No wallets provided for gameplay seed')
  }

  const careChargesPerWallet = Math.max(0, options.careChargesPerWallet ?? 1)
  const assignLoadouts = options.assignLoadouts !== false
  const runBattlesFlag = options.runBattles !== false
  const battleLimit = Math.max(0, options.battlesToRun ?? wallets.length)

  const walletSummaries: SandboxGameplaySeedResult['wallets'] = []
  const errors: SandboxGameplaySeedResult['errors'] = []

  let catalog: LoadoutCatalog | null = null

  await withPgClient(async (client) => {
    await client.query('BEGIN')
    try {
      catalog = assignLoadouts ? await fetchLoadoutCatalog(client) : { weaponBySlug: new Map(), shieldBySlug: new Map() }

      if (assignLoadouts && catalog) {
        await ensureWalletRows(client, chainKind, wallets, catalog)
      } else {
        await ensureWalletRows(client, chainKind, wallets, { weaponBySlug: new Map(), shieldBySlug: new Map() })
      }

      const credited = await grantLedgerBalances(client, chainKind, wallets)

      for (const wallet of wallets) {
        let careApplied = false
        for (let attempt = 0; attempt < careChargesPerWallet; attempt += 1) {
          const applied = await applyCareCharge(client, chainKind, wallet)
          if (applied) {
            careApplied = true
            break
          }
        }
        walletSummaries.push({
          address: wallet.address,
          tier: wallet.tier,
          tokenTarget: wallet.tokenTarget,
          credited: credited.get(wallet.address) ?? 0,
          careApplied,
          loadoutAssigned: assignLoadouts,
        })
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  })

  const battleSummaries: SandboxGameplaySeedResult['battles'] = []
  if (runBattlesFlag && battleLimit > 0) {
    const pairs = buildBattlePairs(wallets, battleLimit)
    for (const pair of pairs) {
      try {
        const result = await runBattle(pair.attacker, pair.defender)
        battleSummaries.push({
          battleId: result.battleId,
          attacker: result.attacker.address,
          defender: result.defender.address,
          winner: result.winner,
          critical: result.critical,
          transfer: result.transfer.transfer,
        })
      } catch (err) {
        if (err instanceof BattleError) {
          errors.push({
            scope: 'battle',
            attacker: pair.attacker,
            defender: pair.defender,
            message: err.message,
          })
          continue
        }
        throw err
      }
    }
  }

  return {
    wallets: walletSummaries,
    battles: battleSummaries,
    errors,
  }
}
