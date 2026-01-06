"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useHolderSession from '@/src/client/hooks/useHolderSession'
import { prepareBplayTokenAccount } from '@/src/client/solana/prepareAta'
import { explorerTxUrl } from '@/src/shared/explorer'
import { CLIENT_EVENT, type FaucetEventPayload } from '@/src/client/events/clientEventMap'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'

// Explorer URLs are resolved via the shared helper; keep legacy
// constants untouched elsewhere to avoid UI drift.
type Props = {
  compact?: boolean
  onRequestClose?: () => void
  autoDismiss?: boolean
}

type ClaimState = 'idle' | 'loading' | 'success' | 'already' | 'error'

type ClaimResponse = {
  status?: 'fulfilled' | 'already_claimed' | 'failed'
  tokenAmount?: number
  tokenTxHash?: string | null
  fulfilledAt?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

function shortHash(hash: string | null | undefined) {
  if (!hash) return null
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function explorerUrl(txHash: string | null | undefined) {
  return explorerTxUrl(txHash)
}

function failureCopyFromCode(code?: string | null, serverMessage?: string | null) {
  switch (code) {
    case 'no_ata':
      return 'Prepare your wallet for BPLAY (Phantom/Solflare → Token Accounts → Add) before retrying the faucet.'
    case 'insufficient_sol':
      return 'You need a tiny bit of SOL (~0.003) to create the BPLAY token account. Fund the wallet, prepare the account, then retry.'
    case 'mint_exhausted':
      return 'The faucet treasury is empty right now. Try again shortly.'
    case 'faucet_disabled':
      return 'Sandbox faucet is paused right now. Try again soon.'
    case 'address_blocked':
      return 'This wallet is blocked from claiming the sandbox faucet. Contact support if you believe this is an error.'
    case 'cooldown_active':
      return 'Faucet claim still processing. Give it a few seconds before retrying.'
    default:
      return serverMessage || 'Faucet request failed. Please try again.'
  }
}

export default function BplayFaucetButton({ compact = false, onRequestClose, autoDismiss = false }: Props) {
  const session = useHolderSession()
  const [state, setState] = useState<ClaimState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [txRefs, setTxRefs] = useState<{ token?: string | null }>({})
  const ataAttemptedRef = useRef(false)
  const disabled = !session.address || state === 'loading'

  const buildClientContext = useCallback(() => {
    if (typeof window === 'undefined') return {}
    const ctx: Record<string, any> = {
      locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
      timezone:
        typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
      platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
    }
    if (ataAttemptedRef.current) ctx.autoPreparedAta = true
    return ctx
  }, [])

  const label = useMemo(() => {
    if (!session.address) return 'Verify wallet to claim'
    switch (state) {
      case 'loading':
        return 'Dispensing play tokens…'
      case 'success':
        return 'Play tokens sent!'
      case 'already':
        return 'Play tokens ready'
      case 'error':
        return 'Retry faucet'
      default:
        return 'Request Play Tokens'
    }
  }, [session.address, state])

  // Deprecated: verification now flips automatically via the faucet banner hook when the sprite arrives

  const emitFaucetEvent = useCallback(
    (detail: Partial<Pick<FaucetEventPayload, 'faucetClaimStatus' | 'blobletLoaded'>>) => {
      const addr = session.address?.trim() || ''
      if (!addr) return
      emitClientEvent(CLIENT_EVENT.FAUCET, {
        address: addr,
        faucetClaimStatus: detail.faucetClaimStatus ?? null,
        blobletLoaded: detail.blobletLoaded,
        emittedAt: Date.now(),
      })
    },
    [session.address],
  )

  // No forced re-check; HUD flips automatically when sprite arrives (banner hook)

const handleClaim = useCallback(async () => {
    if (!session.address || state === 'loading') return
    setState('loading')
    setMessage(null)
    setTxRefs({})

    const attemptClaim = async (allowAtaRetry: boolean): Promise<void> => {
      try {
        const resp = await fetch('/api/faucet/claim', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clientContext: buildClientContext() }),
        })
        const data: ClaimResponse = await resp.json().catch(() => ({}))
        if (!resp.ok) {
          if (resp.status === 429) {
            setState('error')
            setMessage('Faucet cooling down. Try again shortly.')
            return
          }
          if (resp.status === 401) {
            setState('error')
            setMessage('Verify your wallet before requesting tokens.')
            return
          }
          if (resp.status === 403) {
            setState('error')
            setMessage('Wallet mismatch. Refresh and re-verify before claiming.')
            return
          }
          setState('error')
          setMessage('Faucet request failed. Please try again.')
          return
        }

        if (data.status === 'failed') {
          if (allowAtaRetry && data.errorCode === 'no_ata') {
            const prepared = await autoPrepareAta()
            if (prepared) {
              await attemptClaim(false)
              return
            }
            return
          }
          setState('error')
          setMessage(failureCopyFromCode(data.errorCode, data.errorMessage))
          setTxRefs({})
          console.warn('[faucet-button] faucet failed with code %s', data.errorCode)
          return
        }

        if (data.status === 'already_claimed') {
          setState('already')
          setMessage('This wallet already claimed the stipend. Use the arrival banner to refresh your bloblet once the timer finishes.')
          setTxRefs({ token: data.tokenTxHash || undefined })
          emitFaucetEvent({ faucetClaimStatus: 'already_claimed' })
          return
        }

        if (data.status === 'fulfilled') {
          setState('success')
          setMessage(
            data.tokenAmount
              ? `Sent ${Number(data.tokenAmount).toLocaleString()} BPLAY tokens. Watch the arrival banner above the Life Hub — when the timer hits 0, click Refresh to verify.`
              : 'Play token stipend sent! Watch the arrival banner above the Life Hub — when the timer hits 0, click Refresh to verify.',
          )
          setTxRefs({ token: data.tokenTxHash || undefined })
          emitFaucetEvent({ faucetClaimStatus: 'fulfilled' })
          return
        }

        setState('error')
        setMessage('Faucet responded unexpectedly. Please try again.')
      } catch (err) {
        console.error('[faucet-button] claim failed', err)
        setState('error')
        setMessage('Faucet request failed. Please try again.')
      }
    }

    const autoPrepareAta = async (): Promise<boolean> => {
      try {
        setMessage('Preparing your BPLAY account — confirm in wallet.')
        ataAttemptedRef.current = true
        const result = await prepareBplayTokenAccount()
        if (result.status === 'prepared') {
          setMessage('Account ready. Finalizing faucet claim…')
        } else {
          setMessage('Account already prepared. Finishing faucet claim…')
        }
        return true
      } catch (err: any) {
        const msg = String(err?.message || '')
        if (/reject/i.test(msg) || /cancel/i.test(msg)) {
          setState('error')
          setMessage('Account preparation cancelled in wallet. Approve the request to claim tokens.')
        } else {
          setState('error')
          setMessage('Account preparation failed. Create the BPLAY token account in your wallet and retry.')
        }
        console.error('[faucet-button] prepare ATA failed', err)
        return false
      }
    }

    attemptClaim(true)
  }, [buildClientContext, emitFaucetEvent, session.address, state])

  const helperText = useMemo(() => {
    if (!session.address) return 'Verify your wallet to receive the sandbox BPLAY stipend.'
    if (state === 'success') {
      return 'Tokens sent! Leave this panel open, then follow the arrival banner instructions to refresh once the timer finishes.'
    }
    if (state === 'already') {
      return 'This stipend was already claimed. Use the arrival banner to re-verify once the countdown ends.'
    }
    return 'One-time stipend per wallet. Convert the BPLAY into BlobCoin to begin playing.'
  }, [session.address, state])

  const messageClass = useMemo(() => {
    if (!message) return 'text-fantasy-muted'
    if (state === 'error') return 'text-rose-200'
    if (state === 'success' || state === 'already') return 'text-green-200'
    return 'text-fantasy-muted'
  }, [message, state])

  useEffect(() => {
    if (!autoDismiss || typeof onRequestClose !== 'function') return
    if (state !== 'success' && state !== 'already') return
    // Keep the panel open after success so players can review receipts.
    return () => {}
  }, [autoDismiss, onRequestClose, state])

  const statusChip = useMemo(() => {
    if (!session.address) return { label: 'Connect wallet', tone: 'bg-[#44285c] text-[#bca7ff]' }
    switch (state) {
      case 'loading':
        return { label: 'Dispensing…', tone: 'bg-[#473246] text-[#ffc46b]' }
      case 'success':
        return { label: 'Stipend sent', tone: 'bg-[#1f473c] text-[#7bffd6]' }
      case 'already':
        return { label: 'Already claimed', tone: 'bg-[#4b2e46] text-[#ff9de1]' }
      case 'error':
        return { label: 'Try again', tone: 'bg-[#4a252a] text-[#ff8fab]' }
      default:
        return { label: 'Ready', tone: 'bg-[#2f2f52] text-[#8ff7ff]' }
    }
  }, [session.address, state])

  const renderSuccessPanel = () => (
    <div className="rounded-3xl border border-[rgba(148,93,255,0.45)] bg-[rgba(30,12,66,0.7)] px-4 py-4 text-[11px] leading-relaxed text-fantasy-muted space-y-3">
      <div>
        <div className="font-pressstart text-[10px] uppercase tracking-[0.18em] text-[#7bffd6]">
          {state === 'success' ? 'Play tokens sent' : 'Already claimed'}
        </div>
        <p className="mt-1">
          {state === 'success'
            ? 'We’ll ping you above the Life Hub when your bloblet lands. Keep this card open to copy the receipt.'
            : 'This wallet has already claimed the sandbox stipend. Watch the reminder above the Life Hub for bloblet status.'}
        </p>
      </div>
      {txRefs.token && (
        <div className="space-y-1 text-[10px] uppercase tracking-[0.12em]">
          <a
            href={explorerUrl(txRefs.token) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#8ff7ff] hover:text-white"
          >
            <span className="font-pressstart">Solscan</span>
            <span className="text-fantasy-muted">({shortHash(txRefs.token)})</span>
          </a>
        </div>
      )}
      {typeof onRequestClose === 'function' && (
        <button type="button" onClick={onRequestClose} className="btn-fantasy-ghost w-full justify-center px-4 py-2 text-[11px]">
          Done
        </button>
      )}
    </div>
  )

  return (
    <div
      className={[
        'flex flex-col rounded-3xl border border-[rgba(148,93,255,0.35)] bg-[rgba(20,8,48,0.95)] px-4 py-4 shadow-[0_24px_64px_rgba(16,4,30,0.55)] backdrop-blur',
        compact ? 'max-w-[300px]' : 'max-w-[340px]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.24em] text-[#8ff7ff]">Sandbox Faucet</div>
            <span
              className={[
                'inline-flex items-center rounded-full px-2 py-1 text-[9px] font-pressstart uppercase tracking-[0.14em]',
                statusChip.tone,
              ].join(' ')}
            >
              {statusChip.label}
            </span>
            {typeof onRequestClose === 'function' && (
              <button
                type="button"
                onClick={onRequestClose}
                aria-label="Close faucet panel"
                className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full border border-transparent text-[13px] text-fantasy-muted transition hover:border-[rgba(255,255,255,0.25)] hover:text-fantasy-primary"
              >
                ×
              </button>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-fantasy-muted">{helperText}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {state === 'success' || state === 'already' ? (
          renderSuccessPanel()
        ) : (
          <>
            <button
              onClick={handleClaim}
              disabled={disabled}
              className={[
                'btn-fantasy w-full justify-center px-5 py-3 text-[12px]',
                disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {label}
            </button>
            {message && (
              <p aria-live="polite" className={['text-[11px] leading-relaxed', messageClass].join(' ')}>
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
