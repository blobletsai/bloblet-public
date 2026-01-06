"use client"

import { useCallback } from 'react'

import { emitClientEvent } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import { toEnergizeUiState, type RefreshReason } from './energizeState'

type Params = {
  energizeLoading: boolean
  setEnergizeLoading: (value: boolean) => void
  setEnergizeError: (value: string | null) => void
  setEnergizeAlert: (value: { message: string; until: number } | null) => void
  setEnergizeUi: (updater: (prev: any) => any) => void
  openTopUpModal: (options?: { autoEnergize?: boolean }) => void
  formatTimeLabel: (iso: string | null | undefined) => string
  refreshRewards: (options?: { silent?: boolean }) => Promise<unknown>
  refreshStatus: (reason?: RefreshReason) => Promise<void>
  myAddressCanonical: string | null
}

export function useEnergizeHandler({
  energizeLoading,
  setEnergizeLoading,
  setEnergizeError,
  setEnergizeAlert,
  setEnergizeUi,
  openTopUpModal,
  formatTimeLabel,
  refreshRewards,
  refreshStatus,
  myAddressCanonical,
}: Params) {
  return useCallback(
    async (orderId?: number | null, mode: 'charge' | 'fast-forward' = 'charge'): Promise<boolean> => {
      if (energizeLoading) return false
      setEnergizeError(null)
      setEnergizeLoading(true)
      let success = false
      try {
        const idValue = Number(orderId)
        const hasOrder = Number.isFinite(idValue) && idValue > 0
        const requestInit: RequestInit = {
          method: 'POST',
          credentials: 'same-origin',
        }
        if (hasOrder) {
          requestInit.headers = { 'content-type': 'application/json' }
          requestInit.body = JSON.stringify({ orderId: idValue })
        }
        const endpoint = mode === 'fast-forward' ? '/api/care/fast-forward' : '/api/care/charge'
        const resp = await fetch(endpoint, requestInit)
        if (!resp.ok) {
          const payload = await resp.json().catch(() => null)
          let message = 'Nourish failed. Try again soon.'
          let shouldOpenTopUp = false

          if (resp.status === 401) {
            message = 'Verify your wallet to nourish.'
          } else if (resp.status === 503 || resp.status === 502) {
            message = 'Server temporarily unavailable. Please try again in a moment.'
          } else if (payload?.error === 'charge_cooldown' || payload?.error === 'care_cooldown') {
            const until = payload?.details?.cooldownUntil ? formatTimeLabel(payload.details.cooldownUntil) : null
            message = until ? `Nourish ready at ${until}` : 'Nourish cooling down.'
          } else if (payload?.error === 'daily_cap_reached') {
            message = 'Daily fast-forward limit reached. Try again after 00:00 UTC.'
          } else if (payload?.error === 'ineligible_newcomer') {
            message = 'Fast-forward is only for newcomers without gear.'
            void refreshStatus('manual')
          } else if (payload?.error === 'payment_required') {
            const quoted = Number(payload?.details?.quoteAmount)
            setEnergizeUi((prev: any) => {
              const next = { ...prev, energizeCost: Number.isFinite(quoted) ? quoted : prev.energizeCost }
              return next
            })
            message = mode === 'fast-forward' ? 'Need 5 BC per attempt to fast-forward.' : 'Buy BlobCoin to nourish.'
            shouldOpenTopUp = !hasOrder
          } else if (payload?.error === 'insufficient_balance') {
            message = 'Not enough BlobCoin. Buy BlobCoin and try again.'
            shouldOpenTopUp = !hasOrder
          } else if (payload?.error === 'order_missing' || payload?.error === 'order_expired') {
            message = 'Nourish order expired. Please create a new Buy BlobCoin order.'
            shouldOpenTopUp = true
          } else if (payload?.error === 'order_conflict') {
            message = 'Payment order conflict. Please refresh and try again.'
          } else if (typeof payload?.error === 'string') {
            message = payload.error.replace(/_/g, ' ')
          }

          setEnergizeError(message)
          setEnergizeAlert({ message, until: Date.now() + 6000 })

          // Auto-open top-up modal for payment-related errors
          if (shouldOpenTopUp) {
            openTopUpModal({ autoEnergize: true })
          }

          return false
        }
        const payload = await resp.json().catch(() => null)
        const energizeResult = payload?.result || null
        if (energizeResult) {
          setEnergizeUi((prev: any) => {
            const next = toEnergizeUiState(energizeResult, prev)
            return next
          })
          const untilLabel = energizeResult?.status?.boostersActiveUntil
            ? formatTimeLabel(energizeResult.status.boostersActiveUntil)
            : null
          setEnergizeAlert({
            message: untilLabel ? `Nourished! Boosters active until ${untilLabel}.` : 'Nourished! Boosters refreshed.',
            until: Date.now() + 6000,
          })
        }
        const loot = energizeResult?.loot
        if (Array.isArray(loot) && loot.length) {
          const updateLoadout =
            typeof window !== 'undefined' ? (window as any).BlobletsWorld_updateLoadout : undefined
          loot.forEach((entry: any) => {
            if (!entry?.item || typeof updateLoadout !== 'function') return
            updateLoadout({
              bloblet_address: myAddressCanonical,
              weapon_item_id: entry.slot === 'weapon' ? entry.item.id ?? null : null,
              shield_item_id: entry.slot === 'shield' ? entry.item.id ?? null : null,
              weapon: entry.slot === 'weapon' ? entry.item : undefined,
              shield: entry.slot === 'shield' ? entry.item : undefined,
            })
          })
        }
        emitClientEvent(CLIENT_EVENT.ENERGIZE_APPLIED, { action: 'energize' })
        // Await balance refresh to ensure UI shows updated balance
        await refreshRewards({ silent: true }).catch(() => {})
        await refreshStatus('event').catch(() => {})
        success = true
      } catch (err) {
        let message = 'Nourish failed. Try again later.'
        if (err instanceof Error) {
          // Provide more specific error messages for common network issues
          if (err.message.includes('fetch') || err.message.includes('network')) {
            message = 'Network error. Check your connection and try again.'
          } else if (err.message.includes('timeout')) {
            message = 'Request timed out. Please try again.'
          } else if (err.message.includes('abort')) {
            message = 'Request cancelled. Please try again.'
          } else {
            message = err.message
          }
        }
        setEnergizeError(message)
        setEnergizeAlert({ message, until: Date.now() + 6000 })
      } finally {
        setEnergizeLoading(false)
      }
      return success
    },
    [
      energizeLoading,
      formatTimeLabel,
      myAddressCanonical,
      openTopUpModal,
      refreshRewards,
      refreshStatus,
      setEnergizeAlert,
      setEnergizeError,
      setEnergizeLoading,
      setEnergizeUi,
    ],
  )
}
