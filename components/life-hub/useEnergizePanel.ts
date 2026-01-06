"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

import type { RewardsModalConfig } from '@/components/rewards-modal/types'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import {
  getEnergizeCountdownLabel,
  getEnergizeHudStatus,
  type EnergizeHudStatus,
  type EnergizeUiState,
} from '../bloblets-world/energizeState'

type TopUpStatusTelemetry = {
  active: boolean
  open: boolean
  phase: string | null
  status: string | null
  notice: string | null
  orderId: number | null
  autoStatus: 'idle' | 'running' | 'success' | 'error'
  errorMessage: string | null
}

type UseEnergizePanelParams = {
  energizeUi: EnergizeUiState
  energizeLoading: boolean
  walletAddressLower: string | null
  needsTopUp: boolean
  rewardsConfig?: RewardsModalConfig
  gateRequirementLabel?: string | null
  formatTimeLabel: (iso: string | null | undefined) => string
  topUpStatus?: TopUpStatusTelemetry
}

type UseEnergizePanelResult = {
  coverageCountdownLabel: string
  hudStatus: EnergizeHudStatus
  disabledReason: string | null
  helperLabel: string
  fastForwardAvailable: boolean
  fastForwardBurstsRemaining: number
  fastForwardDebtUntil: string | null
  fastForwardDisabledReason: string | null
}

export function useEnergizePanel({
  energizeUi,
  energizeLoading,
  walletAddressLower,
  needsTopUp,
  rewardsConfig,
  gateRequirementLabel,
  formatTimeLabel,
  topUpStatus,
}: UseEnergizePanelParams): UseEnergizePanelResult {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const coverageCountdownLabel = useMemo(
    () => getEnergizeCountdownLabel(energizeUi, nowMs),
    [energizeUi, nowMs],
  )

  const hudStatus = useMemo(
    () => getEnergizeHudStatus(energizeUi, coverageCountdownLabel),
    [energizeUi, coverageCountdownLabel],
  )

  const topUpUi = useMemo(
    () => resolveTopUpUi(topUpStatus),
    [topUpStatus],
  )

  const boostersActiveUntilMs = energizeUi.boostersActiveUntil ? Date.parse(energizeUi.boostersActiveUntil) : null
  const boostersStillActive =
    Number.isFinite(boostersActiveUntilMs) && boostersActiveUntilMs !== null && boostersActiveUntilMs > nowMs
  const cooldownEndsAtMs = energizeUi.cooldownEndsAt ? Date.parse(energizeUi.cooldownEndsAt) : null

  // Client-side timer override: if cooldown time has passed, treat as ready
  const cooldownHasExpired =
    Number.isFinite(cooldownEndsAtMs) && cooldownEndsAtMs !== null && cooldownEndsAtMs <= nowMs

  const fastForwardDebtUntilMs = energizeUi.fastForwardDebtUntil ? Date.parse(energizeUi.fastForwardDebtUntil) : null
  const fastForwardDebtActive = Number.isFinite(fastForwardDebtUntilMs) && fastForwardDebtUntilMs !== null && fastForwardDebtUntilMs > nowMs
  const fastForwardBurstsRemaining =
    Number.isFinite(energizeUi.fastForwardBurstsRemaining) && energizeUi.fastForwardBurstsRemaining != null
      ? Number(energizeUi.fastForwardBurstsRemaining)
      : 0
  // Prefer server eligibility, but allow newcomer+bursts fallback to avoid stale realtime gaps
  const fastForwardEligible =
    Boolean(energizeUi.fastForwardEligible) ||
    (energizeUi.fastForwardIsNewcomer && fastForwardBurstsRemaining > 0 && !fastForwardDebtActive)
  const isCooldownWindow =
    !cooldownHasExpired &&
    (energizeUi.state === 'cooldown' || energizeUi.state === 'covered')

  const fastForwardAvailable = Boolean(
    fastForwardEligible &&
    fastForwardBurstsRemaining > 0 &&
    !fastForwardDebtActive &&
    // Only show fast-forward when we are actually in cooldown/covered (and it hasn't expired)
    isCooldownWindow
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const snapshot = {
      state: energizeUi.state,
      fastForwardEligible,
      fastForwardBurstsRemaining,
      fastForwardDebtActive,
      isCooldownWindow,
      fastForwardAvailable,
    }
    ;(window as any).__ffDebug = snapshot
    // Temporary debug to confirm fast-forward gating state in preview
    try { console.info('[ff-debug]', snapshot) } catch {}
  }, [
    energizeUi.state,
    fastForwardEligible,
    fastForwardBurstsRemaining,
    fastForwardDebtActive,
    isCooldownWindow,
    fastForwardAvailable,
  ])

  // When timers flip from active -> expired, force a `/api/player/status` refresh (single source of truth)
  const boostersActiveRef = useRef<boolean>(boostersStillActive)
  const cooldownExpiredRef = useRef<boolean>(cooldownHasExpired)
  const debtActiveRef = useRef<boolean>(fastForwardDebtActive)

  useEffect(() => {
    const boosterTurnedOff = boostersActiveRef.current && !boostersStillActive
    const cooldownJustExpired = !cooldownExpiredRef.current && cooldownHasExpired
    const debtJustExpired = debtActiveRef.current && !fastForwardDebtActive

    boostersActiveRef.current = boostersStillActive
    cooldownExpiredRef.current = cooldownHasExpired
    debtActiveRef.current = fastForwardDebtActive

    if (!boosterTurnedOff && !cooldownJustExpired && !debtJustExpired) return
    emitClientEvent(CLIENT_EVENT.VERIFIED, {})
  }, [boostersStillActive, cooldownHasExpired, fastForwardDebtActive])

  const disabledReason = useMemo(() => {
    if (energizeLoading) return 'Nourishing…'
    const walletConnected = Boolean(walletAddressLower)
    if (!walletConnected) return 'Connect wallet to verify and Buy BlobCoin before nourishing.'
    if (rewardsConfig && rewardsConfig.isHolder === false) {
      const gateLabel = gateRequirementLabel ? `Need ${gateRequirementLabel}. ` : ''
      return `${gateLabel}Buy BlobCoin to clear the gate.`
    }
    if (topUpUi?.block && topUpUi.message) {
      return topUpUi.message
    }
    if (energizeUi.state === 'covered' && energizeUi.boostersActiveUntil && boostersStillActive) {
      return `Boosters active until ${formatTimeLabel(energizeUi.boostersActiveUntil)}`
    }
    // CRITICAL FIX: Check if cooldown has expired using client time, not just server state
    if (energizeUi.state === 'cooldown' && energizeUi.cooldownEndsAt) {
      // Only disable if cooldown is still active according to client time
      if (!cooldownHasExpired && Number.isFinite(cooldownEndsAtMs) && cooldownEndsAtMs && cooldownEndsAtMs > nowMs) {
        if (fastForwardDebtActive) {
           return `Fast-forward debt clears at ${formatTimeLabel(energizeUi.fastForwardDebtUntil)}`
        }
        return `Nourish ready at ${formatTimeLabel(energizeUi.cooldownEndsAt)}`
      }
      // If cooldown has expired, fall through to check other conditions (needsTopUp, etc.)
    }
    if (needsTopUp) {
      return 'Buy BlobCoin to add BlobCoin before nourishing.'
    }
    return null
  }, [
    boostersStillActive,
    cooldownEndsAtMs,
    cooldownHasExpired,
    energizeLoading,
    energizeUi,
    gateRequirementLabel,
    needsTopUp,
    rewardsConfig,
    walletAddressLower,
    formatTimeLabel,
    topUpUi,
    nowMs,
    fastForwardDebtActive,
  ])

  const fastForwardDisabledReason = useMemo(() => {
    if (!fastForwardAvailable) return null
    const walletConnected = Boolean(walletAddressLower)
    if (!walletConnected) return 'Connect wallet to verify and fast-forward.'
    if (topUpUi?.block && topUpUi.message) {
      return topUpUi.message
    }
    if (needsTopUp) {
      return 'Buy BlobCoin to add BlobCoin before nourishing.'
    }
    if (energizeLoading) return 'Nourishing…'
    return null
  }, [
    energizeLoading,
    fastForwardAvailable,
    needsTopUp,
    topUpUi,
    walletAddressLower,
  ])

  const helperLabel = useMemo(() => {
    const walletConnected = Boolean(walletAddressLower)
    if (!walletConnected) {
      return 'Connect your wallet and use Buy BlobCoin to nourish.'
    }
    if (walletConnected && rewardsConfig?.isHolder === false) {
      return gateRequirementLabel
        ? `Need ${gateRequirementLabel}. Buy BlobCoin to clear the gate.`
        : 'Buy BlobCoin to clear the gate.'
    }
    if (topUpUi?.message) {
      return topUpUi.message
    }
    if (fastForwardAvailable) {
      if (fastForwardDisabledReason) {
        return fastForwardDisabledReason
      }
      return 'Fast-forward available — debt applies'
    }
    if (disabledReason) return disabledReason
    if (needsTopUp) return 'Buy BlobCoin to add BlobCoin before nourishing.'
    return 'Nourishing refreshes boosters, rolls for loot, and resets cooldowns.'
  }, [
    disabledReason,
    fastForwardAvailable,
    fastForwardDisabledReason,
    gateRequirementLabel,
    needsTopUp,
    rewardsConfig,
    topUpUi,
    walletAddressLower,
  ])

  return {
    coverageCountdownLabel,
    hudStatus,
    disabledReason,
    helperLabel,
    fastForwardAvailable,
    fastForwardBurstsRemaining,
    fastForwardDebtUntil: energizeUi.fastForwardDebtUntil,
    fastForwardDisabledReason,
  }
}

function resolveTopUpUi(status?: TopUpStatusTelemetry) {
  if (!status) return null
  if (status.autoStatus === 'running') {
    return { message: 'Auto-nourish in progress…', block: true }
  }
  if (status.autoStatus === 'error') {
    const fallback = 'Auto-nourish failed. Nourish once Buy BlobCoin completes.'
    return { message: status.errorMessage || fallback, block: false }
  }
  if (status.active) {
    const message =
      status.notice?.trim() ||
      topUpPhaseDescription(status.phase, status.status) ||
      'Buy BlobCoin order processing…'
    const block = status.phase != null && status.phase !== 'applied' && status.phase !== 'preview_ready'
    return { message, block }
  }
  if (status.status === 'applied') {
    return { message: 'Buy BlobCoin credited — Nourish ready.', block: false }
  }
  if (status.status === 'expired') {
    return { message: 'Buy BlobCoin order expired. Start a new one.', block: false }
  }
  if (status.status === 'rejected') {
    return { message: 'Buy BlobCoin order needs attention.', block: false }
  }
  return null
}

function topUpPhaseDescription(phase: string | null, status: string | null) {
  if (!phase) {
    if (status === 'pending') return 'Buy BlobCoin order pending…'
    if (status === 'applied') return 'Buy BlobCoin credited.'
    if (status === 'expired') return 'Buy BlobCoin order expired. Start a new one.'
    if (status === 'rejected') return 'Buy BlobCoin order needs attention.'
    return null
  }
  switch (phase) {
    case 'awaiting_payment':
      return 'Send the Buy BlobCoin transfer to continue.'
    case 'confirming_payment':
      return 'Buy BlobCoin transfer confirming on-chain…'
    case 'generating_preview':
    case 'applying':
      return 'Buy BlobCoin order finalising…'
    case 'preview_ready':
      return 'Buy BlobCoin order awaiting finalize.'
    case 'applied':
      return 'Buy BlobCoin credited.'
    case 'expired':
      return 'Buy BlobCoin order expired. Start a new one.'
    case 'rejected':
      return 'Buy BlobCoin order needs attention.'
    default:
      return null
  }
}
