import { tryNormalizeChainAddress } from '@/src/server/address'
import { resolveChainKind } from '@/src/server/chains'
import { envTrue } from '@/src/server/env'
import { deriveAddressKeys } from '@/src/shared/address/keys'
import { getSpecialHolderSet } from './specialAddresses'

export type SupabaseClientLike = {
  from(table: string): any
}

export type TierKind = 'top' | 'middle' | 'bottom'

export type HolderLayout = {
  tier: TierKind
  anchorX: number
  anchorY: number
}

export type TokenRow = {
  address: string
  address_canonical: string
  address_cased: string
  chain_kind: string
  balance: string
  percent: number
  rank: number | null
  updated_at?: string
}

export type ExistingTokenHolder = {
  address: string
  address_canonical: string
  rank: number | null
  percent: number | null
  balance: string | null
}

export type ExistingBloblet = {
  anchor_x: number | null
  anchor_y: number | null
  tier: string | null
  is_custom?: boolean
  address_cased?: string | null
  avatar_alive_url_256?: string | null
  assigned_variant_id?: number | null
}

export type VariantRow = {
  id: number
  alive_url: string | null
  alive_url_256: string | null
  is_custom?: boolean | null
}

function filterAssignableVariants(rows: VariantRow[] = []): VariantRow[] {
  return rows.filter((row) => row && row.is_custom !== true)
}

function readEnv(name: string): string {
  try {
    const scope: any = typeof globalThis !== 'undefined' ? globalThis : {}
    const denoValue = scope?.Deno?.env?.get?.(name)
    if (denoValue != null) return String(denoValue)
    const nodeValue = scope?.process?.env ? scope.process.env[name] : undefined
    if (nodeValue != null) return String(nodeValue)
  } catch {
    // no-op
  }
  return ''
}

function resolveRewardTreasuryAddress(chainKind?: string | null): string {
  const normalizedChain = resolveChainKind(chainKind)
  const direct = readEnv('REWARD_TREASURY_ADDRESS').trim()
  const fallback = readEnv('SOLANA_TREASURY_PUBLIC_KEY').trim()
  const candidate = direct || fallback
  if (!candidate) return ''
  return tryNormalizeChainAddress(candidate, normalizedChain) || candidate
}

export async function fetchPrevRankedAddresses(
  supa: SupabaseClientLike,
  chainKind: string,
  limit = 3000,
): Promise<string[]> {
  const { data } = await supa
    .from('token_holders')
    .select('address_canonical')
    .eq('chain_kind', chainKind)
    .not('rank', 'is', null)
    .order('rank', { ascending: true })
    .limit(limit)
  return (data || [])
    .map((row: any) => String(row.address_canonical || row.address || '').trim())
    .filter(Boolean)
}

export async function fetchExistingTokenHolders(
  supa: SupabaseClientLike,
  chainKind: string,
  addresses: string[],
): Promise<Map<string, ExistingTokenHolder>> {
  const map = new Map<string, ExistingTokenHolder>()
  if (!addresses.length) return map
  const chunkSize = 200
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize)
    const { data } = await supa
      .from('token_holders')
      .select('address,address_canonical,rank,percent,balance')
      .eq('chain_kind', chainKind)
      .in('address_canonical', chunk)
    for (const row of (data || []) as any[]) {
      const address = String(row.address || '')
      const canonical = String(row.address_canonical || address || '').trim()
      if (!canonical) continue
      map.set(canonical, {
        address,
        address_canonical: canonical,
        rank: row.rank ?? null,
        percent: row.percent ?? null,
        balance: row.balance != null ? String(row.balance) : null,
      })
    }
  }
  return map
}

export async function fetchExistingBloblets(
  supa: SupabaseClientLike,
  chainKind: string,
  addresses: string[],
): Promise<Map<string, ExistingBloblet>> {
  const map = new Map<string, ExistingBloblet>()
  if (!addresses.length) return map
  const chunkSize = 200
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize)
    const { data } = await supa
      .from('bloblets')
      .select(
        'address,address_canonical,address_cased,anchor_x,anchor_y,tier,is_custom,avatar_alive_url_256,assigned_variant_id',
      )
      .eq('chain_kind', chainKind)
      .in('address_canonical', chunk)
    for (const row of (data || []) as any[]) {
      const canonical = String(row.address_canonical || '').trim()
      if (!canonical) continue
      map.set(canonical, {
        anchor_x: row.anchor_x != null ? Number(row.anchor_x) : null,
        anchor_y: row.anchor_y != null ? Number(row.anchor_y) : null,
        tier: row.tier != null ? String(row.tier) : null,
        is_custom: row.is_custom === true,
        address_cased: row.address_cased || row.address || null,
        avatar_alive_url_256: row.avatar_alive_url_256 || null,
        assigned_variant_id: row.assigned_variant_id ?? null,
      })
    }
  }
  return map
}

function normalizeTier(input: string | null | undefined): TierKind {
  const value = String(input || '').toLowerCase() as TierKind
  if (value === 'top' || value === 'middle' || value === 'bottom') return value
  return 'bottom'
}

export async function assignMissingBlobletSprites(
  supa: SupabaseClientLike,
  options: {
    chainKind: string
    addresses: string[]
    layoutMap?: Map<string, HolderLayout>
    existingBloblets: Map<string, ExistingBloblet>
    variants: VariantRow[]
    rowLookup?: Map<string, TokenRow>
    pickAppearance: (address: string, tier: TierKind) => { id: number; url: string }
    getDefaultSpriteUrl: (isAlive: boolean) => string | null
  },
): Promise<number> {
  const {
    chainKind,
    addresses,
    layoutMap,
    existingBloblets,
    variants,
    rowLookup,
    pickAppearance,
    getDefaultSpriteUrl,
  } = options
  if (!addresses.length) return 0
  const assignableVariants = filterAssignableVariants(variants)
  const updates: any[] = []

  for (const raw of addresses) {
    const canonical = String(raw || '').trim()
    if (!canonical) continue
    const existing = existingBloblets.get(canonical)
    if (!existing) continue
    if (existing.is_custom) continue
    const currentUrl = typeof existing.avatar_alive_url_256 === 'string'
      ? existing.avatar_alive_url_256.trim()
      : ''
    if (currentUrl) continue

    const layout = layoutMap?.get(canonical)
    const tier = layout?.tier ?? normalizeTier(existing.tier)
    const variant = assignableVariants.length
      ? pickVariantForAddress(canonical, assignableVariants)
      : null
    const variantAliveBase = variant?.alive_url || null
    const variantAlive256 = variant?.alive_url_256 || variantAliveBase || null
    const fallbackAppearance = pickAppearance(canonical, tier)
    const resolvedUrl = variantAlive256 || getDefaultSpriteUrl(true) || fallbackAppearance.url
    if (!resolvedUrl) continue

    const casedAddress = existing.address_cased || rowLookup?.get(canonical)?.address || canonical
    updates.push({
      address: casedAddress || canonical,
      address_canonical: canonical,
      chain_kind: chainKind,
      avatar_alive_url_256: resolvedUrl,
      assigned_variant_id: variant?.id ?? null,
      tier,
      is_alive: true,
    })

    existing.avatar_alive_url_256 = resolvedUrl
    existing.assigned_variant_id = variant?.id ?? null
  }

  if (!updates.length) return 0
  const chunkSize = 200
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    await supa
      .from('bloblets')
      .upsert(chunk as any, { onConflict: 'address_canonical,chain_kind' })
  }
  return updates.length
}

export async function fetchActiveVariants(
  supa: SupabaseClientLike,
): Promise<VariantRow[]> {
  const { data } = await supa
    .from('sprite_variants')
    .select('id,alive_url,alive_url_256,is_custom')
    .eq('active', true)
    .or('is_custom.is.null,is_custom.eq.false')
    .order('id', { ascending: true })
  return filterAssignableVariants((data || []) as VariantRow[])
}

export function computeTokenHolderChanges(
  tokenRows: TokenRow[],
  existingMap: Map<string, ExistingTokenHolder>,
): TokenRow[] {
  const changed: TokenRow[] = []
  for (const row of tokenRows) {
    const canonical = String(row.address_canonical || row.address || '').trim()
    if (!canonical) continue
    const current = existingMap.get(canonical)
    if (!current) {
      changed.push(row)
      continue
    }
    const rankChanged = Number(current.rank ?? 0) !== Number(row.rank ?? 0)
    const percentChanged = Number(current.percent ?? 0) !== Number(row.percent ?? 0)
    const balanceChanged = String(current.balance ?? '0') !== String(row.balance)
    const casingChanged = String(current.address || '').trim() !== String(row.address_cased || row.address || '').trim()
    if (rankChanged || percentChanged || balanceChanged || casingChanged) {
      changed.push(row)
    }
  }
  return changed
}

export async function upsertTokenHolders(
  supa: SupabaseClientLike,
  chainKind: string,
  tokenRows: TokenRow[],
  existingMap?: Map<string, ExistingTokenHolder>,
): Promise<number> {
  if (!tokenRows.length) return 0
  const canonicalKeys = tokenRows.map((row) => row.address_canonical)
  const map = existingMap ?? await fetchExistingTokenHolders(supa, chainKind, canonicalKeys)
  const changed = computeTokenHolderChanges(tokenRows, map)
  if (!changed.length) return 0
  const { error } = await supa
    .from('token_holders')
    .upsert(changed as any, { onConflict: 'address_canonical,chain_kind' })
  if (error) throw error
  return changed.length
}

export async function clearDropoutRanks(
  supa: SupabaseClientLike,
  chainKind: string,
  dropouts: string[],
): Promise<void> {
  if (!dropouts.length) return
  const chunkSize = 200
  for (let i = 0; i < dropouts.length; i += chunkSize) {
    const chunk = dropouts.slice(i, i + chunkSize)
    await supa
      .from('token_holders')
      .update({ rank: null, percent: 0 } as any)
      .eq('chain_kind', chainKind)
      .in('address_canonical', chunk)
  }
}

export function pickVariantForAddress(addr: string, variants: VariantRow[]): VariantRow | null {
  if (!variants.length) return null
  let hash = 2166136261 >>> 0
  const canonical = String(addr || '').trim()
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const idx = Number(hash >>> 0) % variants.length
  return variants[idx] ?? null
}

export async function insertNewBloblets(
  supa: SupabaseClientLike,
  options: {
    chainKind: string
    newAddresses: string[]
    layoutMap: Map<string, HolderLayout>
    rowLookup: Map<string, TokenRow>
    variants: VariantRow[]
    existingBloblets: Map<string, ExistingBloblet>
    pickAppearance: (address: string, tier: TierKind) => { id: number; url: string }
    getDefaultSpriteUrl: (isAlive: boolean) => string | null
    birthOnly?: boolean
  },
): Promise<number> {
  const {
    chainKind,
    newAddresses,
    layoutMap,
    rowLookup,
    variants,
    existingBloblets,
    pickAppearance,
    getDefaultSpriteUrl,
    birthOnly = false,
  } = options
  if (!newAddresses.length) return 0
  const inserts: any[] = []
  const assignableVariants = filterAssignableVariants(variants)

  for (const raw of newAddresses) {
    const canonical = String(raw || '').trim()
    if (!canonical) continue
    if (existingBloblets.get(canonical)?.is_custom) continue
    const layout = layoutMap.get(canonical)
    const row = rowLookup.get(canonical)
    if (!layout || !row) continue
    const tier = layout.tier
    const appearance = pickAppearance(canonical, tier)
    const variant = pickVariantForAddress(canonical, assignableVariants)
    const variantAliveBase = variant?.alive_url || null
    const variantAlive256 = variant?.alive_url_256 || variantAliveBase || null
    const defaultAlive256 = variantAlive256 || getDefaultSpriteUrl(true) || appearance.url
    inserts.push({
      address: row.address_canonical || canonical,
      address_canonical: row.address_canonical || canonical,
      address_cased: row.address_cased || row.address || canonical,
      chain_kind: chainKind,
      is_alive: true,
      tier,
      appearance_id: appearance.id,
      avatar_alive_url_256: variantAlive256 ?? defaultAlive256,
      assigned_variant_id: variant?.id ?? null,
      last_seen_at: new Date().toISOString(),
      anchor_x: layout.anchorX,
      anchor_y: layout.anchorY,
      entity_type: 'bloblet',
    })
  }
  if (!inserts.length) return 0
  const { error } = await supa
    .from('bloblets')
    .upsert(inserts as any, { onConflict: 'address_canonical,chain_kind' })
  if (error) throw error
  return inserts.length
}

function isInvalidAnchorValue(value: number | null | undefined): boolean {
  if (value == null) return true
  const num = Number(value)
  if (!Number.isFinite(num)) return true
  return Math.abs(num) < 1
}

export async function updateBlobletAnchors(
  supa: SupabaseClientLike,
  options: {
    chainKind: string
    layoutMap: Map<string, HolderLayout>
    rowLookup: Map<string, TokenRow>
    existingBloblets: Map<string, ExistingBloblet>
    skipAddresses?: Set<string>
  },
): Promise<number> {
  const {
    chainKind,
    layoutMap,
    rowLookup,
    existingBloblets,
    skipAddresses = new Set<string>(),
  } = options
  const updates: any[] = []
  for (const [canonical, layout] of layoutMap.entries()) {
    if (skipAddresses.has(canonical)) continue
    const existing = existingBloblets.get(canonical)
    const row = rowLookup.get(canonical)
    if (!row) continue
    const tier = layout.tier
    const addressCased = String(row.address_cased || row.address || canonical)
    const rawAnchorX = existing?.anchor_x
    const rawAnchorY = existing?.anchor_y
    const hasValidAnchors =
      !!existing
      && !isInvalidAnchorValue(rawAnchorX)
      && !isInvalidAnchorValue(rawAnchorY)
    const parsedAnchorX = hasValidAnchors ? Number(rawAnchorX) : 0
    const parsedAnchorY = hasValidAnchors ? Number(rawAnchorY) : 0
    const deltaX = hasValidAnchors ? Math.abs(parsedAnchorX - layout.anchorX) : Infinity
    const deltaY = hasValidAnchors ? Math.abs(parsedAnchorY - layout.anchorY) : Infinity
    const changed =
      !hasValidAnchors
      || deltaX > 0.5
      || deltaY > 0.5
      || String(existing?.tier || '').toLowerCase() !== tier
    if (!changed) continue
    updates.push({
      address: row.address_canonical || canonical,
      address_canonical: row.address_canonical || canonical,
      address_cased: addressCased,
      chain_kind: chainKind,
      anchor_x: layout.anchorX,
      anchor_y: layout.anchorY,
      tier,
      is_alive: true,
      entity_type: 'bloblet',
    })
  }
  if (!updates.length) return 0
  const chunkSize = 200
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    await supa
      .from('bloblets')
      .upsert(chunk as any, { onConflict: 'address_canonical,chain_kind' })
  }
  return updates.length
}

export async function markBlobletsAlive(
  supa: SupabaseClientLike,
  chainKind: string,
  addresses: string[],
  rowLookup?: Map<string, TokenRow>,
): Promise<void> {
  if (!addresses.length) return
  const nowIso = new Date().toISOString()
  const rows = addresses
    .map((value) => {
      const canonical = String(value || '').trim()
      if (!canonical) return null
      const row = rowLookup?.get(canonical)
      const address = row?.address_cased || row?.address || canonical
      return {
        address: row?.address_canonical || canonical,
        address_canonical: row?.address_canonical || canonical,
        address_cased: address,
        chain_kind: chainKind,
        is_alive: true,
        last_seen_at: nowIso,
      }
    })
    .filter(Boolean)
  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await supa
      .from('bloblets')
      .upsert(chunk as any, { onConflict: 'address_canonical,chain_kind' })
  }
}

export async function shameDropouts(
  supa: SupabaseClientLike,
  chainKind: string,
  currentAddresses: string[],
  dropouts: string[],
  options: {
    shameWindowMs?: number
  } = {},
): Promise<void> {
  const { shameWindowMs = 60 * 60 * 1000 } = options
  const nowIso = new Date().toISOString()
  const untilIso = new Date(Date.now() + shameWindowMs).toISOString()
  if (currentAddresses.length) {
    const chunkSize = 200
    for (let i = 0; i < currentAddresses.length; i += chunkSize) {
      const chunk = currentAddresses.slice(i, i + chunkSize)
      await supa
        .from('shames')
        .delete()
        .eq('chain_kind', chainKind)
        .in('address_canonical', chunk)
    }
  }
  if (!dropouts.length) return
  const chunkSize = 200
  for (let i = 0; i < dropouts.length; i += chunkSize) {
    const chunk = dropouts.slice(i, i + chunkSize)
    await supa
      .from('shames')
      .delete()
      .eq('chain_kind', chainKind)
      .in('address_canonical', chunk)
    const rows = chunk.map((addr) => ({
      address: addr,
      address_canonical: addr,
      address_cased: addr,
      chain_kind: chainKind,
      until: untilIso,
      rank_at_drop: null as any,
    }))
    await supa.from('shames').insert(rows as any)
    await supa
      .from('bloblets')
      .update({ is_alive: false, last_seen_at: nowIso } as any)
      .eq('chain_kind', chainKind)
      .in('address_canonical', chunk)
  }
}

export async function logRefreshEvent(
  supa: SupabaseClientLike,
  updatedTop: number,
  clearedDropouts: number,
): Promise<void> {
  try {
    await supa.from('events').insert({
      type: 'holders_refresh',
      severity: 1,
      payload: {
        updated_top: updatedTop,
        cleared_dropouts: clearedDropouts,
        updated_total: updatedTop + clearedDropouts,
      },
    } as any)
  } catch (error) {
    console.error('[holders-refresh] failed to log refresh event', {
      updatedTop,
      clearedDropouts,
      error,
    })
  }
}

type PruneOptions = {
  chainKind: string
  graceMinutes: number
  nowIso?: string
  dryRun?: boolean
  punishDeadWallets?: boolean
  treasuryAddress?: string | null
}

type PruneResult = {
  addresses: string[]
  blobletsDeleted: number
  tokenHoldersDeleted: number
  shamesDeleted: number
  cutoffIso: string
  penalizedWallets: number
  confiscatedTotalRaw: number
}

export async function pruneExpiredDeadHolders(
  supa: SupabaseClientLike,
  options: PruneOptions,
): Promise<PruneResult> {
  const { chainKind, graceMinutes, nowIso, dryRun = false } = options
  const envToggle = readEnv('PUNISH_DEAD_WALLETS').trim()
  const punishDefault = envToggle ? envTrue(envToggle) : true
  const punishDeadWallets = options.punishDeadWallets ?? punishDefault
  const treasuryAddress = (options.treasuryAddress ?? resolveRewardTreasuryAddress(chainKind) ?? '').trim()
  const numericGrace = Number(graceMinutes)
  if (!Number.isFinite(numericGrace) || numericGrace <= 0) {
    return {
      addresses: [],
      blobletsDeleted: 0,
      tokenHoldersDeleted: 0,
      shamesDeleted: 0,
      cutoffIso: new Date().toISOString(),
      penalizedWallets: 0,
      confiscatedTotalRaw: 0,
    }
  }
  const nowMs = Number.isFinite(Date.parse(nowIso || '')) ? Date.parse(nowIso as string) : Date.now()
  const cutoffIso = new Date(nowMs - numericGrace * 60 * 1000).toISOString()

  const rpcCapable = typeof (supa as any)?.rpc === 'function'
  if (rpcCapable) {
    const { data, error } = await (supa as any).rpc('prune_dead_holders', {
      p_chain_kind: chainKind,
      p_grace_minutes: numericGrace,
      p_dry_run: dryRun,
      p_punish_dead_wallets: punishDeadWallets,
      p_treasury_address: treasuryAddress || null,
    })
    if (error) throw error
    const addresses = Array.isArray(data?.addresses)
      ? data.addresses.map((addr: any) => String(addr || '').trim()).filter(Boolean)
      : []
    return {
      addresses,
      blobletsDeleted: Number(data?.bloblets_deleted ?? 0),
      tokenHoldersDeleted: Number(data?.token_holders_deleted ?? 0),
      shamesDeleted: Number(data?.shames_deleted ?? 0),
      cutoffIso: String(data?.cutoff || cutoffIso),
      penalizedWallets: Number(data?.penalized_wallets ?? 0),
      confiscatedTotalRaw: Number(data?.confiscated_total_raw ?? 0),
    }
  }

  // Fallback path (used in local tests) when RPC is unavailable
  const blobletQuery = supa
    .from('bloblets')
    .eq('chain_kind', chainKind)
    .eq('is_alive', false)
    .lt('last_seen_at', cutoffIso)
    .or('entity_type.is.null,entity_type.eq.bloblet')
  const { data: blobletRows, error: blobletError } = dryRun
    ? await blobletQuery.select('address_canonical')
    : await blobletQuery.delete().select('address_canonical')
  if (blobletError) throw blobletError
  const addresses = (blobletRows || [])
    .map((row: any) => String(row?.address_canonical || '').trim())
    .filter(Boolean)
  if (!addresses.length) {
    return {
      addresses: [],
      blobletsDeleted: 0,
      tokenHoldersDeleted: 0,
      shamesDeleted: 0,
      cutoffIso,
      penalizedWallets: 0,
      confiscatedTotalRaw: 0,
    }
  }

  const uniqueAddresses = Array.from(new Set<string>(addresses))
  const inspectBalances = (punishDeadWallets && !!treasuryAddress) || dryRun
  let penalizedWallets = 0
  let confiscatedTotalRaw = 0

  if (inspectBalances) {
    const holderQuery = supa
      .from('token_holders')
      .eq('chain_kind', chainKind)
      .in('address_canonical', uniqueAddresses)
    const { data: holderRows, error: holderError } = await holderQuery.select('address,address_canonical')
    if (holderError) throw holderError
    const addressToCanonical = new Map<string, string>()
    const canonicalToAddress = new Map<string, string>()
    for (const row of holderRows || []) {
      const canonical = String(row?.address_canonical || '').trim()
      const addressValue = String(row?.address || canonical || '').trim()
      if (!canonical || !addressValue) continue
      canonicalToAddress.set(canonical, addressValue)
      addressToCanonical.set(addressValue, canonical)
    }
    const rewardAddresses = Array.from(canonicalToAddress.values()).filter(Boolean)
    if (rewardAddresses.length) {
      const rewardQuery = supa
        .from('reward_balances')
        .in('address', rewardAddresses)
      const { data: rewardRows, error: rewardError } = await rewardQuery.select('address,balance_raw')
      if (rewardError) throw rewardError
      const balanceByCanonical = new Map<string, number>()
      for (const row of rewardRows || []) {
        const addr = String(row?.address || '').trim()
        const canonical = addressToCanonical.get(addr)
        if (!canonical) continue
        const raw = Number(row?.balance_raw ?? 0)
        balanceByCanonical.set(canonical, Number.isFinite(raw) ? raw : 0)
      }
      for (const canonical of uniqueAddresses) {
        const raw = balanceByCanonical.get(canonical) ?? 0
        if (raw > 0) {
          penalizedWallets += 1
          confiscatedTotalRaw += raw
        }
      }
    }
  }

  async function affect(table: string, column: string): Promise<number> {
    let total = 0
    const chunkSize = 200
    for (let i = 0; i < uniqueAddresses.length; i += chunkSize) {
      const chunk = uniqueAddresses.slice(i, i + chunkSize)
      let query = supa
        .from(table)
        .eq('chain_kind', chainKind)
        .in(column, chunk)
      if (dryRun) {
        const { count, error } = await query.select(column, { count: 'exact', head: true })
        if (error) throw error
        total += count || 0
      } else {
        const { data, error } = await query.delete().select(column)
        if (error) throw error
        total += data?.length ?? 0
      }
    }
    return total
  }

  const tokenHoldersDeleted = await affect('token_holders', 'address_canonical')
  const shamesDeleted = await affect('shames', 'address_canonical')

  return {
    addresses: uniqueAddresses,
    blobletsDeleted: dryRun ? 0 : uniqueAddresses.length,
    tokenHoldersDeleted,
    shamesDeleted,
    cutoffIso,
    penalizedWallets,
    confiscatedTotalRaw,
  }
}

export function buildTokenRowsFromSnapshot(
  holders: { address: string; balanceRaw: bigint }[],
  options: {
    chainKind: string
    thresholdRaw: bigint
    nowIso?: string
    limit?: number
  },
): TokenRow[] {
  const { chainKind, thresholdRaw, nowIso, limit = 2000 } = options
  const specialSet = getSpecialHolderSet(chainKind)
  const normalized = holders
    .map((entry) => {
      const raw = String(entry.address || '').trim()
      if (!raw) return null
      const { canonical } = deriveAddressKeys(raw, { chainKind })
      if (!canonical) return null
      return { canonical, balanceRaw: entry.balanceRaw }
    })
    .filter((entry): entry is { canonical: string; balanceRaw: bigint } => {
      if (!entry) return false
      if (entry.balanceRaw < thresholdRaw) return false
      return !specialSet.has(entry.canonical)
    })
  const sorted = normalized.sort((a, b) => {
    if (a.balanceRaw === b.balanceRaw) return 0
    return a.balanceRaw > b.balanceRaw ? -1 : 1
  })
  const capped = sorted.slice(0, limit)
  const totalRaw = capped.reduce((acc, row) => acc + row.balanceRaw, 0n) || 1n
  return capped.map((row, index) => {
    const percent = Number((row.balanceRaw * 10000n) / totalRaw) / 100
    return {
      address: row.canonical,
      address_canonical: row.canonical,
      address_cased: row.canonical,
      chain_kind: chainKind,
      balance: row.balanceRaw.toString(),
      percent,
      rank: index + 1,
      updated_at: nowIso,
    }
  })
}

export function findNewAddresses(tokenRows: TokenRow[], existingBloblets: Map<string, ExistingBloblet>): string[] {
  const addresses = tokenRows.map((row) => String(row.address_canonical || row.address || '').trim())
  return addresses.filter((addr) => addr && !existingBloblets.has(addr))
}

export function toRowLookup(tokenRows: TokenRow[]): Map<string, TokenRow> {
  return new Map(tokenRows.map((row) => [String(row.address_canonical || row.address || '').trim(), row]))
}

export function toAddressList(tokenRows: TokenRow[]): string[] {
  return tokenRows.map((row) => String(row.address_canonical || row.address || '').trim())
}

export function filterDropouts(prevRanked: string[], currentAddresses: Set<string>): string[] {
  return prevRanked.filter((addr) => addr && !currentAddresses.has(addr))
}

export function ensureTier(_address: string, rank: number | null | undefined): TierKind {
  return rankToTier(rank)
}

function rankToTier(rank: number | null | undefined): TierKind {
  if (!Number.isFinite(rank) || !rank || rank <= 0) return 'bottom'
  if (rank <= 20) return 'top'
  if (rank <= 70) return 'middle'
  return 'bottom'
}
