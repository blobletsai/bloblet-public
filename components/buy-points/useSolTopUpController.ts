"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { LifeHubTopUpStatus } from '../life-hub/LifeHubProvider'
import type { TopUpAutoStatus } from './useTopUpViewState'
import { normalizeStatus } from './topUpOrderUtils'
import type { UseMarketOrderResult } from '@/src/client/hooks/useMarketOrder'
import { useLifeHub, EMPTY_TOP_UP_STATUS } from '../life-hub/LifeHubProvider'
import { useTopUpViewState } from './useTopUpViewState'
import { useTopUpSuccessFlowController, useLifeHubTopUpStatusController } from './useTopUpOrderController'
import { useHolderSession } from '@/src/client/hooks/useHolderSession'
import { normalizeLedgerPoints, rewardLedgerDecimals, solanaTokenDecimals, tokenAmountToLedgerPoints } from '@/src/shared/points'
import { resolvePublicEconomyConfig } from '@/src/config/economy'
import { solanaConfig } from '@/src/config/solana'
import { getSolRpcUrl, getSolanaProvider } from '@/src/client/solana/provider'
import { Connection, PublicKey } from '@solana/web3.js'

import type { RewardsModalConfig } from '../rewards-modal/types'

type Options = {
  open: boolean
  onClose: () => void
  rewardsConfig?: RewardsModalConfig
  onRewardsUpdated?: (options?: { silent?: boolean }) => Promise<unknown>
}

const PUBLIC_ECONOMY_CONFIG = resolvePublicEconomyConfig()
const FALLBACK_GATE_MIN_TOKENS = Number(PUBLIC_ECONOMY_CONFIG.gate.minTokens || 0)
const SOLANA_TOKEN_MINT = solanaConfig.token.mint
const SOLANA_TREASURY = solanaConfig.treasury.publicKey
const MIN_SOL_LAMPORTS = 2_000_000 // 0.002 SOL

export function useSolTopUpController({ open, onClose, rewardsConfig, onRewardsUpdated }: Options) {
  const lifeHub = useLifeHub(true)
  const session = useHolderSession()
  const prevSessionAddressRef = useRef<string | null>(session.address)
  const userEditedAmountRef = useRef(false)

  const minPoints = useMemo(() => {
    const configuredMin = Number(rewardsConfig?.rewardTopUpMin)
    if (Number.isFinite(configuredMin) && configuredMin > 0) return Number(configuredMin)
    const fallback = Number(rewardsConfig?.minTokens)
    if (Number.isFinite(fallback) && fallback > 0) return Number(fallback)
    return 1
  }, [rewardsConfig?.minTokens, rewardsConfig?.rewardTopUpMin])
  const minLabel = useMemo(() => minPoints.toLocaleString(), [minPoints])

  // Balance + gate labels for entry view
  const gateLabel = useMemo(() => {
    const gate = Number(
      rewardsConfig?.minTokens != null ? rewardsConfig.minTokens : FALLBACK_GATE_MIN_TOKENS,
    )
    return gate > 0 ? `Gate: ${gate.toLocaleString()} tokens` : null
  }, [rewardsConfig?.minTokens])
  const tokenBalanceLabel = session.tokenBalance != null ? session.tokenBalance.toLocaleString() : null
  const sessionTokenDecimals = typeof session.tokenDecimals === 'number' && Number.isFinite(session.tokenDecimals)
    ? session.tokenDecimals
    : null

  const order = require('@/src/client/hooks/useMarketOrder').useMarketOrder({
    address: session.address || '',
    pollIntervalMs: 4000,
  }) as UseMarketOrderResult

  const {
    state,
    loading,
    confirming,
    transferring,
    notice,
    pollDelayMs,
    history,
    locked,
    canCancel,
    phase,
    createOrder,
    payOrder,
    confirmOrder,
    cancelOrder,
    reset,
    setReason,
  } = order

  const hasActiveOrder = Boolean(state.orderId && locked)
  const statusLower = normalizeStatus(state.status)

  const {
    view,
    setView,
    amountInput,
    setAmountInput,
    entryError,
    setEntryError,
    submitting,
    setSubmitting,
    canceling,
    setCanceling,
    successAmount,
    setSuccessAmount,
    successBalance,
    setSuccessBalance,
    successLoading,
    setSuccessLoading,
    successError,
    setSuccessError,
    autoStatus,
    setAutoStatus,
    appliedHandledRef,
    reset: resetViewState,
  } = useTopUpViewState({
    onClearReason: () => setReason(null),
    onResetLifeHub: () => lifeHub?.setTopUpStatus?.(EMPTY_TOP_UP_STATUS),
  })

  const amountNumber = useMemo(() => {
    if (!amountInput.trim()) return NaN
    const parsed = Number(amountInput)
    if (!Number.isFinite(parsed)) return NaN
    return parsed
  }, [amountInput])

  const readyForEntry = !session.loading && !!session.address
  const amountValid = readyForEntry && Number.isFinite(amountNumber) && amountNumber > 0 && amountNumber >= minPoints

  const prevOpenRef = useRef(open)
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    if (!open && wasOpen) {
      resetViewState()
      userEditedAmountRef.current = false
    }
    prevOpenRef.current = open
    if (!open) return
    if (!state.orderId || statusLower === 'applied') return
    setView('payment')
  }, [open, resetViewState, setView, state.orderId, statusLower])

  useEffect(() => {
    if (!open) return
    if (amountInput.trim()) return
    if (!Number.isFinite(minPoints) || minPoints <= 0) return
    if (userEditedAmountRef.current) return
    setAmountInput(String(minPoints))
  }, [amountInput, minPoints, open, setAmountInput])

  useEffect(() => {
    if (statusLower === 'applied') return
    if (view === 'payment' && !state.orderId) {
      setView('entry')
    }
  }, [setView, state.orderId, statusLower, view])

  const handleRewardsUpdated = useCallback(() => {
    if (!onRewardsUpdated) return
    onRewardsUpdated({ silent: true }).catch(() => {})
  }, [onRewardsUpdated])

  const fallbackFetchRewardBalance = useCallback(async () => {
    try {
      const resp = await fetch('/api/rewards/me', { credentials: 'same-origin' })
      if (!resp.ok) return null
      const json = await resp.json().catch(() => null)
      if (!json) return null
      if (typeof json.balance === 'number' && Number.isFinite(json.balance)) {
        return Number(json.balance)
      }
      const balanceRaw = Number(json?.balanceRaw)
      const decimals = Number(json?.decimals)
      if (Number.isFinite(balanceRaw) && Number.isFinite(decimals)) {
        return normalizeLedgerPoints(balanceRaw, Math.max(0, Math.floor(decimals)))
      }
      return null
    } catch {
      return null
    }
  }, [])

  const rewardBalanceFetcher = lifeHub?.fetchRewardBalance ?? fallbackFetchRewardBalance

  useTopUpSuccessFlowController({
    open,
    state,
    history,
    onTransitionToSuccess: () => setView('success'),
    setSuccessAmount,
    setSuccessBalance,
    setSuccessLoading,
    setSuccessError,
    setAutoStatus,
    autoEnergizeAfterTopUp: false,
    appliedHandledRef,
    fetchRewardBalance: rewardBalanceFetcher,
    onAfterSuccess: handleRewardsUpdated,
  })

  useLifeHubTopUpStatusController({
    lifeHub,
    open,
    hasActiveOrder,
    statusLower,
    autoStatus,
    notice,
    phase,
    orderId: Number.isFinite(state.orderId) ? Number(state.orderId) : null,
    successError,
  })

  const handleModalClose = useCallback(() => {
    if (state.orderId && normalizeStatus(state.status) !== 'applied') {
      cancelOrder().catch(() => {})
    }
    reset()
    resetViewState()
    userEditedAmountRef.current = false
    onClose()
  }, [cancelOrder, onClose, reset, resetViewState, state.orderId, state.status])

  const handleAmountChange = useCallback((value: string) => {
    userEditedAmountRef.current = true
    const normalized = value.replace(',', '.')
    if (/^[0-9]*\.?[0-9]*$/.test(normalized) || normalized === '') {
      setAmountInput(normalized)
      setEntryError(null)
      setReason(null)
    }
  }, [setAmountInput, setEntryError, setReason])

  const gateMinTokens = useMemo(() => {
    const gate = Number(rewardsConfig?.minTokens != null ? rewardsConfig.minTokens : FALLBACK_GATE_MIN_TOKENS)
    return Number.isFinite(gate) && gate > 0 ? gate : 0
  }, [rewardsConfig?.minTokens])

  const [computingMax, setComputingMax] = useState(false)

  const handleBuyMax = useCallback(async () => {
    userEditedAmountRef.current = true
    if (computingMax) return
    setComputingMax(true)
    setEntryError(null)
    try {
      const owner = session.address
      if (!owner) {
        setEntryError('Verify your wallet before buying points.')
        return
      }
      const provider = getSolanaProvider()
      const ownerAddress = provider?.publicKey?.toString() || owner
      const conn = new Connection(getSolRpcUrl(), { commitment: 'confirmed' })
      const ownerPk = new PublicKey(ownerAddress)
      const mintPk = new PublicKey(SOLANA_TOKEN_MINT)
      const [solLamports, tokenAccounts] = await Promise.all([
        conn.getBalance(ownerPk, 'confirmed'),
        conn.getParsedTokenAccountsByOwner(ownerPk, { mint: mintPk }),
      ])
      let tokenRaw = 0n
      let tokenDecimals = sessionTokenDecimals != null ? sessionTokenDecimals : solanaTokenDecimals()
      for (const it of tokenAccounts.value || []) {
        const amountStr = String(it?.account?.data?.parsed?.info?.tokenAmount?.amount ?? '0')
        let amt = 0n
        try { amt = BigInt(amountStr) } catch { amt = 0n }
        tokenRaw += amt
        const decCandidate = Number(it?.account?.data?.parsed?.info?.tokenAmount?.decimals)
        if (Number.isFinite(decCandidate) && decCandidate >= 0) {
          tokenDecimals = Math.max(0, Math.floor(decCandidate))
        }
      }
      const ledgerBalance = tokenAmountToLedgerPoints(tokenRaw, tokenDecimals, rewardLedgerDecimals())
      const available = Math.floor(ledgerBalance - gateMinTokens)
      if (available <= 0) {
        setEntryError('Not enough tokens after keeping your entry balance.')
        return
      }
      if (solLamports < MIN_SOL_LAMPORTS) {
        setEntryError('Need at least 0.002 SOL for fees before buying.')
        return
      }
      setAmountInput(String(available))
    } catch (err: any) {
      setEntryError('Could not fetch live balance. Try again.')
    } finally {
      setComputingMax(false)
    }
  }, [computingMax, gateMinTokens, session.address, sessionTokenDecimals, setAmountInput, setEntryError])

  useEffect(() => {
    if (!session.loading && session.address) {
      setEntryError((prev) => (prev === 'Checking wallet verification…' ? null : prev))
    }
  }, [session.address, session.loading, setEntryError])

  useEffect(() => {
    const previousAddress = prevSessionAddressRef.current
    prevSessionAddressRef.current = session.address
    if (!open) return
    if (session.loading) return
    if (previousAddress && !session.address) {
      reset()
      resetViewState()
      setView('entry')
      const message = session.lastFailureReason === 'expired'
        ? 'Session expired — verify your wallet before buying points.'
        : 'Verify your wallet before buying points.'
      setEntryError(message)
      setReason('session_expired')
    }
  }, [open, reset, resetViewState, session.address, session.lastFailureReason, session.loading, setEntryError, setReason, setView])

  const handleStartPayment = useCallback(async () => {
    const parsed = Number(amountNumber)
    if (session.loading) {
      setEntryError('Checking wallet verification…')
      return
    }
    if (!session.address) { setEntryError('Verify your wallet before buying points.'); return }
    if (!Number.isFinite(parsed) || parsed <= 0) { setEntryError('Enter how many points you want to buy.'); return }
    if (parsed < minPoints) { setEntryError(`Buy at least ${minLabel} points.`); return }
    setSubmitting(true)
    setEntryError(null)
    try {
      const result = await createOrder({ amount: parsed })
      if (!result.ok) { setEntryError(state.reason || 'Order could not be created. Try again.'); return }
      setView('payment')
    } finally { setSubmitting(false) }
  }, [amountNumber, createOrder, minLabel, minPoints, session.address, session.loading, setEntryError, setSubmitting, setView, state.reason])

  const handleAmountSubmit = useCallback(() => { handleStartPayment().catch(() => {}) }, [handleStartPayment])
  const handleResumeOrder = useCallback(() => { setEntryError(null); setView('payment') }, [setEntryError, setView])
  const handleCancelExisting = useCallback(async () => {
    setCanceling(true)
    try {
      const r = await cancelOrder()
      if (r.ok) {
        reset()
        resetViewState()
      }
    } finally {
      setCanceling(false)
    }
  }, [cancelOrder, reset, resetViewState, setCanceling])
  const handleFinish = useCallback(() => { reset(); resetViewState(); userEditedAmountRef.current = false; onClose() }, [onClose, reset, resetViewState])
  const handleBuyMore = useCallback(() => { reset(); resetViewState(); userEditedAmountRef.current = false; setView('entry') }, [reset, resetViewState, setView])

  const handlePayOrder = useCallback(async () => {
    // mint/treasury/decimals are resolved server-side during confirm; client hints are optional
    const mint = SOLANA_TOKEN_MINT
    const decimals = sessionTokenDecimals != null ? sessionTokenDecimals : solanaTokenDecimals()
    const treasury = SOLANA_TREASURY
    const provider = getSolanaProvider()
    const ownerAddress = provider?.publicKey?.toString()
    try {
      if (ownerAddress) {
        const conn = new Connection(getSolRpcUrl(), { commitment: 'confirmed' })
        const lamports = await conn.getBalance(new PublicKey(ownerAddress), 'confirmed')
        if (lamports < MIN_SOL_LAMPORTS) {
          setReason('Need at least 0.002 SOL for fees before buying.')
          return
        }
      }
    } catch {
      // If balance check fails, continue to attempt payment; payOrder will surface errors if any.
    }
    await payOrder({ tokenAddress: mint, tokenDecimals: decimals, treasuryAddress: treasury })
  }, [payOrder, sessionTokenDecimals, setReason])

  const handleRetryConfirm = useCallback(async () => { const sig = state.signature as string | null | undefined; if (!sig) return; await confirmOrder(sig) }, [confirmOrder, state.signature])

  return {
    open,
    view,
    hasActiveOrder,
    loading,
    submitting,
    canceling,
    amountInput,
    amountValid,
    minLabel,
    tokenBalanceLabel,
    gateLabel,
    entryError,
    successAmountLabel: successAmount != null ? successAmount.toLocaleString() : null,
    successBalanceLabel: successBalance != null ? successBalance.toLocaleString() : null,
    successLoading,
    successError,
    autoStatus,
    payment: {
      state,
      phase,
      history,
      notice,
      pollDelayMs,
      confirming,
      transferring,
      canCancel,
      mint: SOLANA_TOKEN_MINT,
      decimals: sessionTokenDecimals != null ? sessionTokenDecimals : solanaTokenDecimals(),
      treasuryWallet: SOLANA_TREASURY,
      onPay: handlePayOrder,
      onRetryConfirm: state.signature ? handleRetryConfirm : undefined,
      onCancel: canCancel ? handleCancelExisting : undefined,
    },
    handlers: {
      handleModalClose,
      handleAmountChange,
      handleAmountSubmit,
      handleBuyMax,
      handleResumeOrder,
      handleCancelExisting,
      handleFinish,
      handleBuyMore,
    },
    computingMax,
  }
}
