"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChallengeForm } from '@/components/challenge-modal/ChallengeForm'
import { ChallengeResultView } from '@/components/challenge-modal/ChallengeResult'
import { ChallengeBattleStage } from '@/components/challenge-modal/ChallengeBattleStage'
import { useChallengeFlow } from '@/components/challenge-modal/useChallengeFlow'
import type { ChallengeBattleError } from '@/components/challenge-modal/useChallengeFlow'
import type { ChallengeAvatarResolver } from '@/components/challenge-modal/avatarResolver'
import type { BattleLoot, PvpItem } from '@/types'
import { BATTLE_TERMS } from '@/src/shared/gameplay/status'
import { useBattleAlerts } from '@/components/challenge-modal/BattleAlertProvider'

type LoadoutState = Record<string, { weapon: PvpItem | null; shield: PvpItem | null }>

export type ChallengeLoadoutState = LoadoutState

type ChallengeParticipant = {
  address: string
  booster: number
  base: number
  roll: number
  pointsBefore: number
  pointsAfter: number
  weapon: PvpItem | null
  shield: PvpItem | null
}

type TransferSnapshot = {
  transfer: number
  house: number
  winnerGain: number
}

type ChallengeOpponent = {
  address: string
  maskedId: string
  displayHint: string
}

export type ChallengeResult = {
  winner: 'attacker' | 'defender'
  critical: boolean
  battleId?: number
  attacker: ChallengeParticipant
  opponent: ChallengeOpponent
  transfer: TransferSnapshot
  loot: BattleLoot[]
  cooldown?: { attacker?: string | null; defender?: string | null } | null
  cooldownEndsAt?: string | null
  executedAt: string
}

export type ChallengeHandlerResult =
  | { ok: true; result: ChallengeResult }
  | { ok: false; error: string; message?: string; cooldownUntil?: string | null }

export type ChallengeModalProps = {
  open: boolean
  myAddress: string
  loadouts: LoadoutState
  suggestedTargets: string[]
  initialTarget?: string | null
  onClose: () => void
  onSubmit: (target: string) => Promise<ChallengeHandlerResult>
  onEnergizeNow?: () => void
  resolveAvatarUrl?: ChallengeAvatarResolver
  minStake: number | null
  getStakeInfo: (address: string) => { balance: number | null; stakeReady: boolean; minStake: number | null }
  getPairCooldown?: (address: string) => number | null
  itemCatalog?: Record<number, PvpItem>
  refreshViewerLoadout?: (options?: { force?: boolean }) => Promise<any>
}

export default function ChallengeModal(props: ChallengeModalProps) {
  const {
    open,
    myAddress,
    loadouts,
    suggestedTargets,
    initialTarget,
    onClose,
    onSubmit,
    onEnergizeNow,
    resolveAvatarUrl,
    minStake,
    getStakeInfo,
    getPairCooldown,
    itemCatalog,
    refreshViewerLoadout,
  } = props

  const { showAlert, dismissAlert, beginBattleAttempt } = useBattleAlerts()
  const [dismissedStakeWarningTarget, setDismissedStakeWarningTarget] = useState<string | null>(null)
  const previousTargetRef = useRef<string | null>(null)
  const viewerLoadoutHydratingRef = useRef(false)
  const viewerLoadoutAttemptedRef = useRef(false)
  const [viewerLoadoutHydrating, setViewerLoadoutHydrating] = useState(false)

  const handleEnergizeAction = useCallback(() => {
    if (!onEnergizeNow) return
    onEnergizeNow()
  }, [onEnergizeNow])

  const handleBattleError = useCallback((error: ChallengeBattleError) => {
    const isEnergize = error.kind === 'energize'
    showAlert({
      type: isEnergize ? 'energize_required' : 'balance_insufficient',
      opponent: error.target,
      title: isEnergize ? '⚡ Nourish Required' : '💰 Insufficient Balance',
      message: error.message,
      actionLabel: '⚡ Nourish Now',
      onAction: handleEnergizeAction,
    })
  }, [handleEnergizeAction, showAlert])

  const flow = useChallengeFlow({
    open,
    myAddress,
    loadouts,
    suggestedTargets,
    initialTarget,
    onSubmit,
    resolveAvatarUrl,
    minStake,
    getStakeInfo,
    getPairCooldown,
    onBattleError: handleBattleError,
  })

  const myLoadout = loadouts[myAddress] || { weapon: null, shield: null }
  const myWeaponOp = myLoadout.weapon?.op ?? 0
  const myShieldDp = myLoadout.shield?.dp ?? 0
  const viewerLoadoutMissing = !loadouts[myAddress] || (!myLoadout.weapon && !myLoadout.shield)

  const stakeBlocked =
    flow.stakeInfo.balanceKnown &&
    !flow.stakeInfo.stakeReady &&
    flow.stakeInfo.minStake != null
  const stakeWarning = flow.stakeInfo.balanceKnown && !flow.stakeInfo.stakeReady && flow.stakeInfo.minStake != null
    ? `${BATTLE_TERMS.rewardDeficit.label}: requires ≥ ${flow.stakeInfo.minStake!.toLocaleString()} BlobCoin.`
    : null

  const formError = flow.formError
  const normalizedTarget = flow.normalizedTarget
  const clearFormError = flow.clearFormError
  const submitChallenge = flow.handleSubmit

  useEffect(() => {
    if (formError) {
      showAlert({
        type: 'generic',
        id: 'form-error',
        title: 'Battle Arena Error',
        message: formError,
      })
      clearFormError()
      return
    }
    if (stakeWarning && normalizedTarget && dismissedStakeWarningTarget !== normalizedTarget) {
      showAlert({
        type: 'stake_warning',
        id: 'stake-warning',
        title: 'Coverage Required',
        message: stakeWarning,
        actionLabel: '⚡ Nourish Now',
        opponent: normalizedTarget,
        onAction: handleEnergizeAction,
        onDismiss: () => setDismissedStakeWarningTarget(normalizedTarget),
      })
      return
    }
    if (!stakeWarning || !normalizedTarget) {
      dismissAlert()
    }
  }, [
    dismissAlert,
    dismissedStakeWarningTarget,
    clearFormError,
    formError,
    normalizedTarget,
    handleEnergizeAction,
    showAlert,
    stakeWarning,
  ])

  useEffect(() => {
    if (!stakeWarning) {
      setDismissedStakeWarningTarget(null)
    }
  }, [stakeWarning])

  useEffect(() => {
    if (previousTargetRef.current === normalizedTarget) return
    previousTargetRef.current = normalizedTarget
    setDismissedStakeWarningTarget(null)
  }, [normalizedTarget])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const body = document.body
    const prevOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    body.setAttribute('data-modal-open', 'true')
    return () => {
      window.removeEventListener('keydown', onKey)
      body.style.overflow = prevOverflow
      body.removeAttribute('data-modal-open')
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open || !refreshViewerLoadout || !viewerLoadoutMissing) return
    if (viewerLoadoutHydratingRef.current || viewerLoadoutAttemptedRef.current) return
    viewerLoadoutHydratingRef.current = true
    viewerLoadoutAttemptedRef.current = true
    setViewerLoadoutHydrating(true)
    refreshViewerLoadout({ force: true })
      .catch(() => {})
      .finally(() => {
        viewerLoadoutHydratingRef.current = false
        setViewerLoadoutHydrating(false)
      })
  }, [open, refreshViewerLoadout, viewerLoadoutMissing])

  useEffect(() => {
    if (open) return
    viewerLoadoutAttemptedRef.current = false
    viewerLoadoutHydratingRef.current = false
    setViewerLoadoutHydrating(false)
  }, [open])

  useEffect(() => {
    if (!viewerLoadoutMissing) {
      viewerLoadoutAttemptedRef.current = false
    }
  }, [viewerLoadoutMissing])

  const handleAddressInput = (value: string) => {
    flow.clearFormError()
    flow.setAddressInput(value.trim())
  }

  const handleSelectSuggestion = (value: string) => {
    flow.clearFormError()
    flow.setAddressInput(value.trim())
  }

  const handleFormSubmit = useCallback(async (event: FormEvent) => {
    setDismissedStakeWarningTarget(null)
    beginBattleAttempt()
    await submitChallenge(event)
  }, [beginBattleAttempt, submitChallenge])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[40000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Battle Arena atmospheric backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#1a0a2e] to-[#2d1b4e] backdrop-blur-[12px] transition-all duration-500"
        onClick={flow.stage === 'form' ? onClose : undefined}
        style={{
          backgroundImage: `
            linear-gradient(45deg, rgba(61,43,94,0.12) 1px, transparent 1px),
            linear-gradient(-45deg, rgba(61,43,94,0.12) 1px, transparent 1px)
          `,
          backgroundSize: '45px 45px'
        }}
      >
        {/* Large aurora-like gradient clouds */}
        <div className="absolute left-[5%] top-[10%] h-[180px] w-[180px] rounded-full bg-gradient-to-br from-[#bf40ff] to-[#7c3aed] blur-[80px] opacity-50" />
        <div className="absolute right-[8%] top-[15%] h-[220px] w-[220px] rounded-full bg-gradient-to-bl from-[#9d4edd] to-[#c026d3] blur-[90px] opacity-45" />
        <div className="absolute right-[20%] bottom-[20%] h-[160px] w-[160px] rounded-full bg-gradient-to-tr from-[#bf40ff] to-[#8b5cf6] blur-[75px] opacity-55" />
        <div className="absolute left-[15%] bottom-[15%] h-[200px] w-[200px] rounded-full bg-gradient-to-tl from-[#a855f7] to-[#9d4edd] blur-[85px] opacity-48" />

        {/* Smaller accent orbs */}
        <div className="absolute left-[35%] top-[25%] h-[100px] w-[100px] rounded-full bg-[#c084fc] blur-[60px] opacity-40" />
        <div className="absolute right-[30%] top-[35%] h-[120px] w-[120px] rounded-full bg-[#a78bfa] blur-[65px] opacity-38" />
        <div className="absolute left-[40%] bottom-[28%] h-[90px] w-[90px] rounded-full bg-[#bf40ff] blur-[55px] opacity-42" />

        {/* 4-point star glow - enhanced */}
        <div className="absolute bottom-[12%] right-[8%]">
          <div className="relative h-[80px] w-[80px]">
            <div className="absolute inset-0 rotate-0 bg-white blur-[45px] opacity-50" style={{ clipPath: 'polygon(50% 0%, 55% 45%, 100% 50%, 55% 55%, 50% 100%, 45% 55%, 0% 50%, 45% 45%)' }} />
            <div className="absolute inset-0 bg-[#bf40ff] blur-[50px] opacity-40" />
          </div>
        </div>

        {/* Additional sparkle stars */}
        <div className="absolute top-[18%] left-[8%]">
          <div className="relative h-[40px] w-[40px]">
            <div className="absolute inset-0 bg-white blur-[25px] opacity-35" style={{ clipPath: 'polygon(50% 0%, 55% 45%, 100% 50%, 55% 55%, 50% 100%, 45% 55%, 0% 50%, 45% 45%)' }} />
          </div>
        </div>

        {/* Particles - enhanced */}
        <div className="absolute left-[30%] top-[40%] h-[4px] w-[4px] rounded-full bg-[#c7b5ff] opacity-75 shadow-[0_0_8px_rgba(199,181,255,0.6)]" />
        <div className="absolute left-[60%] top-[25%] h-[3px] w-[3px] rounded-full bg-[#a78bfa] opacity-70 shadow-[0_0_6px_rgba(167,139,250,0.6)]" />
        <div className="absolute right-[30%] bottom-[40%] h-[4px] w-[4px] rounded-full bg-[#c084fc] opacity-70 shadow-[0_0_8px_rgba(192,132,252,0.6)]" />
        <div className="absolute left-[45%] bottom-[35%] h-[3px] w-[3px] rounded-full bg-[#8f7fb3] opacity-65 shadow-[0_0_6px_rgba(143,127,179,0.5)]" />
        <div className="absolute right-[40%] top-[30%] h-[4px] w-[4px] rounded-full bg-[#bf40ff] opacity-80 shadow-[0_0_8px_rgba(191,64,255,0.7)]" />
        <div className="absolute left-[25%] top-[55%] h-[3px] w-[3px] rounded-full bg-[#9d4edd] opacity-68 shadow-[0_0_6px_rgba(157,78,221,0.6)]" />
        <div className="absolute right-[50%] bottom-[50%] h-[3px] w-[3px] rounded-full bg-[#c7b5ff] opacity-72 shadow-[0_0_6px_rgba(199,181,255,0.6)]" />
      </div>
      <div className="pointer-events-none relative flex w-full max-w-[960px] justify-center px-3 sm:px-4">
        <div className="pointer-events-auto flex max-h-[95vh] w-full flex-col overflow-hidden rounded-system-lg border-2 border-[rgba(139,92,246,0.4)] bg-[rgba(19,8,32,0.98)] shadow-[0_22px_48px_rgba(139,92,246,0.3),0_44px_88px_rgba(14,3,30,0.7)] animate-in slide-in-from-bottom-4 duration-300">
          <div className="relative flex items-start justify-center px-6 pt-5">
            <div className="text-center">
              <div className="font-pressstart text-[11px] uppercase tracking-[0.14em] text-[#00d9ff]">⚔️ CHALLENGE</div>
              <div className="mt-1 text-[34px] font-pressstart font-bold leading-tight text-white">Battle Arena</div>
              <div className="mt-1 text-[13px] text-[#b8a6d9]">Select your opponent. Prepare for mystical combat.</div>
            </div>
            {flow.stage === 'form' && (
              <button type="button" onClick={onClose} className="btn-fantasy-ghost px-2 py-1 text-[11px] absolute right-6 top-5">
                Close
              </button>
            )}
          </div>

          {flow.copyMessage && (
            <div className="mt-3 text-center text-[11px] font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#c7b5ff]">
              {flow.copyMessage}
            </div>
          )}

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {flow.stage === 'form' ? (
              <ChallengeForm
                addressInput={flow.addressInput}
                normalizedTarget={flow.normalizedTarget}
                myAddress={myAddress}
                suggestions={flow.uniqueSuggestions}
                initialTarget={initialTarget}
                onSelectSuggestion={handleSelectSuggestion}
                onAddressInput={handleAddressInput}
                onSubmit={handleFormSubmit}
                onCopyAddress={flow.handleCopyToClipboard}
                formError={flow.formError}
                submitting={flow.submitting}
                risk={flow.risk}
                myAvatarUrl={flow.myAvatarUrl}
                opponentAvatarUrl={flow.opponentAvatarUrl}
                stakeBlocked={stakeBlocked}
                stakeWarning={stakeWarning}
                pairCooldownActive={flow.pairCooldownActive}
                pairCooldownLabel={flow.pairCooldownLabel}
                resolveAvatarUrl={resolveAvatarUrl}
                myOp={myWeaponOp}
                myDp={myShieldDp}
                loadoutHydrating={viewerLoadoutHydrating}
              />
            ) : flow.stage === 'battling' ? (
              <ChallengeBattleStage
                myAddress={myAddress}
                opponentAddress={flow.normalizedTarget}
                myAvatarUrl={flow.myAvatarUrl}
                opponentAvatarUrl={flow.opponentAvatarUrl}
                result={flow.result}
              />
            ) : (
              flow.result && (
                <ChallengeResultView
                  result={flow.result}
                  myAddressCanonical={myAddress}
                  onClose={onClose}
                  onNewChallenge={flow.handleNewChallenge}
                  itemCatalog={itemCatalog}
                  myAvatarUrl={flow.myAvatarUrl}
                  opponentAvatarUrl={flow.opponentAvatarUrl}
                />
              )
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .duel-avatar {
          position: relative;
          width: 180px;
          height: 180px;
          border-radius: 18px;
          border: 1px solid rgba(148, 93, 255, 0.35);
          background: radial-gradient(circle at 30% 30%, rgba(143, 247, 255, 0.12), rgba(19, 8, 32, 0.88));
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .duel-avatar-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }

        .duel-avatar-fallback {
          font-size: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .versus-icon {
          font-size: 32px;
          color: #ff9de1;
          filter: drop-shadow(0 0 10px rgba(255, 157, 225, 0.45));
        }
      `}</style>
    </div>
  )
}
