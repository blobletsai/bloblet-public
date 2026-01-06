"use client"

import { useCallback, useMemo, useState } from 'react'
import {
  EMPTY_TOP_UP_STATUS,
  type LifeHubTopUpStatus,
  type LifeHubTopUpStatusInput,
} from '../life-hub/LifeHubProvider'
import type { ChallengeHandlerResult } from '@/components/ChallengeModal'
import { formatChallengeErrorMessage } from './formatters'
import { selectRecentOpponents } from './opponentSelectors'
import { supaAnon } from '@/src/server/supa'
import { createChallengeAvatarResolver } from '@/components/challenge-modal/avatarResolver'
import type { PvpBattle } from '@/types'
import type { HolderMetaEntry } from './types'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'
import { logVisibilityDebug } from '@/src/shared/pvp/visibilityDebug'

type RefreshRewardsFn = (options?: { silent?: boolean }) => Promise<unknown>

type ChallengeModalStateOptions = {
  holderMeta: Record<string, HolderMetaEntry>
  battleFeed: PvpBattle[]
  myAddress: string
  refreshRewards: RefreshRewardsFn
  minStake: number | null
  registerPairCooldown?: (address: string, untilIso?: string | null) => void
}

type ChallengeWindowHandlers = {
  BlobletsWorld_openChallenge: (target?: string) => void
  BlobletsWorld_closeChallenge: () => void
}

type StakeInfo = {
  balance: number | null
  balanceKnown: boolean
  stakeReady: boolean
  minStake: number | null
}

export function useChallengeModalState(options: ChallengeModalStateOptions) {
  const { holderMeta, battleFeed, myAddress, refreshRewards, minStake, registerPairCooldown } = options

  const [challengeModalOpen, setChallengeModalOpen] = useState(false)
  const [challengePresetTarget, setChallengePresetTarget] = useState<{ normalized: string; display: string } | null>(null)
  const resolveChallengeAvatar = useMemo(
    () => createChallengeAvatarResolver(holderMeta),
    [holderMeta],
  )

  const openChallengeModal = useCallback((target?: string) => {
    if (target) {
      const normalized = String(target).trim()
      const meta = holderMeta[normalized]
      const display = meta?.addressCased || target
      setChallengePresetTarget({ normalized, display })
    } else {
      setChallengePresetTarget(null)
    }
    setChallengeModalOpen(true)
  }, [holderMeta, setChallengeModalOpen, setChallengePresetTarget])

  const closeChallengeModal = useCallback(() => {
    setChallengeModalOpen(false)
    setChallengePresetTarget(null)
  }, [setChallengeModalOpen, setChallengePresetTarget])

  const refreshBattlesFromSupabase = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      const supa = supaAnon()
      const { data, error } = await supa
        .from('pvp_battles')
        .select('id,attacker,defender,attacker_booster,defender_booster,attacker_base,defender_base,attacker_total,defender_total,winner,transfer_points,house_points,loot,critical,created_at')
        .order('created_at', { ascending: false })
        .limit(12)
      if (!error && Array.isArray(data)) {
        const applyFn = typeof window !== 'undefined' ? (window as any).BlobletsWorld_applyBattles : undefined
        if (typeof applyFn === 'function') applyFn(data)
      }
    } catch (err) {
      console.warn('[bloblets] failed to refresh battle feed', err)
    }
  }, [])

  const getStakeInfo = useCallback(
    (address: string): StakeInfo => {
      const normalized = String(address || '').trim()
      const meta = holderMeta[normalized]
      const rawBalance = meta?.balance
      const balance =
        typeof rawBalance === 'number' && Number.isFinite(rawBalance) ? rawBalance : null
      const minRequirement = typeof minStake === 'number' && minStake > 0 ? minStake : null
      const balanceKnown = balance != null
      const stakeReady =
        minRequirement == null || !balanceKnown || balance >= minRequirement
      emitClientEvent(CLIENT_EVENT.STAKE_DEBUG, {
        address: normalized,
        balance,
        minStake: minRequirement,
        stakeReady,
        balanceKnown,
        timestamp: Date.now(),
      })
      if (!balanceKnown) {
        console.warn('[challenge] Defender balance unavailable, skipping pre-check', normalized)
      }
      return {
        balance,
        balanceKnown,
        stakeReady,
        minStake: minRequirement,
      }
    },
    [holderMeta, minStake],
  )

  const handleChallengeSubmit = useCallback(async (target: string): Promise<ChallengeHandlerResult> => {
    const attacker = String(myAddress || '').trim()
    const defender = String(target || '').trim()
    if (!attacker) {
      return { ok: false, error: 'unauthorized', message: formatChallengeErrorMessage('unauthorized') }
    }
    if (!defender) {
      return { ok: false, error: 'target_missing', message: formatChallengeErrorMessage('target_missing') }
    }
    if (attacker === defender) {
      return { ok: false, error: 'self_target', message: formatChallengeErrorMessage('self_target') }
    }

    const stakeInfo = getStakeInfo(defender)
    if (stakeInfo.balanceKnown && !stakeInfo.stakeReady && stakeInfo.minStake != null) {
      return {
        ok: false,
        error: 'defender_balance_low',
        message: formatChallengeErrorMessage('defender_balance_low', { minPoints: stakeInfo.minStake }),
      }
    }

    try {
      const res = await fetch('/api/pvp/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ targetAddress: defender })
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const code = payload?.error || 'unknown_error'
        const message = formatChallengeErrorMessage(code, payload?.details)
        const cooldownUntil = payload?.details?.nextAllowedAt || payload?.details?.cooldownUntil || null
        if ((code === 'pair_cooldown' || code === 'defender_recently_lost') && cooldownUntil) {
          registerPairCooldown?.(defender, cooldownUntil)
        }
        return { ok: false, error: code, message, cooldownUntil }
      }

      const result = payload?.result
      if (!result) {
        return { ok: false, error: 'invalid_response', message: 'Challenge response was incomplete. Try again.' }
      }

      const executedAt = new Date().toISOString()
      logVisibilityDebug('pvp/challenge', {
        viewer: attacker,
        battleId: result.battleId ?? null,
        weapon: result.attacker?.weapon
          ? { id: result.attacker.weapon.id, slug: result.attacker.weapon.slug, op: result.attacker.weapon.op, dp: result.attacker.weapon.dp }
          : null,
        shield: result.attacker?.shield
          ? { id: result.attacker.shield.id, slug: result.attacker.shield.slug, op: result.attacker.shield.op, dp: result.attacker.shield.dp }
          : null,
        base: result.attacker?.base ?? null,
        roll: result.attacker?.roll ?? null,
        booster: result.attacker?.booster ?? null,
      })

      const updateLoadout = typeof window !== 'undefined' ? (window as any).BlobletsWorld_updateLoadout : undefined
      if (typeof updateLoadout === 'function') {
        updateLoadout({
          bloblet_address: result.attacker?.address,
          weapon_item_id: result.attacker?.weapon?.id ?? null,
          shield_item_id: result.attacker?.shield?.id ?? null,
          weapon: result.attacker?.weapon || undefined,
          shield: result.attacker?.shield || undefined
        })
      }

      const prependBattle = typeof window !== 'undefined' ? (window as any).BlobletsWorld_prependBattle : undefined
      if (typeof prependBattle === 'function') {
        const defenderAddress = result.opponent?.address || defender
        prependBattle({
          id: Date.now(),
          attacker: result.attacker?.address || attacker,
          defender: defenderAddress,
          attacker_booster: result.attacker?.booster ?? 0,
          defender_booster: 0,
          attacker_base: result.attacker?.base ?? 0,
          defender_base: 0,
          attacker_total: result.attacker?.roll ?? 0,
          defender_total: 0,
          winner: result.winner === 'defender' ? 'defender' : 'attacker',
          transfer_points: result.transfer?.transfer ?? 0,
          house_points: result.transfer?.house ?? 0,
          loot: Array.isArray(result.loot) ? result.loot : [],
          critical: !!result.critical,
          created_at: executedAt
        })
      }

      registerPairCooldown?.(result.opponent?.address || defender, result.cooldownEndsAt ?? null)

      await refreshBattlesFromSupabase()
      refreshRewards({ silent: true }).catch(() => {})

      return { ok: true, result: { ...result, executedAt } }
    } catch (err) {
      console.warn('[bloblets] challenge request failed', err)
      return { ok: false, error: 'network_error', message: formatChallengeErrorMessage('network_error') }
    }
  }, [getStakeInfo, myAddress, refreshBattlesFromSupabase, refreshRewards, registerPairCooldown])

  const recentOpponents = useMemo(
    () => selectRecentOpponents(myAddress, battleFeed, holderMeta),
    [battleFeed, holderMeta, myAddress],
  )

  const challengeWindowHandlers = useMemo<ChallengeWindowHandlers>(() => ({
    BlobletsWorld_openChallenge: openChallengeModal,
    BlobletsWorld_closeChallenge: closeChallengeModal,
  }), [closeChallengeModal, openChallengeModal])

  return {
    challengeModalOpen,
    challengePresetTarget,
    openChallengeModal,
    closeChallengeModal,
    handleChallengeSubmit,
    recentOpponents,
    challengeWindowHandlers,
    resolveChallengeAvatar,
    minStake,
    getStakeInfo,
  }
}

type RewardsWindowHandlers = {
  BlobletsWorld_openTopUpRewards: () => void
  BlobletsWorld_closeRewards: () => void
}

export function useRewardsModalState() {
  const [topUpModalOpen, setTopUpModalOpen] = useState(false)
  const [autoEnergizeAfterTopUp, setAutoEnergizeAfterTopUp] = useState(false)
  const [topUpStatus, setTopUpStatusState] = useState<LifeHubTopUpStatus>({ ...EMPTY_TOP_UP_STATUS })

  const resolveTopUpStatus = useCallback(
    (prev: LifeHubTopUpStatus, next?: LifeHubTopUpStatusInput): LifeHubTopUpStatus => {
      if (!next) {
        return { ...EMPTY_TOP_UP_STATUS }
      }
      return {
        ...EMPTY_TOP_UP_STATUS,
        ...prev,
        ...next,
      }
    },
    [],
  )

  const topUpStatusEquals = useCallback((a: LifeHubTopUpStatus, b: LifeHubTopUpStatus) => {
    return (
      a.active === b.active &&
      a.open === b.open &&
      a.phase === b.phase &&
      a.status === b.status &&
      a.notice === b.notice &&
      a.orderId === b.orderId &&
      a.autoStatus === b.autoStatus &&
      a.errorMessage === b.errorMessage
    )
  }, [])

  const openTopUpModal = useCallback((options?: { autoEnergize?: boolean }) => {
    setAutoEnergizeAfterTopUp(Boolean(options?.autoEnergize))
    setTopUpModalOpen(true)
  }, [setAutoEnergizeAfterTopUp, setTopUpModalOpen])

  const closeTopUpModal = useCallback(() => {
    setTopUpModalOpen(false)
    setAutoEnergizeAfterTopUp(false)
    setTopUpStatusState({ ...EMPTY_TOP_UP_STATUS })
  }, [setAutoEnergizeAfterTopUp, setTopUpModalOpen, setTopUpStatusState])

  const closeRewards = useCallback(() => {
    setTopUpModalOpen(false)
    setAutoEnergizeAfterTopUp(false)
    setTopUpStatusState({ ...EMPTY_TOP_UP_STATUS })
  }, [setAutoEnergizeAfterTopUp, setTopUpModalOpen, setTopUpStatusState])

  const rewardsWindowHandlers = useMemo<RewardsWindowHandlers>(() => ({
    BlobletsWorld_openTopUpRewards: openTopUpModal,
    BlobletsWorld_closeRewards: closeRewards,
  }), [closeRewards, openTopUpModal])

  const updateTopUpStatus = useCallback((next?: LifeHubTopUpStatusInput) => {
    setTopUpStatusState((prev) => {
      const merged = resolveTopUpStatus(prev, next)
      return topUpStatusEquals(prev, merged) ? prev : merged
    })
  }, [resolveTopUpStatus, setTopUpStatusState, topUpStatusEquals])

  return {
    topUpModalOpen,
    openTopUpModal,
    closeTopUpModal,
    autoEnergizeAfterTopUp,
    topUpStatus,
    setTopUpStatus: updateTopUpStatus,
    rewardsWindowHandlers,
  }
}
