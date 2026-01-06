"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { LifeHubContextValue, LifeHubTopUpStatus } from '../life-hub/LifeHubProvider'
import type { TopUpAutoStatus } from './useTopUpViewState'
import { normalizeStatus } from './topUpOrderUtils'
import type { UseMarketOrderResult } from '@/src/client/hooks/useMarketOrder'

type SuccessFlowInputs = {
  open: boolean
  state: UseMarketOrderResult['state']
  history: UseMarketOrderResult['history']
  onTransitionToSuccess: () => void
  onAfterSuccess?: () => void
  setSuccessAmount: Dispatch<SetStateAction<number | null>>
  setSuccessBalance: Dispatch<SetStateAction<number | null>>
  setSuccessLoading: Dispatch<SetStateAction<boolean>>
  setSuccessError: Dispatch<SetStateAction<string | null>>
  setAutoStatus: Dispatch<SetStateAction<TopUpAutoStatus>>
  autoEnergizeAfterTopUp: boolean
  onEnergize?: (orderId?: number | null) => Promise<unknown>
  appliedHandledRef: MutableRefObject<boolean>
  fetchRewardBalance?: () => Promise<number | null>
}

export function useTopUpSuccessFlowController({
  open,
  state,
  history,
  onTransitionToSuccess,
  onAfterSuccess,
  setSuccessAmount,
  setSuccessBalance,
  setSuccessLoading,
  setSuccessError,
  setAutoStatus,
  autoEnergizeAfterTopUp,
  onEnergize,
  appliedHandledRef,
  fetchRewardBalance,
}: SuccessFlowInputs) {
  const resolvedQuote = useMemo(() => {
    if (state.quote != null && Number.isFinite(state.quote)) return Number(state.quote)
    if (!state.orderId) return null
    const entry = history.find((item) => item.id === state.orderId)
    if (entry && entry.quote != null && Number.isFinite(entry.quote)) return Number(entry.quote)
    return null
  }, [history, state.orderId, state.quote])

  useEffect(() => {
    if (!open) {
      appliedHandledRef.current = false
      return
    }

    const normalizedStatus = normalizeStatus(state.status)
    if (normalizedStatus !== 'applied') {
      appliedHandledRef.current = false
      return
    }

    if (!state.orderId || appliedHandledRef.current) return

    appliedHandledRef.current = true

    const creditedAmount = Number.isFinite(state.appliedPoints ?? NaN)
      ? (state.appliedPoints as number)
      : resolvedQuote

    setSuccessAmount(Number.isFinite(creditedAmount || NaN) ? (creditedAmount as number) : null)
    const knownBalance = Number.isFinite(state.appliedBalance ?? NaN)
      ? (state.appliedBalance as number)
      : null
    if (knownBalance == null) {
      setSuccessBalance(null)
    } else {
      setSuccessBalance(knownBalance)
    }
    setSuccessLoading(knownBalance == null && Boolean(fetchRewardBalance))
    setSuccessError(null)

    let ignore = false

    if (knownBalance != null) {
      setSuccessLoading(false)
    } else if (fetchRewardBalance) {
      fetchRewardBalance()
        .then((value) => {
          if (ignore) return
          if (value != null) {
            setSuccessBalance(value)
          }
          setSuccessLoading(false)
        })
        .catch(() => {
          if (ignore) return
          setSuccessLoading(false)
        })
    } else {
      setSuccessLoading(false)
    }

    if (autoEnergizeAfterTopUp && onEnergize) {
      setAutoStatus('running')
    } else {
      setAutoStatus('idle')
    }

    onTransitionToSuccess()
    onAfterSuccess?.()

    if (autoEnergizeAfterTopUp && onEnergize) {
      const maybeCareOrder =
        state.type && normalizeStatus(state.type) === 'care' ? state.orderId : null

      Promise.resolve(onEnergize(maybeCareOrder ?? undefined))
        .then(() => {
          if (ignore) return
          setAutoStatus('success')
        })
        .catch(() => {
          if (ignore) return
          setAutoStatus('error')
          setSuccessError((prev) => prev ?? 'Auto-energize failed. Try energizing from the Life panel.')
        })
    }

    return () => {
      ignore = true
    }
  }, [
    appliedHandledRef,
    autoEnergizeAfterTopUp,
    onEnergize,
    onAfterSuccess,
    onTransitionToSuccess,
    open,
    resolvedQuote,
    setAutoStatus,
    setSuccessAmount,
    setSuccessBalance,
    setSuccessError,
    setSuccessLoading,
    state.appliedBalance,
    state.appliedPoints,
    state.orderId,
    state.status,
    state.type,
    fetchRewardBalance,
  ])
}

type LifeHubSyncInputs = {
  lifeHub: LifeHubContextValue | null
  open: boolean
  hasActiveOrder: boolean
  statusLower: string
  autoStatus: TopUpAutoStatus
  notice: string | null
  phase: UseMarketOrderResult['phase']
  orderId: number | null
  successError: string | null
}

export function useLifeHubTopUpStatusController({
  lifeHub,
  open,
  hasActiveOrder,
  statusLower,
  autoStatus,
  notice,
  phase,
  orderId,
  successError,
}: LifeHubSyncInputs) {
  const lifeHubRef = useRef(lifeHub)
  lifeHubRef.current = lifeHub

  useEffect(() => {
    if (!lifeHubRef.current) return
    if (!open) {
      lifeHubRef.current.setTopUpStatus?.(undefined)
      return
    }

    const status: LifeHubTopUpStatus = {
      active: hasActiveOrder,
      open,
      phase: phase ?? null,
      status: statusLower,
      notice: notice ?? null,
      orderId,
      autoStatus,
      errorMessage: successError,
    }

    lifeHubRef.current.setTopUpStatus?.(status)

    return () => {
      lifeHubRef.current?.setTopUpStatus?.(undefined)
    }
  }, [
    autoStatus,
    hasActiveOrder,
    notice,
    open,
    orderId,
    phase,
    statusLower,
    successError,
  ])
}

type EntryValidationResult = {
  ok: boolean
  message?: string
  amount?: number
}

export function validateTopUpAmount({
  amountInput,
  configReady,
  hasActiveOrder,
  sessionAddressPresent,
  isConnected,
  parsedAmount,
  minPoints,
  minLabel,
}: {
  amountInput: string
  configReady: boolean
  hasActiveOrder: boolean
  sessionAddressPresent: boolean
  isConnected: boolean
  parsedAmount: number
  minPoints: number
  minLabel: string
}): EntryValidationResult {
  if (!configReady) {
    return { ok: false, message: 'Buying points is temporarily unavailable.' }
  }
  if (hasActiveOrder) {
    return { ok: false, message: 'Finish or cancel the open order before starting a new one.' }
  }
  if (!sessionAddressPresent) {
    return { ok: false, message: 'Verify your wallet before buying points.' }
  }
  if (!isConnected) {
    return { ok: false, message: 'Connect your wallet to continue.' }
  }
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { ok: false, message: 'Enter how many points you want to buy.' }
  }
  if (parsedAmount < minPoints) {
    return { ok: false, message: `Buy at least ${minLabel} points.` }
  }
  return { ok: true, amount: parsedAmount }
}
