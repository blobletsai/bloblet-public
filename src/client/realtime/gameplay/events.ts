"use client"

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

import { normalizeLedgerPoints, rewardLedgerDecimals } from '@/src/shared/points'

import type {
  BattleEventPayload,
  GameplayEvent,
  GameplayState,
  LedgerEventPayload,
  OrderEventPayload,
} from './types'
import { updateGameplayState } from './store'
import { extractCanonicalAddress, mapOrderRecord } from './hydrate'

const LEDGER_DECIMALS = rewardLedgerDecimals()
const TERMINAL_ORDER_STATUSES = new Set(['applied', 'expired', 'rejected'])

function isActiveOrder(payload: OrderEventPayload): boolean {
  const status = String(payload.status || '').toLowerCase()
  return !TERMINAL_ORDER_STATUSES.has(status)
}

function reindexAddressOrder(next: GameplayState, addressCanonical: string) {
  const normalized = String(addressCanonical || '').trim()
  if (!normalized) return
  let latest: OrderEventPayload | null = null
  for (const payload of next.orders.values()) {
    if (!payload) continue
    const addr = String(payload.address || '').trim()
    if (!addr || addr !== normalized) continue
    if (!isActiveOrder(payload)) continue
    if (!latest) {
      latest = payload
      continue
    }
    const existingUpdated = Date.parse(latest.updatedAt || '') || 0
    const candidateUpdated = Date.parse(payload.updatedAt || '') || 0
    if (candidateUpdated >= existingUpdated) {
      latest = payload
    }
  }
  if (latest) next.ordersByAddress.set(normalized, latest)
  else next.ordersByAddress.delete(normalized)
}

function safeParseCareState(raw: any) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return {}
  }
}

function buildLedgerPayload(record: any): LedgerEventPayload {
  const address = extractCanonicalAddress(record)
  const deltaRaw = record.delta != null ? Number(record.delta) : null
  const balanceAfterRaw = record.balance_after != null ? Number(record.balance_after) : null
  return {
    id: Number(record.id ?? 0),
    address,
    reason: record.reason ?? null,
    deltaRaw,
    delta: deltaRaw != null ? normalizeLedgerPoints(deltaRaw, LEDGER_DECIMALS) : null,
    balanceAfterRaw,
    balanceAfter:
      balanceAfterRaw != null ? normalizeLedgerPoints(balanceAfterRaw, LEDGER_DECIMALS) : null,
    metadata: record.metadata ?? null,
    createdAt: record.created_at ? String(record.created_at) : new Date().toISOString(),
    decimals: LEDGER_DECIMALS,
  }
}

function clampBattles(next: GameplayState) {
  if (next.battles.size <= 20) return
  const trimmedEntries = Array.from(next.battles.values())
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .slice(0, 20)
  const trimmedMap = new Map<number, BattleEventPayload>()
  for (const entry of trimmedEntries) {
    trimmedMap.set(entry.id, entry)
  }
  next.battles = trimmedMap
}

export function handleOrderChange(payload: RealtimePostgresChangesPayload<any>) {
  const record = payload.new ?? payload.old ?? {}
  const canonical = extractCanonicalAddress(record)
  const event: GameplayEvent = {
    topic: 'order',
    eventType: payload.eventType,
    payload: mapOrderRecord(record),
  }

  updateGameplayState((next) => {
    if (event.eventType === 'DELETE') {
      next.orders.delete(event.payload.id)
    } else if (event.payload.id) {
      next.orders.set(event.payload.id, event.payload)
    }
    if (canonical) {
      reindexAddressOrder(next, canonical)
    }
    next.lastEvent = event
  })
}

export function handleCareChange(payload: RealtimePostgresChangesPayload<any>) {
  const record = payload.new ?? payload.old ?? {}
  const address = extractCanonicalAddress(record)
  const event: GameplayEvent = {
    topic: 'care',
    eventType: payload.eventType,
    payload: {
      address,
      chainKind: record.chain_kind ?? null,
      careState: safeParseCareState(record.care_state),
      updatedAt: record.updated_at ? String(record.updated_at) : new Date().toISOString(),
    },
  }
  updateGameplayState((next) => {
    if (!address) {
      next.lastEvent = event
      return
    }
    if (event.eventType === 'DELETE') {
      next.careByAddress.delete(address)
    } else {
      next.careByAddress.set(address, event.payload)
    }
    next.lastEvent = event
  })
}

export function handleLedgerChange(payload: RealtimePostgresChangesPayload<any>) {
  const record = payload.new ?? payload.old ?? {}
  const ledgerPayload = buildLedgerPayload(record)
  const event: GameplayEvent = {
    topic: 'ledger',
    eventType: payload.eventType,
    payload: ledgerPayload,
  }
  updateGameplayState((next) => {
    if (ledgerPayload.address) {
      next.rewardsByAddress.set(ledgerPayload.address, ledgerPayload)
    }
    next.lastEvent = event
  })
}

export function handleBattleChange(payload: RealtimePostgresChangesPayload<any>) {
  if (payload.eventType === 'DELETE') return
  const record = payload.new ?? {}
  const event: GameplayEvent = {
    topic: 'battle',
    eventType: payload.eventType,
    payload: {
      id: Number(record.id ?? 0),
      attacker: record.attacker ?? null,
      defender: record.defender ?? null,
      attackerBooster: record.attacker_booster != null ? Number(record.attacker_booster) : null,
      defenderBooster: record.defender_booster != null ? Number(record.defender_booster) : null,
      attackerBase: record.attacker_base != null ? Number(record.attacker_base) : null,
      defenderBase: record.defender_base != null ? Number(record.defender_base) : null,
      attackerTotal: record.attacker_total != null ? Number(record.attacker_total) : null,
      defenderTotal: record.defender_total != null ? Number(record.defender_total) : null,
      winner: record.winner ?? null,
      critical: record.critical === true,
      transferPoints: record.transfer_points != null ? Number(record.transfer_points) : null,
      housePoints: record.house_points != null ? Number(record.house_points) : null,
      loot: record.loot ?? null,
      createdAt: record.created_at ? String(record.created_at) : new Date().toISOString(),
    },
  }
  updateGameplayState((next) => {
    if (event.payload.id) {
      next.battles.set(event.payload.id, event.payload)
      clampBattles(next)
    }
    next.lastEvent = event
  })
}

export function handleLoadoutChange(payload: RealtimePostgresChangesPayload<any>) {
  if (payload.eventType === 'DELETE') return
  const record = payload.new ?? {}
  const address = extractCanonicalAddress(record) || (typeof record.bloblet_address === 'string' ? record.bloblet_address.trim() : '')
  if (!address) return
  const event: GameplayEvent = {
    topic: 'loadout',
    eventType: payload.eventType,
    payload: {
      address,
      weaponItemId: record.weapon_item_id != null ? Number(record.weapon_item_id) : null,
      shieldItemId: record.shield_item_id != null ? Number(record.shield_item_id) : null,
      updatedAt: record.updated_at ? String(record.updated_at) : new Date().toISOString(),
    },
  }
  updateGameplayState((next) => {
    next.loadouts.set(address, event.payload)
    next.lastEvent = event
  })
}
