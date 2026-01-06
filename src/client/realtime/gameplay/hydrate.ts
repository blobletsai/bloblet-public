"use client"

import type { OrderEventPayload } from './types'
import { getSupabaseClient } from './client'
import { resetGameplayState, updateGameplayState } from './store'
import { featuresConfig } from '@/src/config/features'

const TERMINAL_ORDER_STATUSES = new Set(['applied', 'expired', 'rejected'])

let hydratePromise: Promise<void> | null = null
let lastHydratedAt: number | null = null
let lastHydratedFor: string | null = null

export function getLastHydratedAt() {
  return lastHydratedAt
}

export function resetHydrationState() {
  hydratePromise = null
  lastHydratedAt = null
  lastHydratedFor = null
}

export function extractCanonicalAddress(record: any): string | null {
  const candidate =
    typeof record?.address_canonical === 'string'
      ? record.address_canonical
      : typeof record?.address === 'string'
      ? record.address
      : typeof record?.address_cased === 'string'
      ? record.address_cased
      : null
  return candidate ? String(candidate).trim() : null
}

export function mapOrderRecord(record: any): OrderEventPayload {
  const canonical = extractCanonicalAddress(record)
  return {
    id: Number(record?.id ?? 0),
    chainKind: record?.chain_kind ?? null,
    address: canonical,
    type: record?.type ?? null,
    status: record?.status ?? null,
    quoteAmount: record?.quote_amount != null ? Number(record.quote_amount) : null,
    txHash: record?.tx_hash ?? null,
    reason: record?.reason ?? null,
    previewAliveUrl: record?.preview_alive_url ?? null,
    expiresAt: record?.expires_at ? String(record.expires_at) : null,
    confirmedAt: record?.confirmed_at ? String(record.confirmed_at) : null,
    appliedAt: record?.applied_at ? String(record.applied_at) : null,
    createdAt: record?.created_at ? String(record.created_at) : null,
    updatedAt: record?.updated_at
      ? String(record.updated_at)
      : record?.created_at
      ? String(record.created_at)
      : new Date().toISOString(),
  }
}

export async function hydrateOpenOrders(address: string) {
  if (typeof window === 'undefined') return
  const addr = (address || '').trim()
  if (!addr) return
  const isBrowserOnline = typeof navigator === 'undefined' ? true : navigator.onLine
  if (!isBrowserOnline) {
    if (featuresConfig.realtimeDebug) {
      console.info('[realtime:gameplay] skipped hydration while offline')
    }
    return
  }
  const client = getSupabaseClient()
  if (!client) return
  if (hydratePromise) return hydratePromise
  if (lastHydratedFor && lastHydratedFor !== addr) {
    lastHydratedAt = null
  }
  if (lastHydratedAt && Date.now() - lastHydratedAt < 10_000 && lastHydratedFor === addr) return

  hydratePromise = (async () => {
    try {
      if (featuresConfig.realtimeDebug) {
        console.info('[realtime:gameplay] hydrating open orders from Supabase', { address: addr })
      }
      const terminalList = Array.from(TERMINAL_ORDER_STATUSES)
        .map((s) => `"${s}"`)
        .join(',')
      const { data, error } = await client
        .from('orders')
        .select(
          'id,chain_kind,address,address_canonical,type,status,quote_amount,tx_hash,reason,preview_alive_url,expires_at,confirmed_at,applied_at,created_at',
        )
        .eq('address_canonical', addr)
        .eq('chain_kind', 'sol')
        .not('status', 'in', `(${terminalList})`)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      updateGameplayState((next) => {
        next.orders.clear()
        next.ordersByAddress.clear()

        for (const record of data || []) {
          const payload = mapOrderRecord(record)
          if (!payload.id) continue
          next.orders.set(payload.id, payload)
          const canonicalKey = payload.address ? String(payload.address).trim() : ''
          if (!canonicalKey) continue
          const current = next.ordersByAddress.get(canonicalKey)
          if (!current) {
            next.ordersByAddress.set(canonicalKey, payload)
            continue
          }
          const currentUpdated = Date.parse(current.updatedAt || '') || 0
          const candidateUpdated = Date.parse(payload.updatedAt || '') || 0
          if (candidateUpdated >= currentUpdated) {
            next.ordersByAddress.set(canonicalKey, payload)
          }
        }
      })
      lastHydratedAt = Date.now()
      lastHydratedFor = addr
    } catch (error) {
      console.error('[realtime:gameplay] hydrate open orders failed', error)
      throw error
    } finally {
      hydratePromise = null
    }
  })()

  return hydratePromise
}

export function markConnecting() {
  updateGameplayState((next) => {
    next.connection = 'connecting'
  })
}

export function markChannelOpen() {
  updateGameplayState((next) => {
    next.connection = 'open'
  })
}

export function markRetrying() {
  updateGameplayState((next) => {
    next.connection = 'retrying'
  })
}

export function resetGameplayStateToIdle() {
  resetGameplayState()
}
