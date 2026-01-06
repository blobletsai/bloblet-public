import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeRisk } from '@/src/shared/pvp'
import type { PvpItem } from '@/types'
import type { ChallengeAvatarResolver } from './avatarResolver'
import type { ChallengeHandlerResult, ChallengeResult } from '@/components/ChallengeModal'
import { getSolanaAddressContext } from '@/src/shared/address/solana'

type LoadoutState = Record<string, { weapon: PvpItem | null; shield: PvpItem | null }>

export type ChallengeStage = 'form' | 'battling' | 'result'
export type ChallengeRisk = ReturnType<typeof computeRisk>

export type ChallengeFlowArgs = {
  open: boolean
  myAddress: string
  loadouts: LoadoutState
  suggestedTargets: string[]
  initialTarget?: string | null
  onSubmit: (target: string) => Promise<ChallengeHandlerResult>
  resolveAvatarUrl?: ChallengeAvatarResolver
  minStake?: number | null
  getStakeInfo?: (address: string) => { balance: number | null; stakeReady: boolean; minStake: number | null }
  onBattleError?: (error: ChallengeBattleError) => void
  getPairCooldown?: (address: string) => number | null
}

export type ChallengeFlowState = {
  addressInput: string
  setAddressInput: (value: string) => void
  normalizedTarget: string
  stage: ChallengeStage
  formError: string | null
  submitting: boolean
  result: ChallengeResult | null
  copyMessage: string | null
  uniqueSuggestions: string[]
  risk: ChallengeRisk
  myAvatarUrl: string | null
  opponentAvatarUrl: string | null
  handleSubmit: (event: React.FormEvent) => Promise<void>
  handleNewChallenge: () => void
  handleCopyToClipboard: (value: string | null | undefined) => Promise<void>
  clearFormError: () => void
  stakeInfo: { balance: number | null; balanceKnown: boolean; stakeReady: boolean; minStake: number | null }
  pairCooldownActive: boolean
  pairCooldownLabel: string | null
}

export type ChallengeBattleErrorKind = 'energize' | 'balance'

export type ChallengeBattleError = {
  code: string
  message: string
  target: string
  kind: ChallengeBattleErrorKind
}

type StakeInfoShape = {
  balance: number | null
  balanceKnown: boolean
  stakeReady: boolean
  minStake: number | null
}

type CanonicalAddressResult = {
  canonical: string
  empty: boolean
  valid: boolean
}

function canonicalizeAddress(value: string | null | undefined): CanonicalAddressResult {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    return { canonical: '', empty: true, valid: true }
  }
  try {
    const canonical = getSolanaAddressContext(trimmed).canonical
    return { canonical, empty: false, valid: true }
  } catch {
    return { canonical: '', empty: false, valid: false }
  }
}

function formatCooldownMessage(msRemaining: number): string {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) {
    return 'a few seconds'
  }
  const totalSeconds = Math.ceil(msRemaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  }
  return `${seconds}s`
}

export function useChallengeFlow(args: ChallengeFlowArgs): ChallengeFlowState {
  const {
    open,
    myAddress,
    loadouts,
  suggestedTargets,
  initialTarget,
  onSubmit,
  resolveAvatarUrl,
  minStake,
  getStakeInfo,
  onBattleError,
  getPairCooldown,
} = args

  const [addressInput, setAddressInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState<ChallengeStage>('form')
  const [result, setResult] = useState<ChallengeResult | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [cooldownNow, setCooldownNow] = useState(() => Date.now())

  const animationTimerRef = useRef<number | null>(null)

  const myAddressInfo = useMemo(() => canonicalizeAddress(myAddress), [myAddress])
  const myCanonical = myAddressInfo.valid ? myAddressInfo.canonical : ''
  const targetInfo = useMemo(() => canonicalizeAddress(addressInput), [addressInput])
  const normalizedTarget = targetInfo.canonical
  const targetInputEmpty = targetInfo.empty
  const targetInputValid = targetInfo.valid

  const myLoadout = useMemo(() => (myCanonical ? loadouts[myCanonical] || null : null), [loadouts, myCanonical])
  const targetLoadout = useMemo(
    () => (normalizedTarget ? loadouts[normalizedTarget] || null : null),
    [loadouts, normalizedTarget],
  )

  const myWeapon = myLoadout?.weapon || null
  const myShield = myLoadout?.shield || null
  const targetWeapon = targetLoadout?.weapon || null
  const targetShield = targetLoadout?.shield || null

  const attackStat = myWeapon?.op ?? 0
  const defenseStat = targetShield?.dp ?? 0
  const risk = useMemo(() => computeRisk(attackStat, defenseStat), [attackStat, defenseStat])

  const myAvatarUrl = useMemo(
    () => (resolveAvatarUrl ? resolveAvatarUrl(myCanonical) : null),
    [resolveAvatarUrl, myCanonical],
  )

  const opponentAvatarUrl = useMemo(
    () => (resolveAvatarUrl ? resolveAvatarUrl(normalizedTarget) : null),
    [resolveAvatarUrl, normalizedTarget],
  )

  const pairCooldownUntil = useMemo(() => {
    if (typeof getPairCooldown !== 'function' || !normalizedTarget) return null
    return getPairCooldown(normalizedTarget) ?? null
  }, [getPairCooldown, normalizedTarget])

  useEffect(() => {
    if (!pairCooldownUntil) return
    setCooldownNow(Date.now())
    const id = window.setInterval(() => setCooldownNow(Date.now()), 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [pairCooldownUntil])

  const pairCooldownActive = Boolean(pairCooldownUntil && pairCooldownUntil > cooldownNow)
  const pairCooldownLabel =
    pairCooldownActive && pairCooldownUntil
      ? `Rematch ready in ${formatCooldownMessage(pairCooldownUntil - cooldownNow)}`
      : null

  const stakeInfo = useMemo<StakeInfoShape>(() => {
    const min = typeof minStake === 'number' && minStake > 0 ? minStake : null
    if (!normalizedTarget || !targetInputValid) {
      return { balance: null, balanceKnown: false, stakeReady: targetInputValid, minStake: min }
    }
    if (typeof getStakeInfo === 'function') {
      return getStakeInfo(normalizedTarget) as StakeInfoShape
    }
    // Fallback when stake resolver is not provided (tests)
    return { balance: null, balanceKnown: false, stakeReady: true, minStake: min }
  }, [getStakeInfo, minStake, normalizedTarget, targetInputValid])

  useEffect(() => {
    if (!open) return
    setStage('form')
    setResult(null)
    setFormError(null)
    setSubmitting(false)
    setAddressInput(initialTarget ?? '')
  }, [open, initialTarget])

  useEffect(() => {
    if (!copyMessage) return
    const timeout = window.setTimeout(() => setCopyMessage(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [copyMessage])

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current)
        animationTimerRef.current = null
      }
    }
  }, [])

  const uniqueSuggestions = useMemo(() => {
    const seen = new Set<string>()
    return suggestedTargets.filter((addr) => {
      const info = canonicalizeAddress(addr)
      if (!info.valid || !info.canonical || seen.has(info.canonical) || info.canonical === myCanonical) {
        return false
      }
      seen.add(info.canonical)
      return true
    })
  }, [suggestedTargets, myCanonical])

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (targetInputEmpty) {
        setFormError('Please enter an opponent address')
        return
      }
      if (!targetInputValid) {
        setFormError('Enter a valid Solana address')
        return
      }
      const target = normalizedTarget
      if (!target) {
        setFormError('Enter a valid Solana address')
        return
      }
      if (target === myCanonical) {
        setFormError('Cannot challenge yourself')
        return
      }

      setFormError(null)
      setSubmitting(true)
      setStage('battling')

      try {
        const res = await onSubmit(target)
        if (res.ok) {
          setResult(res.result)
          animationTimerRef.current = window.setTimeout(() => {
            setStage('result')
            animationTimerRef.current = null
          }, 2000)
        } else {
          const errorMessage = res.message || res.error || 'Challenge failed'
          const normalizedCode = String(res.error || '').toLowerCase()
          const battleTarget = target
          const kind =
            normalizedCode === 'attacker_overdue'
              ? 'energize'
              : normalizedCode === 'attacker_balance_low'
                ? 'balance'
                : null
          if (kind && onBattleError && battleTarget) {
            onBattleError({ code: normalizedCode, message: errorMessage, target: battleTarget, kind })
            setFormError(null)
          } else {
            setFormError(errorMessage)
          }
          setStage('form')
        }
      } catch (err: any) {
        setFormError(err?.message || 'Network error')
        setStage('form')
      } finally {
        setSubmitting(false)
      }
    },
    [targetInputEmpty, targetInputValid, normalizedTarget, myCanonical, onSubmit, onBattleError],
  )

  const handleNewChallenge = useCallback(() => {
    setStage('form')
    setResult(null)
    setFormError(null)
    setAddressInput('')
  }, [])

  const handleCopyToClipboard = useCallback(async (value: string | null | undefined) => {
    const full = (value || '').trim()
    if (!full) return
    try {
      await navigator.clipboard.writeText(full)
      setCopyMessage('Address copied')
      return
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = full
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopyMessage('Address copied')
      } catch {
        setCopyMessage('Copy failed')
      }
    }
  }, [])

  const clearFormError = useCallback(() => setFormError(null), [])

  return {
    addressInput,
    setAddressInput,
    normalizedTarget,
    stage,
    formError,
    submitting,
    result,
    copyMessage,
    uniqueSuggestions,
    risk,
    myAvatarUrl,
    opponentAvatarUrl,
    handleSubmit,
    handleNewChallenge,
    handleCopyToClipboard,
    clearFormError,
    stakeInfo,
    pairCooldownActive,
    pairCooldownLabel,
  }
}
