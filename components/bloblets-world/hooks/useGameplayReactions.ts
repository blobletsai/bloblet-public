import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { GameplayState } from '@/src/client/realtime/gameplay'
import { buildChargeStatus, parseChargeState } from '@/src/shared/care'
import type { EnergizeUiState } from '../energizeState'
import { logVisibilityDebug } from '@/src/shared/pvp/visibilityDebug'

type EnergizeAlert = { message: string; until: number } | null

type GameplayReactionsOptions = {
  gameplay: GameplayState
  myAddressCanonical: string
  setEnergizeUi: Dispatch<SetStateAction<EnergizeUiState>>
  pendingEnergizeActionRef: MutableRefObject<string | null>
  setEnergizeAlert: Dispatch<SetStateAction<EnergizeAlert>>
  refreshRewards: (options?: { silent?: boolean }) => Promise<unknown>
  prependBattle: (entry: {
    id: number
    attacker: string | null
    defender: string | null
    attacker_booster: number | null
    defender_booster: number | null
    attacker_base: number | null
    defender_base: number | null
    attacker_total: number | null
    defender_total: number | null
    winner: string | null
    critical: boolean
    transfer_points: number | null
    house_points: number | null
    loot: any
    created_at: string | null
  }) => void
  updateLoadout: (entry: {
    bloblet_address: string | null
    weapon_item_id: number | null
    shield_item_id: number | null
    updated_at: string | null
  }) => void
  stateRef: MutableRefObject<any>
}

export function useGameplayReactions({
  gameplay,
  myAddressCanonical,
  setEnergizeUi,
  pendingEnergizeActionRef,
  setEnergizeAlert,
  refreshRewards,
  prependBattle,
  updateLoadout,
  stateRef,
}: GameplayReactionsOptions) {
  useEffect(() => {
    if (!myAddressCanonical) return
    const entry = gameplay.careByAddress.get(myAddressCanonical)
    if (!entry) return
    const careStatePayload = entry.careState
    const parsedCare = parseChargeState(careStatePayload)
    const parsedHasMeaning =
      Boolean(parsedCare.cooldownEndsAt) ||
      Boolean(parsedCare.boostersActiveUntil) ||
      Boolean(parsedCare.lastChargedAt) ||
      Boolean((parsedCare as any).fastForwardDebtUntil) ||
      Boolean((parsedCare as any).fastForwardBurstDay) ||
      Boolean((parsedCare as any).fastForwardBurstsUsed) ||
      typeof parsedCare.dropAcc === 'number'
    if (
      !careStatePayload ||
      (typeof careStatePayload === 'object' && Object.keys(careStatePayload).length === 0) ||
      !parsedHasMeaning
    ) {
      // Ignore empty/unauthorized realtime payloads so we don’t clobber the last server status snapshot
      return
    }
    
    setEnergizeUi((prev) => {
      // Reuse newcomer flag from the last status fetch; realtime care_state lacks inventory context
      const isNewcomer = prev.fastForwardIsNewcomer
      const status = buildChargeStatus(parsedCare, new Date(), {
        fastForward: { isNewcomer }
      })
      const fastForwardDebtUntil = status.fastForwardDebtUntil ?? prev.fastForwardDebtUntil

      const next: EnergizeUiState = {
        ...prev,
        state: status.state,
        boosterLevel: status.boosterLevel,
        boostersActiveUntil: status.boostersActiveUntil,
        cooldownEndsAt: status.cooldownEndsAt,
        overdue: status.overdue,
        lastEnergizeAt: status.lastChargedAt,
        dropAcc: typeof status.dropAcc === 'number' ? status.dropAcc : prev.dropAcc ?? 0,
        // Preserve fast-forward eligibility/burst counts from the last status fetch; realtime lacks newcomer context
        fastForwardEligible: prev.fastForwardEligible,
        fastForwardDebtUntil,
        fastForwardBurstsRemaining: prev.fastForwardBurstsRemaining,
        fastForwardIsNewcomer: prev.fastForwardIsNewcomer,
      }
      stateRef.current.energizeStatus = next
      return next
    })

    if (pendingEnergizeActionRef.current) {
      // We reconstruct status here just for the alert check, or we could use the one from inside setEnergizeUi if we refactored.
      // To avoid refactoring the alert logic too much, we'll just use the status derived from the entry again (defaulting newcomer is fine for the alert message).
      const simpleStatus = buildChargeStatus(parseChargeState(entry.careState))
      pendingEnergizeActionRef.current = null
      let message = 'Nourish complete!'
      if (simpleStatus.state === 'covered' && simpleStatus.boostersActiveUntil) {
        const until = new Date(simpleStatus.boostersActiveUntil)
        const label = Number.isNaN(until.getTime())
          ? simpleStatus.boostersActiveUntil
          : until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        message = `Boosters refreshed. Active until ${label}.`
      }
      setEnergizeAlert({ message, until: Date.now() + 6000 })
    }
  }, [
    gameplay.careByAddress,
    myAddressCanonical,
    pendingEnergizeActionRef,
    setEnergizeAlert,
    setEnergizeUi,
    stateRef,
  ])

  useEffect(() => {
    const last = gameplay.lastEvent
    if (!last || last.topic !== 'ledger') return
    if (!myAddressCanonical) return
    if ((last.payload.address || '') !== myAddressCanonical) return
    if (gameplay.connection !== 'open') {
      refreshRewards({ silent: true }).catch(() => {})
    }
  }, [gameplay.connection, gameplay.lastEvent, myAddressCanonical, refreshRewards])

  useEffect(() => {
    const last = gameplay.lastEvent
    if (!last || last.topic !== 'order') return
    if (!myAddressCanonical) return
    if ((last.payload.address || '') !== myAddressCanonical) return
    if (last.payload.type !== 'care') return
    setEnergizeUi((prev) => {
      const next: EnergizeUiState = {
        ...prev,
        energizeCost:
          last.payload.quoteAmount != null ? Number(last.payload.quoteAmount) : prev.energizeCost,
        consumedOrder:
          last.payload.status === 'applied'
            ? { id: last.payload.id, txHash: last.payload.txHash }
            : prev.consumedOrder,
      }
      stateRef.current.energizeStatus = next
      return next
    })
  }, [gameplay.lastEvent, myAddressCanonical, setEnergizeUi, stateRef])

  useEffect(() => {
    const last = gameplay.lastEvent
    if (!last || last.topic !== 'battle') return
    const payload = last.payload
    if (!payload.id) return
    prependBattle({
      id: payload.id,
      attacker: payload.attacker,
      defender: payload.defender,
      attacker_booster: payload.attackerBooster,
      defender_booster: payload.defenderBooster,
      attacker_base: payload.attackerBase,
      defender_base: payload.defenderBase,
      attacker_total: payload.attackerTotal,
      defender_total: payload.defenderTotal,
      winner: payload.winner,
      critical: payload.critical,
      transfer_points: payload.transferPoints,
      house_points: payload.housePoints,
      loot: payload.loot,
      created_at: payload.createdAt,
    })
  }, [gameplay.lastEvent, prependBattle])

  useEffect(() => {
    const last = gameplay.lastEvent
    if (!last || last.topic !== 'loadout') return
    const payload = last.payload
    const addr = (payload.address || '').trim()
    if (!addr || addr !== myAddressCanonical) return
    logVisibilityDebug('realtime loadout', {
      viewer: addr,
      weapon_item_id: payload.weaponItemId ?? null,
      shield_item_id: payload.shieldItemId ?? null,
      updated_at: payload.updatedAt ?? null,
    })
    updateLoadout({
      bloblet_address: payload.address,
      weapon_item_id: payload.weaponItemId,
      shield_item_id: payload.shieldItemId,
      updated_at: payload.updatedAt,
    })
  }, [gameplay.lastEvent, myAddressCanonical, updateLoadout])
}
