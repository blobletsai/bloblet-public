import type { PoolClient } from 'pg'

import { normalizeChainAddress } from '@/src/server/address'
import { resolveChainKind } from '@/src/server/chains'
import { withPgClient } from '@/src/server/pg'
import {
  REWARD_LEDGER_ENABLED,
  applyLedgerEntries,
  careUpkeepPoints,
  fetchRewardBalances,
  roundPoints,
  type RewardLedgerEntryInput,
} from '@/src/server/rewards'
import {
  boosterLevel,
  buildChargeStatus,
  chargeCostPoints,
  chargeCooldownMs,
  computeNextChargeState,
  fastForwardDayKey,
  getFastForwardConfig,
  parseChargeState,
  resolveFastForwardCounters,
  isChargeReady,
  type ChargeState,
  type ChargeStatus,
} from '@/src/shared/care'

import { CareError } from './careErrors'
import { maybeGrantCareDrop, type CareDropAttempt } from './careDrops'
import { getCareDropConfig } from './careConfig'
import { getGearInventoryForAddress, recordGearDrop } from './gearService'

const CARE_DEBIT_REASON = 'care_debit'
const SWAP_CREDIT_REASON = 'swap_credit'

export type CareChargeOptions = {
  chainKind?: string
  now?: Date
  /**
   * Overrides the default charge cost in points.
   * Useful when the payment has already been settled externally.
   */
  chargeCostOverride?: number
  /**
   * Skip debiting Reward Points (for legacy order flows).
   */
  skipDebit?: boolean
  /**
   * Consume a specific confirmed order (defaults to latest confirmed order).
   */
  orderId?: number
}

export type CareChargeResult = {
  status: ChargeStatus
  chargeCost: number
  loot: CareDropAttempt[]
  careState: ChargeState
  boosterLevel: number
  consumedOrder: { id: number; txHash: string | null } | null
}

export type CareFastForwardOptions = {
  chainKind?: string
  now?: Date
  orderId?: number
  maxAttempts?: number
  chargeCostOverride?: number
}

export type CareFastForwardAttempt = CareDropAttempt & {
  dropAccBefore: number
  dropAccAfter: number
  attemptedAt: string
}

export type CareFastForwardResult = {
  status: ChargeStatus
  chargeCost: number
  totalChargeCost: number
  attemptsUsed: number
  loot: CareDropAttempt[]
  attempts: CareFastForwardAttempt[]
  careState: ChargeState
  boosterLevel: number
  consumedOrder: { id: number; txHash: string | null } | null
  debtUntil: string | null
  burstsRemaining: number
  stopReason: 'drop_hit' | 'attempts_exhausted'
  durationMs: number
}

type InternalChargeParams = {
  client: PoolClient
  addressCanonical: string
  chainKind: string
  now: Date
  chargeCost: number
  skipDebit: boolean
  order: ConfirmedChargeOrder | null
}

type InternalFastForwardParams = {
  client: PoolClient
  addressCanonical: string
  chainKind: string
  now: Date
  chargeCost: number
  maxAttempts: number
  order: ConfirmedChargeOrder | null
}

type ConfirmedChargeOrder = {
  id: number
  quoteAmount: number
  txHash: string | null
}

async function selectConfirmedChargeOrder(
  client: PoolClient,
  addressCanonical: string,
  chainKind: string,
  orderId?: number,
): Promise<ConfirmedChargeOrder | null> {
  const params: any[] = [addressCanonical, chainKind]
  let idx = 3
  let where = ''
  if (orderId != null) {
    params.push(orderId)
    where = ` and id = $${idx++}`
  }
  const query = `
    select id, quote_amount, tx_hash
      from public.orders
     where address_canonical = $1
       and chain_kind = $2
       and type = 'care'
       and status = 'confirmed'
       and applied_at is null
      ${where}
     order by coalesce(confirmed_at, created_at) desc, id desc
     limit 1
     for update`
  const res = await client.query(query, params)
  const row = res.rows[0]
  if (!row) {
    return null
  }
  return {
    id: Number(row.id),
    quoteAmount: roundPoints(Number(row.quote_amount ?? 0)),
    txHash: row.tx_hash ? String(row.tx_hash) : null,
  }
}

function nextUtcDayStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString()
}

async function insertCareTelemetryRow(
  client: PoolClient,
  params: {
    addressCanonical: string
    attempt: CareDropAttempt
    prevAcc: number
    dropConfig: ReturnType<typeof getCareDropConfig>
    timestampIso: string
    fastForward?: boolean
  },
) {
  const pBase =
    params.dropConfig.baseProbability > 0 && params.dropConfig.baseProbability <= 1
      ? params.dropConfig.baseProbability
      : 0.2
  const prevAcc = Math.max(0, Math.min(1, Number(params.prevAcc || 0)))
  const eff = params.dropConfig.accumulatorEnabled ? Math.min(1, pBase + prevAcc) : pBase
  const shieldFirstBias = params.dropConfig.shieldFirstBias
  try {
    await client.query(
      `insert into public.telemetry_care_loot (
         address_canonical, slot, item_id, rarity,
         probability, roll, awarded, created_at,
         acc_before, acc_after, eff_probability, base_probability, law, slot_bias,
         rng_passed, fallback_type,
         loadout_weapon_item_id, loadout_shield_item_id, item_slug,
         fast_forward
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,
         $9,$10,$11,$12,$13,$14,
         $15,$16,
         $17,$18,$19,$20
       )`,
      [
        params.addressCanonical,
        params.attempt.slot,
        params.attempt.item?.id ?? null,
        params.attempt.item?.rarity ?? null,
        params.attempt.probability ?? pBase,
        params.attempt.roll ?? null,
        Boolean(params.attempt.item),
        params.timestampIso,
        prevAcc,
        params.attempt.dropAccNext ?? null,
        eff,
        pBase,
        params.dropConfig.law,
        shieldFirstBias,
        params.attempt.rngPassed === true,
        params.attempt.fallbackType ?? null,
        params.attempt.loadout?.weapon_item_id ?? null,
        params.attempt.loadout?.shield_item_id ?? null,
        params.attempt.item?.slug ?? null,
        params.fastForward === true,
      ],
    )
  } catch {}
}

async function performCharge({
  client,
  addressCanonical,
  chainKind,
  now,
  chargeCost,
  skipDebit,
  order,
}: InternalChargeParams): Promise<CareChargeResult> {
  const ffConfig = getFastForwardConfig()
  const nowIso = now.toISOString()

  const blobRes = await client.query(
    `select care_state
       from public.bloblets
      where address_canonical = $1
        and chain_kind = $2
      for update`,
    [addressCanonical, chainKind],
  )
  if (!blobRes.rows.length) {
    throw new CareError(404, 'bloblet_not_found')
  }

  const currentState = parseChargeState(blobRes.rows[0]?.care_state)
  const currentStatus = buildChargeStatus(currentState, now)
  if (!isChargeReady(currentState, now)) {
    throw new CareError(400, 'charge_cooldown', { cooldownUntil: currentStatus.cooldownEndsAt })
  }

  let balanceBefore = 0
  if (REWARD_LEDGER_ENABLED) {
    const balances = await fetchRewardBalances(client, [addressCanonical], { lockRows: true })
    const snapshot = balances.get(addressCanonical)
    balanceBefore = roundPoints(snapshot?.currentBalance ?? 0)
    if (!skipDebit && !order && balanceBefore < chargeCost) {
      throw new CareError(403, 'payment_required', {
        required: chargeCost,
        balance: balanceBefore,
        reason: 'insufficient_balance',
      })
    }
  }

  const gear = await getGearInventoryForAddress(addressCanonical, { client })
  const stashCount =
    typeof (gear as any)?.stashCount === 'number'
      ? Number((gear as any).stashCount)
      : (gear as any)?.stash?.length ?? 0
  const isNewcomer = !gear.equipped.weapon && !gear.equipped.shield && stashCount === 0

  // Energize Drop Law — Deterministic Accumulator
  const dropConfig = getCareDropConfig()
  const accumEnabled = dropConfig.accumulatorEnabled
  const prevAcc = accumEnabled && typeof (currentState as any).dropAcc === 'number' ? Math.max(0, Math.min(1, Number((currentState as any).dropAcc))) : 0
  const attempt = await maybeGrantCareDrop(client, addressCanonical, 'charge', prevAcc)

  const nextState = computeNextChargeState(now, currentState)
  ;(nextState as any).dropAcc = accumEnabled ? attempt.dropAccNext : 0

  await client.query(
    `update public.bloblets
        set care_state = $2::jsonb,
            last_seen_at = $3
      where address_canonical = $1
        and chain_kind = $4`,
    [addressCanonical, JSON.stringify(nextState), nowIso, chainKind],
  )

  const loot: CareDropAttempt[] = [attempt]
  await insertCareTelemetryRow(client, {
    addressCanonical,
    attempt,
    prevAcc,
    dropConfig,
    timestampIso: nowIso,
    fastForward: false,
  })
  if (attempt.item) {
    await recordGearDrop(client, {
      addressCanonical,
      drop: attempt,
      slot: attempt.slot,
      source: 'care_drop',
      action: 'charge',
      now,
    })
  }

  if (REWARD_LEDGER_ENABLED) {
    const ledgerEntries: RewardLedgerEntryInput[] = []
    if (order && order.quoteAmount > 0) {
      ledgerEntries.push({
        address: addressCanonical,
        delta: order.quoteAmount,
        reason: SWAP_CREDIT_REASON,
        metadata: {
          orderId: order.id,
          ...(order.txHash ? { txHash: order.txHash } : {}),
          source: 'care_order',
        },
      })
    }
    if (!skipDebit && chargeCost > 0) {
      ledgerEntries.push({
        address: addressCanonical,
        delta: -chargeCost,
        reason: CARE_DEBIT_REASON,
        metadata: order ? { orderId: order.id, txHash: order.txHash } : undefined,
      })
    }
    const upkeep = careUpkeepPoints(1)
    if (upkeep > 0) {
      ledgerEntries.push({
        address: addressCanonical,
        delta: upkeep,
        reason: 'care_upkeep',
        metadata: {
          action: 'charge',
          ...(order ? { orderId: order.id, txHash: order.txHash ?? undefined } : {}),
        },
      })
    }
    if (ledgerEntries.length) {
      await applyLedgerEntries(client, ledgerEntries, { now, updateTokenHolders: true })
    }
  }

  if (order) {
    const updateRes = await client.query(
      `update public.orders
          set status = 'applied',
              applied_at = $2,
              confirmed_at = coalesce(confirmed_at, $2)
        where id = $1
          and status = 'confirmed'
        returning id`,
      [order.id, nowIso],
    )
    if (!updateRes.rowCount) {
      throw new CareError(409, 'order_conflict')
    }
  }

  const status = buildChargeStatus(nextState, now, {
    fastForward: { enabled: ffConfig.enabled, burstsPerDay: ffConfig.burstsPerDay, isNewcomer },
  })

  return {
    status,
    chargeCost,
    loot,
    careState: nextState,
    boosterLevel: boosterLevel(nextState, now),
    consumedOrder: order ? { id: order.id, txHash: order.txHash } : null,
  }
}

async function performFastForward({
  client,
  addressCanonical,
  chainKind,
  now,
  chargeCost,
  maxAttempts,
  order,
}: InternalFastForwardParams): Promise<CareFastForwardResult> {
  const ffConfig = getFastForwardConfig()
  if (!ffConfig.enabled) {
    throw new CareError(403, 'fast_forward_disabled')
  }
  const nowIso = now.toISOString()
  const blobRes = await client.query(
    `select care_state
       from public.bloblets
      where address_canonical = $1
        and chain_kind = $2
      for update`,
    [addressCanonical, chainKind],
  )
  if (!blobRes.rows.length) {
    throw new CareError(404, 'bloblet_not_found')
  }

  const currentState = parseChargeState(blobRes.rows[0]?.care_state)
  const currentStatus = buildChargeStatus(currentState, now, {
    fastForward: { enabled: ffConfig.enabled, burstsPerDay: ffConfig.burstsPerDay },
  })
  const debtUntilMs = currentStatus.fastForwardDebtUntil ? Date.parse(currentStatus.fastForwardDebtUntil) : NaN
  if (Number.isFinite(debtUntilMs) && debtUntilMs > now.getTime()) {
    throw new CareError(400, 'charge_cooldown', { cooldownUntil: currentStatus.fastForwardDebtUntil })
  }

  const counters = resolveFastForwardCounters(currentState, now, ffConfig.burstsPerDay)
  if (ffConfig.burstsPerDay > 0 && counters.burstsRemaining <= 0) {
    throw new CareError(429, 'daily_cap_reached', {
      resetAt: nextUtcDayStart(now),
      burstsRemaining: 0,
    })
  }

  const gear = await getGearInventoryForAddress(addressCanonical, { client })
  const stashCount = typeof (gear as any)?.stashCount === 'number' ? Number((gear as any).stashCount) : (gear as any)?.stash?.length ?? 0
  const isNewcomer = !gear.equipped.weapon && !gear.equipped.shield && stashCount === 0
  if (!isNewcomer) {
    throw new CareError(403, 'ineligible_newcomer')
  }

  const plannedAttempts = Math.max(1, Math.min(ffConfig.burstSize, Math.max(1, Math.floor(maxAttempts || ffConfig.burstSize))))
  const orderCredit = order?.quoteAmount ? roundPoints(order.quoteAmount) : 0
  const maxCost = roundPoints(chargeCost * plannedAttempts)
  let balanceBefore = 0

  if (REWARD_LEDGER_ENABLED) {
    const balances = await fetchRewardBalances(client, [addressCanonical], { lockRows: true })
    const snapshot = balances.get(addressCanonical)
    balanceBefore = roundPoints(snapshot?.currentBalance ?? 0)
    const available = roundPoints(balanceBefore + orderCredit)
    if (available < maxCost) {
      throw new CareError(403, 'payment_required', {
        required: maxCost,
        balance: available,
        reason: 'insufficient_balance',
      })
    }
  }

  const dropConfig = getCareDropConfig()
  const cooldownMs = chargeCooldownMs()
  const accumEnabled = dropConfig.accumulatorEnabled
  const initialAcc =
    accumEnabled && typeof currentState.dropAcc === 'number'
      ? Math.max(0, Math.min(1, Number(currentState.dropAcc)))
      : 0
  const cooldownUntilMs = currentStatus.cooldownEndsAt ? Date.parse(currentStatus.cooldownEndsAt) : NaN
  const baseStartMs =
    Number.isFinite(cooldownUntilMs) && cooldownUntilMs > now.getTime() ? cooldownUntilMs : now.getTime()

  const attempts: CareFastForwardAttempt[] = []
  const loot: CareDropAttempt[] = []
  let stopReason: CareFastForwardResult['stopReason'] = 'attempts_exhausted'
  const burstStartedAtMs = Date.now()
  let prevAcc = initialAcc

  for (let i = 0; i < plannedAttempts; i++) {
    const attemptStarted = new Date()
    const attempt = await maybeGrantCareDrop(client, addressCanonical, 'fast_forward', prevAcc)
    const dropAccAfter = accumEnabled ? attempt.dropAccNext ?? 0 : 0
    attempts.push({
      ...attempt,
      dropAccBefore: prevAcc,
      dropAccAfter,
      attemptedAt: attemptStarted.toISOString(),
    })
    loot.push(attempt)
    await insertCareTelemetryRow(client, {
      addressCanonical,
      attempt,
      prevAcc,
      dropConfig,
      timestampIso: attemptStarted.toISOString(),
      fastForward: true,
    })
    if (attempt.item) {
      stopReason = 'drop_hit'
      await recordGearDrop(client, {
        addressCanonical,
        drop: attempt,
        slot: attempt.slot,
        source: 'care_drop',
        action: 'fast_forward',
        now,
      })
      prevAcc = dropAccAfter
      break
    }
    prevAcc = dropAccAfter
  }

  const attemptsUsed = attempts.length
  const durationMs = Math.max(0, Date.now() - burstStartedAtMs)
  const naturalReadyMs = baseStartMs + attemptsUsed * cooldownMs
  const debtMs = Math.max(0, attemptsUsed * cooldownMs - durationMs)
  const nextDebtUntilMs = Math.max(naturalReadyMs, now.getTime() + debtMs)
  const debtUntilIso = new Date(nextDebtUntilMs).toISOString()
  const lastVirtualMs = baseStartMs + Math.max(0, attemptsUsed - 1) * cooldownMs
  const burstDay = counters.burstDay || fastForwardDayKey(now)
  const nextState = computeNextChargeState(new Date(lastVirtualMs), currentState)
  nextState.dropAcc = accumEnabled ? prevAcc : 0
  nextState.cooldownEndsAt = new Date(Math.max(naturalReadyMs, nextDebtUntilMs)).toISOString()
  nextState.fastForwardDebtUntil = debtUntilIso
  nextState.fastForwardBurstDay = burstDay
  nextState.fastForwardBurstsUsed = counters.burstsUsed + 1
  nextState.fastForwardLastRunAt = nowIso

  await client.query(
    `update public.bloblets
        set care_state = $2::jsonb,
            last_seen_at = $3
      where address_canonical = $1
        and chain_kind = $4`,
    [addressCanonical, JSON.stringify(nextState), nowIso, chainKind],
  )

  if (REWARD_LEDGER_ENABLED) {
    const ledgerEntries: RewardLedgerEntryInput[] = []
    if (order && order.quoteAmount > 0) {
      ledgerEntries.push({
        address: addressCanonical,
        delta: order.quoteAmount,
        reason: SWAP_CREDIT_REASON,
        metadata: {
          orderId: order.id,
          ...(order.txHash ? { txHash: order.txHash } : {}),
          source: 'care_order',
        },
      })
    }
    for (let i = 0; i < attemptsUsed; i++) {
      if (chargeCost > 0) {
        ledgerEntries.push({
          address: addressCanonical,
          delta: -chargeCost,
          reason: CARE_DEBIT_REASON,
          metadata: order ? { orderId: order.id, txHash: order.txHash } : undefined,
        })
      }
      const upkeep = careUpkeepPoints(1)
      if (upkeep > 0) {
        ledgerEntries.push({
          address: addressCanonical,
          delta: upkeep,
          reason: 'care_upkeep',
          metadata: {
            action: 'fast_forward',
            attempt: i + 1,
            ...(order ? { orderId: order.id, txHash: order.txHash ?? undefined } : {}),
          },
        })
      }
    }
    if (ledgerEntries.length) {
      await applyLedgerEntries(client, ledgerEntries, { now, updateTokenHolders: true })
    }
  }

  if (order) {
    const updateRes = await client.query(
      `update public.orders
          set status = 'applied',
              applied_at = $2,
              confirmed_at = coalesce(confirmed_at, $2)
        where id = $1
          and status = 'confirmed'
        returning id`,
      [order.id, nowIso],
    )
    if (!updateRes.rowCount) {
      throw new CareError(409, 'order_conflict')
    }
  }

  const burstsRemaining = Math.max(0, ffConfig.burstsPerDay - (counters.burstsUsed + 1))
  const status = buildChargeStatus(nextState, now, {
    fastForward: { enabled: ffConfig.enabled, burstsPerDay: ffConfig.burstsPerDay, isNewcomer },
  })
  const totalChargeCost = roundPoints(chargeCost * attemptsUsed)

  try {
    await client.query(
      `insert into public.events (type, severity, payload)
         values ($1, $2, $3::jsonb)`,
      [
        'care_fast_forward',
        0,
        JSON.stringify({
          address: addressCanonical,
          attempts_used: attemptsUsed,
          attempts_detail: attempts.map((a) => ({
            slot: a.slot,
            awarded: !!a.item,
            rngPassed: a.rngPassed === true,
            dropAccBefore: a.dropAccBefore,
            dropAccAfter: a.dropAccAfter,
          })),
          balance_before: balanceBefore,
          debt_ms: Math.max(0, nextDebtUntilMs - now.getTime()),
          bursts_remaining: burstsRemaining,
          stop_reason: stopReason,
          duration_ms: durationMs,
          payment_mode: order ? 'care_order' : 'ledger',
          total_cost: totalChargeCost,
        }),
      ],
    )
  } catch {}

  return {
    status,
    chargeCost,
    totalChargeCost,
    attemptsUsed,
    loot,
    attempts,
    careState: nextState,
    boosterLevel: boosterLevel(nextState, now),
    consumedOrder: order ? { id: order.id, txHash: order.txHash } : null,
    debtUntil: debtUntilIso,
    burstsRemaining,
    stopReason,
    durationMs,
  }
}

async function runChargeTransaction<T>(
  client: PoolClient,
  fn: () => Promise<T>,
  options: { useExistingTransaction?: boolean } = {},
): Promise<T> {
  if (options.useExistingTransaction) {
    return fn()
  }
  await client.query('BEGIN')
  try {
    const result = await fn()
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

export async function chargeCare(
  address: string,
  options: CareChargeOptions = {},
): Promise<CareChargeResult> {
  const chainKind = options.chainKind || resolveChainKind()
  const now = options.now || new Date()
  const skipDebit = options.skipDebit === true
  let addressCanonical: string
  try {
    addressCanonical = normalizeChainAddress(address, chainKind)
  } catch {
    addressCanonical = ''
  }
  if (!addressCanonical) {
    throw new CareError(400, 'address_required')
  }

  return withPgClient(async (client) =>
    runChargeTransaction(client, async () => {
      const resolvedOrder = await selectConfirmedChargeOrder(
        client,
        addressCanonical,
        chainKind,
        options.orderId,
      )
      if (!resolvedOrder && options.orderId != null) {
        throw new CareError(404, 'order_missing')
      }
      const effectiveChargeCost =
        options.chargeCostOverride != null
          ? options.chargeCostOverride
          : resolvedOrder
          ? resolvedOrder.quoteAmount || chargeCostPoints()
          : chargeCostPoints()
      return performCharge({
        client,
        addressCanonical,
        chainKind,
        now,
        chargeCost: roundPoints(effectiveChargeCost),
        skipDebit,
        order: resolvedOrder,
      })
    }),
  )
}

export async function fastForwardCare(
  address: string,
  options: CareFastForwardOptions = {},
): Promise<CareFastForwardResult> {
  const chainKind = options.chainKind || resolveChainKind()
  const now = options.now || new Date()
  const ffConfig = getFastForwardConfig()
  if (!ffConfig.enabled) {
    throw new CareError(403, 'fast_forward_disabled')
  }
  let addressCanonical: string
  try {
    addressCanonical = normalizeChainAddress(address, chainKind)
  } catch {
    addressCanonical = ''
  }
  if (!addressCanonical) {
    throw new CareError(400, 'address_required')
  }

  return withPgClient(async (client) =>
    runChargeTransaction(client, async () => {
      const resolvedOrder = await selectConfirmedChargeOrder(
        client,
        addressCanonical,
        chainKind,
        options.orderId,
      )
      if (!resolvedOrder && options.orderId != null) {
        throw new CareError(404, 'order_missing')
      }
      const effectiveChargeCost =
        options.chargeCostOverride != null
          ? options.chargeCostOverride
          : resolvedOrder
          ? resolvedOrder.quoteAmount || chargeCostPoints()
          : chargeCostPoints()
      const plannedAttempts = options.maxAttempts != null ? options.maxAttempts : ffConfig.burstSize
      return performFastForward({
        client,
        addressCanonical,
        chainKind,
        now,
        chargeCost: roundPoints(effectiveChargeCost),
        maxAttempts: plannedAttempts,
        order: resolvedOrder,
      })
    }),
  )
}

export async function chargeCareWithClient(
  client: PoolClient,
  address: string,
  chainKind: string,
  now: Date,
  options: { chargeCost?: number; skipDebit?: boolean; orderId?: number; useExistingTransaction?: boolean } = {},
): Promise<CareChargeResult> {
  let addressCanonical: string
  try {
    addressCanonical = normalizeChainAddress(address, chainKind)
  } catch {
    addressCanonical = ''
  }
  if (!addressCanonical) {
    throw new CareError(400, 'address_required')
  }
  const resolvedOrder = await selectConfirmedChargeOrder(
    client,
    addressCanonical,
    chainKind,
    options.orderId,
  )
  if (!resolvedOrder && options.orderId != null) {
    throw new CareError(404, 'order_missing')
  }
  const effectiveChargeCost =
    options.chargeCost != null
      ? options.chargeCost
      : resolvedOrder
      ? resolvedOrder.quoteAmount || chargeCostPoints()
      : chargeCostPoints()
  return runChargeTransaction(
    client,
    () =>
      performCharge({
        client,
        addressCanonical,
        chainKind,
        now,
        chargeCost: roundPoints(effectiveChargeCost),
        skipDebit: options.skipDebit === true,
        order: resolvedOrder,
      }),
    { useExistingTransaction: options.useExistingTransaction === true },
  )
}

export async function fastForwardCareWithClient(
  client: PoolClient,
  address: string,
  chainKind: string,
  now: Date,
  options: { chargeCost?: number; orderId?: number; maxAttempts?: number; useExistingTransaction?: boolean } = {},
): Promise<CareFastForwardResult> {
  const ffConfig = getFastForwardConfig()
  if (!ffConfig.enabled) {
    throw new CareError(403, 'fast_forward_disabled')
  }
  let addressCanonical: string
  try {
    addressCanonical = normalizeChainAddress(address, chainKind)
  } catch {
    addressCanonical = ''
  }
  if (!addressCanonical) {
    throw new CareError(400, 'address_required')
  }
  const resolvedOrder = await selectConfirmedChargeOrder(
    client,
    addressCanonical,
    chainKind,
    options.orderId,
  )
  if (!resolvedOrder && options.orderId != null) {
    throw new CareError(404, 'order_missing')
  }
  const effectiveChargeCost =
    options.chargeCost != null
      ? options.chargeCost
      : resolvedOrder
      ? resolvedOrder.quoteAmount || chargeCostPoints()
      : chargeCostPoints()
  const plannedAttempts = options.maxAttempts != null ? options.maxAttempts : ffConfig.burstSize
  return runChargeTransaction(
    client,
    () =>
      performFastForward({
        client,
        addressCanonical,
        chainKind,
        now,
        chargeCost: roundPoints(effectiveChargeCost),
        maxAttempts: plannedAttempts,
        order: resolvedOrder,
      }),
    { useExistingTransaction: options.useExistingTransaction === true },
  )
}

export const __careServiceTestables = {
  performCharge,
  performFastForward,
}
