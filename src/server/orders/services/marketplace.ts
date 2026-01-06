import type { PoolClient } from 'pg'
import { serializeOrder } from '@/src/server/orders/services/serialization'
import {
  InsufficientRewardPointsError,
  debitRewardPoints,
  withLedgerTransaction,
} from '@/src/server/orders/services/ledgerSpend'
import type { LedgerDebitResult } from '@/src/server/orders/services/ledgerSpend'

type RenameResult = {
  order: any
  ledger: LedgerDebitResult
}

type RenameParams = {
  addressCanonical: string
  addressCased: string
  chainKind: string
  name: string
  priceRp: number
  paramsJson: any
  source?: string | null
}

type PropNameParams = {
  addressCanonical: string
  addressCased: string
  chainKind: string
  propId: number
  newName: string
  expectedCount: number
  basePriceRp: number
  stepPriceRp: number
  premiumPct: number
  priceRp: number
  paramsJson: any
  source?: string | null
}

type AvatarOrderParams = {
  addressCanonical: string
  addressCased: string
  chainKind: string
  priceRp: number
  paramsJson: any
  source?: string | null
}

const EPSILON = 1e-6

function ensureCanonicalAddress(address: string): string {
  const trimmed = String(address || '').trim()
  if (!trimmed) {
    throw new Error('address required')
  }
  return trimmed
}

function ensurePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive`)
  }
  return value
}

function jsonParam(value: any): string {
  return JSON.stringify(value ?? {})
}

async function ensureBlobletRow(client: PoolClient, params: { addressCanonical: string; addressCased: string; chainKind: string; nowIso: string }) {
  const { addressCanonical, addressCased, chainKind, nowIso } = params
  await client.query(
    `insert into public.bloblets (address, address_cased, address_canonical, chain_kind, is_alive, last_seen_at)
     values ($1, $2, $3, $4, true, $5)
     on conflict (address)
       do update set address_cased = excluded.address_cased`,
    [addressCanonical, addressCased, addressCanonical, chainKind, nowIso],
  )
}

export async function completeBlobletRename(params: RenameParams): Promise<RenameResult> {
  const cleanName = params.name.trim().slice(0, 32)
  ensurePositive(params.priceRp, 'Rename price')
  if (!cleanName) {
    throw new Error('Invalid name')
  }

  const addressCanonical = ensureCanonicalAddress(params.addressCanonical)
  return withLedgerTransaction(async (client, now) => {
    const nowIso = now.toISOString()
    const orderInsert = await client.query(
      `insert into public.orders (
         address,
         address_canonical,
         address_cased,
         chain_kind,
         type,
         params,
         quote_amount,
         status,
         confirmed_at,
         applied_at
       )
       values ($1, $2, $3, $4, 'rename', $5::jsonb, $6, 'applied', $7, $7)
       returning *`,
      [
        params.addressCased,
        addressCanonical,
        params.addressCased,
        params.chainKind,
        jsonParam(params.paramsJson),
        params.priceRp,
        nowIso,
      ],
    )
    const orderRow = orderInsert.rows[0]
    if (!orderRow) throw new Error('Failed to create rename order')

    const ledger = await debitRewardPoints({
      client,
      addressCanonical,
      addressCased: params.addressCased,
      amountRp: params.priceRp,
      reason: 'rename_debit',
      metadata: {
        orderId: orderRow.id,
        name: cleanName,
        source: params.source || undefined,
      },
      now,
    })

    await ensureBlobletRow(client, {
      addressCanonical,
      addressCased: params.addressCased,
      chainKind: params.chainKind,
      nowIso,
    })

    await client.query(
      `update public.bloblets
          set name = $1,
              last_seen_at = $2
        where address_canonical = $3
          and chain_kind = $4`,
      [cleanName, nowIso, addressCanonical, params.chainKind],
    )

    return {
      order: orderRow,
      ledger,
    }
  })
}

export async function completeLandmarkRename(params: PropNameParams): Promise<RenameResult> {
  ensurePositive(params.priceRp, 'Landmark rename price')
  const addressCanonical = ensureCanonicalAddress(params.addressCanonical)
  const cleanName = params.newName.trim().slice(0, 32)
  if (!cleanName) throw new Error('Invalid name')

  return withLedgerTransaction(async (client, now) => {
    const nowIso = now.toISOString()
    const landmarkRes = await client.query(
      `select prop_id, rename_count, landmark_price_rp
         from public.bloblets
        where chain_kind = $1
          and entity_type = 'landmark'
          and prop_id = $2
        for update`,
      [params.chainKind, params.propId],
    )
    const landmarkRow = landmarkRes.rows[0]
    if (!landmarkRow) {
      throw new Error('prop_not_found')
    }
    const currentCount = Number(landmarkRow.rename_count || 0)
    if (currentCount !== params.expectedCount) {
      throw new Error('price_changed')
    }
    const lastPrice = Math.max(0, Number(landmarkRow.landmark_price_rp || 0))
    const stepPrice = params.basePriceRp + params.stepPriceRp * currentCount
    const premiumPct = Number.isFinite(params.premiumPct) ? Math.max(0, params.premiumPct) : 0
    const premiumFloor = lastPrice > 0 ? Math.ceil(lastPrice * (1 + premiumPct)) : params.basePriceRp
    const expectedPrice = Math.max(stepPrice, premiumFloor)
    if (Math.abs(expectedPrice - params.priceRp) > EPSILON) {
      throw new Error('price_mismatch')
    }

    const orderInsert = await client.query(
      `insert into public.orders (
         address,
         address_canonical,
         address_cased,
         chain_kind,
         type,
         params,
         quote_amount,
         status,
         confirmed_at,
         applied_at
       )
       values ($1, $2, $3, $4, 'prop_name', $5::jsonb, $6, 'applied', $7, $7)
       returning *`,
      [
        params.addressCased,
        addressCanonical,
        params.addressCased,
        params.chainKind,
        jsonParam(params.paramsJson),
        params.priceRp,
        nowIso,
      ],
    )
    const orderRow = orderInsert.rows[0]
    if (!orderRow) throw new Error('Failed to create landmark rename order')

    const ledger = await debitRewardPoints({
      client,
      addressCanonical,
      addressCased: params.addressCased,
      amountRp: params.priceRp,
      reason: 'landmark_debit',
      metadata: {
        orderId: orderRow.id,
        propId: params.propId,
        name: cleanName,
        source: params.source || undefined,
      },
      now,
    })

    await client.query(
      `update public.bloblets
          set name = $1,
              rename_count = coalesce(rename_count, 0) + 1,
              name_updated_at = $2,
              last_owner = $3,
              landmark_price_rp = $4
        where chain_kind = $5
          and entity_type = 'landmark'
          and prop_id = $6`,
      [cleanName, nowIso, params.addressCased, params.priceRp, params.chainKind, params.propId],
    )

    await client.query(
      `insert into public.asset_name_history (prop_id, address, name, price_paid, applied_at)
       values ($1, $2, $3, $4, $5)`,
      [params.propId, params.addressCased, cleanName, params.priceRp, nowIso],
    )

    return {
      order: orderRow,
      ledger,
    }
  })
}

export async function createAvatarOrder(params: AvatarOrderParams): Promise<RenameResult> {
  ensurePositive(params.priceRp, 'Custom avatar price')
  const addressCanonical = ensureCanonicalAddress(params.addressCanonical)
  return withLedgerTransaction(async (client, now) => {
    const nowIso = now.toISOString()
    const orderInsert = await client.query(
      `insert into public.orders (
         address,
         address_canonical,
         address_cased,
         chain_kind,
         type,
         params,
         quote_amount,
         status,
         confirmed_at
       )
       values ($1, $2, $3, $4, 'avatar_custom', $5::jsonb, $6, 'queued', $7)
       returning *`,
      [
        params.addressCased,
        addressCanonical,
        params.addressCased,
        params.chainKind,
        jsonParam(params.paramsJson),
        params.priceRp,
        nowIso,
      ],
    )
    const orderRow = orderInsert.rows[0]
    if (!orderRow) throw new Error('Failed to create avatar order')

    // Note: RP debit moved to finalize endpoint - users only pay when they apply the preview
    return {
      order: orderRow,
      ledger: { balanceBefore: 0, balanceAfter: 0 }, // Placeholder - actual debit happens at finalize
    }
  })
}

export function serializeInstantOrder(orderRow: any): any {
  return serializeOrder(orderRow, {
    status: orderRow.status,
    confirmedAt: orderRow.confirmed_at,
    appliedAt: orderRow.applied_at,
    txHash: orderRow.tx_hash,
  })
}

export { InsufficientRewardPointsError }
