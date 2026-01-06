import { GetServerSidePropsContext } from 'next'

import { getChainAdapter, resolveChainKind } from '@/src/server/chains'
import { getSessionFromRequest } from '@/src/server/auth'
import { supaAdmin } from '@/src/server/supa'
import { resolveEconomyConfig } from '@/src/config/economy'
import { solanaConfig } from '@/src/config/solana'
import { sanitizeLoadouts } from '@/src/shared/pvp/loadoutVisibility'
import { solanaTokenDecimals } from '@/src/shared/points'
import type { BlobletLoadout, PvpBattle, PvpItem } from '@/types'

export type HomePageProps = {
  bloblets: {
    address: string
    address_cased?: string | null
    is_alive: boolean
    tier: 'top' | 'middle' | 'bottom'
    avatar_alive_url_256?: string | null
    is_custom: boolean
    name: string | null
    social_handle?: string | null
    rank: number | null
    percent: number | null
    balance: number | null
    reward_balance?: number | null
    size_multiplier?: number | null
    anchor_x?: number | null
    anchor_y?: number | null
    entity_type?: string | null
    z?: number | null
    scale?: number | null
    prop_type?: string | null
    last_owner?: string | null
  }[]
  mint: string
  decimals: number
  treasuryWallet: string
  treasuryAta: string | null
  loadouts: Array<BlobletLoadout & { weapon?: PvpItem | null; shield?: PvpItem | null }>
  pvpItems: PvpItem[]
  battles: PvpBattle[]
  rewardTopUpMin: number
  rewardTopUpMax: number
}

export async function getHomePageProps(context: GetServerSidePropsContext): Promise<HomePageProps> {
  const supa = supaAdmin()
  const viewerAddress = getSessionFromRequest(context.req as any)?.address?.trim() || ''
  const chainKind = resolveChainKind()
  const chain = getChainAdapter(chainKind)
  const economy = resolveEconomyConfig()
  const defaultRewardTopUpMin = Number(economy.rewardTopUp.minRp || 0)
  const defaultRewardTopUpMax = Math.max(defaultRewardTopUpMin, Number(economy.rewardTopUp.maxRp || defaultRewardTopUpMin))
  const decimals = Number.isFinite(chain.metadata.tokenDecimals)
    ? Math.max(0, Math.floor(chain.metadata.tokenDecimals))
    : solanaTokenDecimals()
  const mint = (chain.metadata.tokenAddress || solanaConfig.token.mint || '').trim()
  const treasuryWallet = (solanaConfig.treasury.publicKey || '').trim()
  const treasuryAta = null

  const now = new Date().toISOString()
  const nowShame = now

  const [
    holdersResult,
    shamesResult,
    landmarksResult,
    placeholderResult,
  ] = await Promise.all([
    supa
      .from('token_holders')
      .select('address,address_canonical,address_cased,chain_kind,rank,percent, bloblets(is_alive,tier,avatar_alive_url_256,is_custom,name,social_handle,address_cased,address_canonical,chain_kind,entity_type,anchor_x,anchor_y,z,scale,prop_type,size_multiplier)')
      .eq('chain_kind', chainKind)
      .not('rank', 'is', null)
      .order('rank', { ascending: true })
      .range(0, 999),
    supa
      .from('shames')
      .select('address,address_canonical,chain_kind,until,rank_at_drop')
      .eq('chain_kind', chainKind)
      .gt('until', nowShame)
      .order('until', { ascending: false }),
    (() => {
      const base = supa
        .from('bloblets')
        .select('address,address_canonical,chain_kind,name,avatar_alive_url_256,anchor_x,anchor_y,z,scale,prop_type,entity_type,size_multiplier,prop_id,rename_count,last_owner')
        .eq('entity_type', 'landmark')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('z', { ascending: true })
      if (chainKind === 'sol') {
        return base.in('chain_kind', ['sol', 'solana'])
      }
      return base.eq('chain_kind', chainKind)
    })(),
    supa
      .from('bloblets')
      .select('address,avatar_alive_url_256,is_alive,tier,size_multiplier,chain_kind')
      .eq('address', 'placeholder_sprite')
      .eq('chain_kind', chainKind)
      .single(),
  ])

  const normalizeItem = (raw: any): PvpItem => ({
    id: Number(raw?.id || 0),
    slug: String(raw?.slug || '').toLowerCase(),
    type: raw?.type === 'shield' ? 'shield' : 'weapon',
    name: String(raw?.name || raw?.slug || 'Unknown'),
    rarity: String(raw?.rarity || 'common'),
    op: Number(raw?.op || 0),
    dp: Number(raw?.dp || 0),
    icon_url: raw?.icon_url ? String(raw.icon_url) : null,
  })

  const loadoutsQueryBuilder = supa
    .from('bloblet_loadout')
    .select('bloblet_address,weapon_item_id,shield_item_id, weapon:pvp_items!bloblet_loadout_weapon_item_id_fkey(id,slug,type,name,rarity,op,dp,icon_url), shield:pvp_items!bloblet_loadout_shield_item_id_fkey(id,slug,type,name,rarity,op,dp,icon_url)')
  if (viewerAddress) {
    loadoutsQueryBuilder.eq('bloblet_address', viewerAddress)
  } else {
    loadoutsQueryBuilder.limit(0)
  }
  const loadoutsQuery = await loadoutsQueryBuilder

  const loadouts: Array<BlobletLoadout & { weapon?: PvpItem | null; shield?: PvpItem | null }> =
    loadoutsQuery.error && loadoutsQuery.error?.code !== '42P01'
      ? []
      : (loadoutsQuery.data || []).map((row: any) => ({
        bloblet_address: String(row.bloblet_address || '').trim(),
        weapon_item_id: row.weapon_item_id ? Number(row.weapon_item_id) : null,
        shield_item_id: row.shield_item_id ? Number(row.shield_item_id) : null,
        weapon: row.weapon ? normalizeItem(row.weapon) : null,
        shield: row.shield ? normalizeItem(row.shield) : null,
      }))
  const maskedLoadouts = sanitizeLoadouts(loadouts, viewerAddress)

  const itemsQuery = await supa
    .from('pvp_items')
    .select('id,slug,type,name,rarity,op,dp,icon_url')
    .order('id', { ascending: true })

  const pvpItems: PvpItem[] =
    itemsQuery.error && itemsQuery.error?.code !== '42P01'
      ? []
      : (itemsQuery.data || []).map((row: any) => normalizeItem(row))

  const battlesQuery = await supa
    .from('pvp_battles')
    .select('id,attacker,defender,attacker_booster,defender_booster,attacker_base,defender_base,attacker_total,defender_total,winner,transfer_points,house_points,loot,critical,created_at')
    .order('created_at', { ascending: false })
    .limit(12)

  const parseLoot = (input: any): any[] => {
    if (Array.isArray(input)) return input
    if (typeof input === 'string') {
      try { const parsed = JSON.parse(input); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
    }
    return []
  }

  const battles: PvpBattle[] =
    battlesQuery.error && battlesQuery.error?.code !== '42P01'
      ? []
      : (battlesQuery.data || []).map((row: any) => ({
        id: Number(row?.id || 0),
        attacker: String(row?.attacker || ''),
        defender: String(row?.defender || ''),
        attacker_booster: Number(row?.attacker_booster || 0),
        defender_booster: Number(row?.defender_booster || 0),
        attacker_base: Number(row?.attacker_base || 0),
        defender_base: Number(row?.defender_base || 0),
        attacker_total: Number(row?.attacker_total || 0),
        defender_total: Number(row?.defender_total || 0),
        winner: row?.winner === 'attacker' ? 'attacker' : 'defender',
        transfer_points: Number(row?.transfer_points || 0),
        house_points: Number(row?.house_points || 0),
        loot: parseLoot(row?.loot).map((entry: any) => ({
          slot: entry?.slot === 'shield' ? 'shield' : 'weapon',
          item_id: Number(entry?.item_id || entry?.id || 0),
          item_slug: String(entry?.item_slug || entry?.slug || ''),
          from: String(entry?.from || ''),
          to: String(entry?.to || ''),
          equipped: entry?.equipped === true,
        })),
        critical: row?.critical === true,
        created_at: String(row?.created_at || new Date().toISOString()),
      }))

  if (holdersResult.error) {
    return {
      bloblets: [],
      mint,
      decimals,
      treasuryWallet,
      treasuryAta,
      loadouts: [],
      pvpItems: [],
      battles: [],
      rewardTopUpMin: defaultRewardTopUpMin,
      rewardTopUpMax: defaultRewardTopUpMax,
    }
  }

  const data = holdersResult.data || []
  const topAddrs = new Set(
    (data || [])
      .map((r: any) => String(r.address_canonical || r.address || '').trim())
      .filter(Boolean),
  )

  const shameAddrs = (shamesResult.data || [])
    .map((s: any) => String(s.address_canonical || s.address || '').trim())
    .filter(Boolean)
  const rewardBalanceAddresses = new Set<string>()
  for (const row of data as any[]) {
    const addr = String(row?.address_canonical || row?.address || '').trim()
    if (addr) rewardBalanceAddresses.add(addr)
  }
  for (const addr of shameAddrs) {
    const normalized = String(addr || '').trim()
    if (normalized) rewardBalanceAddresses.add(normalized)
  }

  type RewardBalanceRow = {
    address: string | null
    balance_raw: string | number | null
  }

  const fetchRewardBalances = async (addresses: string[]): Promise<RewardBalanceRow[]> => {
    const chunkSize = 100
    const rows: RewardBalanceRow[] = []
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize)
      if (!chunk.length) continue
      const { data: balanceData, error } = await supa
        .from('reward_balances')
        .select('address,balance_raw')
        .in('address', chunk)
      if (error) throw error
      if (balanceData) rows.push(...(balanceData as RewardBalanceRow[]))
    }
    return rows
  }

  const rewardBalanceRows = rewardBalanceAddresses.size > 0
    ? await fetchRewardBalances(Array.from(rewardBalanceAddresses))
    : []
  const rewardBalanceMap = new Map<string, number>()
  for (const row of rewardBalanceRows) {
    const addr = String(row.address || '').trim()
    if (!addr) continue
    const numeric = Number(row.balance_raw)
    if (!Number.isFinite(numeric)) continue
    rewardBalanceMap.set(addr, numeric)
  }

  let shameBloblets: any[] = []
  if (shameAddrs.length) {
    const { data: bldata } = await supa
      .from('bloblets')
      .select('address,address_canonical,address_cased,chain_kind,is_alive,tier,avatar_alive_url_256,is_custom,name,social_handle,entity_type,anchor_x,anchor_y,z,scale,prop_type,size_multiplier')
      .eq('chain_kind', chainKind)
      .in('address_canonical', shameAddrs)
    shameBloblets = (bldata || []).filter((r: any) =>
      !topAddrs.has(String(r.address_canonical || r.address || '').trim()),
    )
  }

  const parseTier = (value: any): 'top' | 'middle' | 'bottom' => {
    const normalized = String(value || '').toLowerCase()
    if (normalized === 'top' || normalized === 'middle' || normalized === 'bottom') return normalized
    return 'bottom'
  }
  const parseNumber = (value: any): number | null => {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }

  const blobletsTop: HomePageProps['bloblets'] = (data || []).map((row: any) => {
    const base = Array.isArray(row.bloblets) ? (row.bloblets[0] || {}) : (row.bloblets || {})
    const address = String(row.address_canonical || row.address || '').trim()
    const anchorX = parseNumber(base?.anchor_x)
    const anchorY = parseNumber(base?.anchor_y)
    const aliveUrlRaw = typeof base?.avatar_alive_url_256 === 'string' ? base.avatar_alive_url_256.trim() : ''
    const aliveUrl256 = aliveUrlRaw.length ? aliveUrlRaw : null
    const rewardBalanceRaw = rewardBalanceMap.get(address)
    const rewardBalance =
      rewardBalanceRaw != null && Number.isFinite(rewardBalanceRaw) ? Number(rewardBalanceRaw) : null
    const fallbackBalance =
      typeof row.percent === 'number' && isFinite(row.percent)
        ? Math.max(0, row.percent)
        : ((row.rank ?? 0) > 0 ? 1 / Math.max(1, Number(row.rank)) : 0)
    return {
      address,
      address_cased: (row.address_cased ?? base?.address_cased ?? address) || null,
      is_alive: base?.is_alive === true,
      tier: parseTier(base?.tier),
      avatar_alive_url_256: aliveUrl256 ?? null,
      is_custom: base?.is_custom === true,
      name: base?.name != null ? String(base.name) : null,
      social_handle: base?.social_handle != null ? String(base.social_handle) : null,
      rank: parseNumber(row.rank),
      percent: parseNumber(row.percent),
      balance: rewardBalance ?? fallbackBalance,
      reward_balance: rewardBalance,
      size_multiplier: parseNumber(base?.size_multiplier),
      anchor_x: anchorX,
      anchor_y: anchorY,
      entity_type: base?.entity_type ? String(base.entity_type) : 'bloblet',
      z: parseNumber(base?.z),
      scale: parseNumber(base?.scale),
      prop_type: base?.prop_type != null ? String(base.prop_type) : null,
      last_owner: base?.last_owner != null ? String(base.last_owner) : null,
    }
  })

  const blobletsShame: HomePageProps['bloblets'] = shameBloblets.map((entry: any) => {
    const address = String(entry.address_canonical || entry.address || '').trim()
    const aliveUrlRaw = typeof entry?.avatar_alive_url_256 === 'string' ? entry.avatar_alive_url_256.trim() : ''
    const aliveUrl256 = aliveUrlRaw.length ? aliveUrlRaw : null
    const rewardBalanceRaw = rewardBalanceMap.get(address)
    const rewardBalance =
      rewardBalanceRaw != null && Number.isFinite(rewardBalanceRaw) ? Number(rewardBalanceRaw) : null
    return {
      address,
      address_cased: (entry.address_cased ?? address) || null,
      is_alive: false,
      tier: parseTier(entry.tier),
      avatar_alive_url_256: aliveUrl256 ?? null,
      is_custom: entry.is_custom === true,
      name: entry.name != null ? String(entry.name) : null,
      social_handle: entry.social_handle != null ? String(entry.social_handle) : null,
      rank: null,
      percent: null,
      balance: rewardBalance ?? 0,
      reward_balance: rewardBalance,
      size_multiplier: parseNumber(entry.size_multiplier),
      anchor_x: parseNumber(entry.anchor_x),
      anchor_y: parseNumber(entry.anchor_y),
      entity_type: entry.entity_type ? String(entry.entity_type) : 'bloblet',
      z: parseNumber(entry.z),
      scale: parseNumber(entry.scale),
      prop_type: entry.prop_type != null ? String(entry.prop_type) : null,
      last_owner: entry.last_owner != null ? String(entry.last_owner) : null,
    }
  })

  console.log('[getServerSideProps] Landmarks fetched:', landmarksResult.data?.length || 0)
  const landmarkPropIds = (landmarksResult.data || [])
    .map((lm: any) => Number(lm.prop_id))
    .filter((id: any): id is number => Number.isFinite(id))
  let landmarkMeta = new Map<number, { name: string | null; last_owner: string | null; rename_count: number | null }>()
  if (landmarkPropIds.length) {
    const { data: propsData } = await supa
      .from('bloblets')
      .select('prop_id,name,last_owner,rename_count')
      .eq('entity_type', 'landmark')
      .in('prop_id', landmarkPropIds)
    for (const row of propsData || []) {
      const idNum = Number(row.prop_id)
      const nameVal = row.name != null ? String(row.name) : null
      const ownerVal = row.last_owner ? String(row.last_owner) : null
      landmarkMeta.set(idNum, { name: nameVal, last_owner: ownerVal, rename_count: Number(row.rename_count ?? null) })
    }
  }

  const landmarks: HomePageProps['bloblets'] = (landmarksResult.data || []).map((lm: any) => {
    const address = String(lm.address || '')
    const meta = lm.prop_id != null ? landmarkMeta.get(Number(lm.prop_id)) : undefined
    const displayName = meta?.name ?? (lm.name != null ? String(lm.name) : null)
    const aliveUrlRaw = typeof lm?.avatar_alive_url_256 === 'string' ? lm.avatar_alive_url_256.trim() : ''
    const aliveUrl256 = aliveUrlRaw.length ? aliveUrlRaw : null
    return {
      address,
      address_cased: address,
      is_alive: true,
      tier: 'middle',
      avatar_alive_url_256: aliveUrl256 ?? null,
      is_custom: false,
      name: displayName,
      rank: null,
      percent: null,
      balance: 0,
      reward_balance: null,
      size_multiplier: parseNumber(lm.size_multiplier),
      anchor_x: parseNumber(lm.anchor_x),
      anchor_y: parseNumber(lm.anchor_y),
      entity_type: lm.entity_type ? String(lm.entity_type) : 'landmark',
      z: parseNumber(lm.z),
      scale: parseNumber(lm.scale),
      prop_type: lm.prop_type != null ? String(lm.prop_type) : null,
      prop_id: lm.prop_id != null ? Number(lm.prop_id) : null,
      rename_count: meta?.rename_count != null ? Number(meta.rename_count) : Number(lm.rename_count ?? 0),
      last_owner: meta?.last_owner ?? (lm.last_owner ? String(lm.last_owner) : null),
    }
  })

  const placeholderBloblet: HomePageProps['bloblets'] = placeholderResult.data ? [{
    address: String(placeholderResult.data.address || 'placeholder_sprite'),
    address_cased: placeholderResult.data.address || null,
    is_alive: placeholderResult.data.is_alive !== false,
    tier: parseTier(placeholderResult.data.tier || 'middle'),
    avatar_alive_url_256: (placeholderResult.data.avatar_alive_url_256 && placeholderResult.data.avatar_alive_url_256.trim().length
      ? placeholderResult.data.avatar_alive_url_256
      : null),
    is_custom: false,
    name: 'Placeholder',
    rank: 0,
    percent: 0,
    balance: 0,
    reward_balance: null,
    size_multiplier: parseNumber(placeholderResult.data.size_multiplier),
    anchor_x: null,
    anchor_y: null,
    entity_type: 'bloblet',
    z: null,
    scale: null,
    prop_type: null,
    last_owner: null,
  }] : []

  const bloblets: HomePageProps['bloblets'] = [...blobletsTop, ...blobletsShame, ...landmarks, ...placeholderBloblet]
  console.log('[getServerSideProps] Total bloblets:', bloblets.length, '(landmarks:', landmarks.length, ')')

  let rewardTopUpMin = Number(economy.rewardTopUp.minRp || 0)
  let rewardTopUpMax = Number(economy.rewardTopUp.maxRp || rewardTopUpMin)
  try {
    const { data: rewardTopupConfig } = await supa
      .from('product_configs')
      .select('params')
      .eq('product_id', 'reward_topup')
      .maybeSingle()
    if (rewardTopupConfig && (rewardTopupConfig as any).params) {
      const params = (rewardTopupConfig as any).params
      if (Number.isFinite(Number(params.min))) {
        rewardTopUpMin = Number(params.min)
      }
      if (Number.isFinite(Number(params.max))) {
        rewardTopUpMax = Number(params.max)
      }
    }
  } catch (error) {
    console.warn('[getServerSideProps] Failed to load reward_topup config', error)
  }
  if (!Number.isFinite(rewardTopUpMin) || rewardTopUpMin <= 0) {
    rewardTopUpMin = Math.max(1, Number(economy.rewardTopUp.minRp || 1))
  }
  if (!Number.isFinite(rewardTopUpMax) || rewardTopUpMax <= 0) {
    rewardTopUpMax = Math.max(rewardTopUpMin, Number(economy.rewardTopUp.maxRp || rewardTopUpMin))
  }
  rewardTopUpMax = Math.max(rewardTopUpMax, rewardTopUpMin)

  return {
    bloblets,
    mint,
    decimals,
    treasuryWallet,
    treasuryAta,
    loadouts: maskedLoadouts as unknown as HomePageProps['loadouts'],
    pvpItems,
    battles,
    rewardTopUpMin,
    rewardTopUpMax,
  }
}
