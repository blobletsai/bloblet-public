"use client"

import { useCallback, useEffect, useMemo, useState, memo } from 'react'

import { formatDisplayPoints } from '@/src/shared/points'
import type { PersonaBloblet, PersonaSession } from '@/src/client/persona/types'
import { useClientEventPublisher } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

type PersonaRenameCardProps = {
  bloblet: PersonaBloblet | null
  session: PersonaSession
  renameCost: number
  rewardBalance: number | null
  onRefresh: () => Promise<void> | void
  onTopUp?: () => void
}

function formatBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${formatDisplayPoints(value)} BC`
}

const EPSILON = 1e-6

const PersonaRenameCardComponent: React.FC<PersonaRenameCardProps> = ({
  bloblet,
  session,
  renameCost,
  rewardBalance,
  onRefresh,
  onTopUp,
}) => {
  const eventPublisher = useClientEventPublisher()
  const [name, setName] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setName(bloblet?.name ?? '')
  }, [bloblet?.name])

  const walletConnected = useMemo(() => !!session.address, [session.address])
  const holderOk = useMemo(() => session.isHolder, [session.isHolder])
  const insufficientBalance = useMemo(() => {
    if (rewardBalance == null) return false
    return rewardBalance + EPSILON < renameCost
  }, [renameCost, rewardBalance])

  const renameStatus = useMemo(() => {
    if (!walletConnected) {
      return { label: 'Connect wallet', tone: 'muted' as const }
    }
    if (!holderOk) {
      return { label: 'Holder verification required', tone: 'warn' as const }
    }
    if (insufficientBalance) {
      return { label: 'Need BlobCoin', tone: 'warn' as const }
    }
    return { label: 'BlobCoin ready', tone: 'ok' as const }
  }, [holderOk, insufficientBalance, walletConnected])

  const renameStatusClasses =
    renameStatus.tone === 'ok'
      ? 'border-[rgba(125,255,207,0.45)] bg-[rgba(12,40,32,0.5)] text-[#7dffcf]'
      : renameStatus.tone === 'warn'
      ? 'border-[rgba(255,118,118,0.5)] bg-[rgba(54,8,32,0.5)] text-[#ffb4c2]'
      : 'border-[rgba(148,93,255,0.35)] bg-[rgba(24,8,54,0.5)] text-[#c7b5ff]'

  const handleRename = useCallback(async () => {
    if (!walletConnected) {
      setError('Connect and verify your wallet first.')
      return
    }
    if (!holderOk) {
      setError(`Holder verification required (need ${renameCost.toLocaleString()} BC).`)
      return
    }
    if (insufficientBalance) {
      setError(`Not enough BlobCoin. Need ${formatDisplayPoints(renameCost)} BC.`)
      return
    }
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a name (max 32 characters).')
      return
    }
    if (trimmed.length > 32) {
      setError('Name must be 32 characters or fewer.')
      return
    }
    setSubmitting(true)
    setError(null)
    setNotice(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const resp = await fetch('/api/orders/intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          address: session.address,
          type: 'rename',
          source: 'persona_modal',
          params: { name: trimmed },
        }),
      })
      clearTimeout(timeoutId)
      const json = await resp.json().catch(() => null)
      if (!resp.ok) {
        if (resp.status >= 500) {
          setError('Server error. Please try again in a few moments.')
        } else if (resp.status === 402) {
          const deficit =
            json?.quoteAmount && json?.ledgerBalance != null
              ? Math.max(0, Number(json.quoteAmount) - Number(json.ledgerBalance))
              : renameCost
          setError(`Not enough BlobCoin. Need ${formatDisplayPoints(deficit)} BC.`)
        } else if (resp.status === 503) {
          setError('BlobCoin ledger temporarily unavailable. Try again in a moment.')
        } else {
          setError(json?.error || 'Rename failed. Please try again.')
        }
        return
      }

      setNotice(json?.message || 'Rename applied — BlobCoin debited instantly.')
      eventPublisher.emit(CLIENT_EVENT.ORDER_APPLIED, {
        type: 'rename',
        propId: null,
        orderId: json?.order?.id ?? null,
      })
      await onRefresh()
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Please try again.')
        } else if (err.message?.includes('fetch')) {
          setError('Network error. Check your connection and try again.')
        } else {
          setError(err.message || 'Rename failed. Please try again.')
        }
      } else {
        setError('Rename failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }, [eventPublisher, holderOk, insufficientBalance, name, onRefresh, renameCost, session.address, walletConnected])

  return (
    <div className="space-y-4">
      {!walletConnected ? (
        <div className="rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-4 py-3 text-[11px] text-yellow-100">
          Connect and verify a holder wallet to rename your bloblet.
        </div>
      ) : (
        <div className="rounded-2xl border border-[rgba(148,93,255,0.25)] bg-[rgba(8,2,30,0.55)] p-4 space-y-4">
          {!holderOk && (
            <div className="rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-100">
              Holder verification required.
            </div>
          )}
          {insufficientBalance && holderOk && (
            <div className="rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-[10px] text-yellow-100">
              Need {formatDisplayPoints(renameCost)} BC. Top up to continue.
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] uppercase tracking-[0.1em] text-fantasy-muted">
                New Name
              </label>
              <span className="text-[10px] text-fantasy-muted">
                {formatDisplayPoints(renameCost)} BC
              </span>
            </div>
            <input
              type="text"
              maxLength={32}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
                setNotice(null)
              }}
              placeholder={bloblet?.name || 'e.g. Star Voyager'}
              className="w-full rounded-lg border border-[rgba(140,105,255,0.35)] bg-[rgba(4,0,20,0.65)] px-3 py-2 text-sm text-white"
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-fantasy text-[11px]"
              onClick={handleRename}
              disabled={submitting || !holderOk || insufficientBalance}
            >
              {submitting ? 'Renaming…' : 'Apply Rename'}
            </button>
            {onTopUp && (
              <button
                type="button"
                className="btn-fantasy-ghost text-[11px]"
                onClick={onTopUp}
                disabled={submitting}
              >
                Buy BlobCoin
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[18px] border border-red-400/40 bg-red-900/40 px-4 py-3 text-[11px] text-red-100">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-[18px] border border-[rgba(125,255,207,0.35)] bg-[rgba(32,96,72,0.45)] px-4 py-3 text-[11px] text-[#7dffcf]">
          {notice}
        </div>
      )}
    </div>
  )
}

export const PersonaRenameCard = memo(PersonaRenameCardComponent)
