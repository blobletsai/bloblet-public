"use client"

import { useEffect, useMemo } from 'react'
import type { MutableRefObject } from 'react'

import type { HubTab, HolderMetaEntry } from '../types'
import type { RiskTone } from '@/src/shared/pvp'
import type { LoadoutLookup } from './useLoadoutAndBattleState'
import {
  buildHighlightedTargets,
  buildTargetSuggestions,
  type HighlightedTarget,
} from '../opponentSelectors'

type UseOpponentHighlightsArgs = {
  selectedOpponent: string | null
  loadoutState: LoadoutLookup
  holderMeta: Record<string, HolderMetaEntry>
  myWeaponStat: number
  myAddressCanonical: string
  activeHubTab: HubTab | null
  stRef: MutableRefObject<any>
  scoutedLimit: number
  updateSelectedRef: (value: string | null) => void
  clearSelectedOpponent: () => void
  minStake: number | null
}

type UseOpponentHighlightsResult = {
  selectedOpponentMeta: {
    address: string
    balance: number | null
    stakeReady: boolean
    minStake: number | null
    balanceKnown: boolean
  } | null
  highlightedTargets: HighlightedTarget[]
}

export function useOpponentHighlights({
  selectedOpponent,
  loadoutState,
  holderMeta,
  myWeaponStat,
  myAddressCanonical,
  activeHubTab,
  stRef,
  scoutedLimit,
  updateSelectedRef,
  clearSelectedOpponent,
  minStake,
}: UseOpponentHighlightsArgs): UseOpponentHighlightsResult {
  useEffect(() => {
    updateSelectedRef(selectedOpponent)
  }, [selectedOpponent, updateSelectedRef])

  useEffect(() => {
    if (!myAddressCanonical) {
      clearSelectedOpponent()
    }
  }, [clearSelectedOpponent, myAddressCanonical])

  const threshold = useMemo(() => {
    const value = typeof minStake === 'number' && minStake > 0 ? minStake : null
    return value
  }, [minStake])

  const targetSuggestions = useMemo(
    () =>
      buildTargetSuggestions({
        myAddressCanonical,
        loadoutState,
        holderMeta,
        myWeaponStat,
        minStake: threshold,
      }),
    [holderMeta, loadoutState, myAddressCanonical, myWeaponStat, threshold],
  )

  const highlightedTargets = useMemo(
    () =>
      activeHubTab === 'opponents'
        ? buildHighlightedTargets(targetSuggestions, scoutedLimit)
        : [],
    [activeHubTab, scoutedLimit, targetSuggestions],
  )

  useEffect(() => {
    const st = stRef.current
    if (!st) return
    const map = new Map<string, { label: string; tone: RiskTone }>()
    for (const entry of highlightedTargets) {
      const key = String(entry.address || '').trim()
      if (!key) continue
      map.set(key, { label: '???', tone: 'neutral' })
    }
    st.scoutedMap = map
    st.scoutPulseStart =
      map.size > 0 ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) : 0
  }, [highlightedTargets, stRef])

  const selectedOpponentMeta = useMemo(() => {
    if (!selectedOpponent) return null
    const meta = holderMeta[selectedOpponent]
    const rawBalance = meta?.balance
    const balance =
      typeof rawBalance === 'number' && Number.isFinite(rawBalance) ? rawBalance : null
    const balanceKnown = balance != null
    const stakeReady =
      threshold == null || !balanceKnown || balance >= threshold
    return {
      address: selectedOpponent,
      balance,
      stakeReady,
      minStake: threshold,
      balanceKnown,
    }
  }, [holderMeta, selectedOpponent, threshold])

  return {
    selectedOpponentMeta,
    highlightedTargets,
  }
}
