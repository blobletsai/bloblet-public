"use client"

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'

import { formatDisplayPoints } from '@/src/shared/points'
import { normalizeStatus, isTerminalStatus } from '@/src/client/hooks/orders/orderTypes'
import { useAvatarOrder } from '@/src/client/hooks/persona/useAvatarOrder'
import type { PersonaSession } from '@/src/client/persona/types'
import { assetConfig } from '@/src/config/assets'

type PersonaAvatarCardProps = {
  session: PersonaSession
  rewardBalance: number | null
  avatarCost: number
  currentAvatarUrl: string | null
  onRefresh: () => Promise<void> | void
  onTopUp?: () => void
}

const EPSILON = 1e-6
const DEFAULT_AVATAR_SPRITE = assetConfig.sprites.defaultAlive

function formatBalance(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${formatDisplayPoints(value)} BC`
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued for worker…',
  generating: 'Rendering preview…',
  confirmed: 'Rendering preview…',
  alive_ready: 'Preview ready. Apply when you are happy with it.',
  generated: 'Preview ready. Apply when you are happy with it.',
  applied: 'Applied ✓',
  expired: 'Order cancelled. Start a new request.',
  rejected: 'Order rejected. Adjust your prompt and try again.',
}

type PreviewSlotProps = {
  label: string
  url: string | null
  status: string
}

const PreviewSlot: React.FC<PreviewSlotProps> = ({ label, url, status }) => (
  <div className="space-y-2">
    <div className="text-[11px] text-fantasy-muted uppercase tracking-[0.1em]">{label}</div>
    {url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${label} preview`}
        className="w-full rounded border border-[rgba(148,93,255,0.35)] bg-black/30 object-contain"
        style={{ imageRendering: 'pixelated' as const }}
      />
    ) : (
      <div className="flex h-40 flex-col items-center justify-center rounded border border-[rgba(148,93,255,0.35)] bg-[rgba(16,6,40,0.6)] text-center text-[10px] text-fantasy-muted">
        {status || 'Preview will appear here once ready.'}
      </div>
    )}
  </div>
)

const PersonaAvatarCardComponent: React.FC<PersonaAvatarCardProps> = ({
  session,
  rewardBalance,
  avatarCost,
  currentAvatarUrl,
  onRefresh,
  onTopUp,
}) => {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const lastStatusRef = useRef<string | null>(null)

  const { order, tracking, refreshing, beginTracking, refreshStatus, reset } = useAvatarOrder({
    address: session.address || null,
  })

  const statusNormalized = normalizeStatus(order?.status)
  const previewReady = statusNormalized === 'alive_ready' || statusNormalized === 'generated'
  const hasActiveOrder = tracking || Boolean(order && !isTerminalStatus(statusNormalized))

  const insufficientBalance = useMemo(() => {
    if (rewardBalance == null) return false
    return rewardBalance + EPSILON < avatarCost
  }, [avatarCost, rewardBalance])

  const rewardStatus = useMemo(() => {
    if (!session.address) {
      return { label: 'Connect wallet', tone: 'muted' as const }
    }
    if (!session.isHolder) {
      return { label: 'Holder verification required', tone: 'warn' as const }
    }
    if (insufficientBalance && !hasActiveOrder) {
      return { label: 'Need BlobCoin', tone: 'warn' as const }
    }
    if (hasActiveOrder) {
      return { label: 'Preview in progress', tone: 'ok' as const }
    }
    return { label: 'BlobCoin ready', tone: 'ok' as const }
  }, [hasActiveOrder, insufficientBalance, session.address, session.isHolder])

  const rewardStatusClasses =
    rewardStatus.tone === 'ok'
      ? 'border-[rgba(125,255,207,0.45)] bg-[rgba(12,40,32,0.45)] text-[#7dffcf]'
      : rewardStatus.tone === 'warn'
      ? 'border-[rgba(255,118,118,0.5)] bg-[rgba(54,8,32,0.45)] text-[#ffb4c2]'
      : 'border-[rgba(148,93,255,0.35)] bg-[rgba(24,8,54,0.45)] text-[#c7b5ff]'

  useEffect(() => {
    const status = normalizeStatus(order?.status)
    if (!status) {
      setNotice(null)
      lastStatusRef.current = null
      return
    }

    if (status === 'applied' && lastStatusRef.current !== 'applied') {
      setNotice('Avatar applied — BlobCoin debited instantly.')
      Promise.resolve(onRefresh()).catch(() => {})
    } else if (status !== 'confirmed' && status !== lastStatusRef.current) {
      const label = STATUS_LABELS[status]
      if (label) setNotice(label)
    }

    lastStatusRef.current = status
  }, [onRefresh, order?.id, order?.status])

  const handleCreate = useCallback(async () => {
    if (!session.address) {
      setError('Connect and verify your wallet first.')
      return
    }
    if (!session.isHolder) {
      setError('Only verified holders can request custom avatars.')
      return
    }
    const trimmed = prompt.trim()
    if (trimmed.length < 3) {
      setError('Describe the upgrade (minimum 3 characters).')
      return
    }
    if (hasActiveOrder) {
      setError('Preview still rendering. Finalize or wait before starting another.')
      return
    }
    // Note: Balance check removed - preview generation is free, users pay only when they apply

    setSubmitting(true)
    setError(null)
    setNotice(null)
    setCancelling(false)

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
          type: 'avatar_custom',
          params: { promptRaw: trimmed },
          source: 'persona_modal',
        }),
      })
      clearTimeout(timeoutId)
      const json = await resp.json().catch(() => null)
      if (!resp.ok) {
        if (resp.status >= 500) {
          setError('Server error. Please try again in a few moments.')
          return
        }
        if (resp.status === 402) {
          const quote = Number(json?.quoteAmount ?? avatarCost)
          const balance = Number(json?.ledgerBalance ?? rewardBalance ?? 0)
          const deficit = Math.max(0, quote - balance)
          setError(`Not enough BlobCoin. Need ${formatDisplayPoints(deficit || quote)} BC.`)
          return
        }
        if (resp.status === 503) {
          setError('BlobCoin ledger unavailable. Try again soon.')
          return
        }
        setError(json?.error || 'Custom avatar request failed. Please try again.')
        return
      }

      setNotice(json?.message || 'Avatar ordered — preview will appear here once ready.')
      setPrompt('')
      beginTracking(json?.order)
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Please try again.')
        } else if (err.message?.includes('fetch')) {
          setError('Network error. Check your connection and try again.')
        } else {
          setError(err.message || 'Custom avatar request failed. Please try again.')
        }
      } else {
        setError('Custom avatar request failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }, [
    avatarCost,
    beginTracking,
    hasActiveOrder,
    prompt,
    rewardBalance,
    session.address,
    session.isHolder,
  ])

  const handleFinalize = useCallback(async () => {
    if (!order?.id) return
    const aliveUrl = order.previewAliveUrl || null
    const addressCanonical = String(session.address || '').trim()
    setFinalizing(true)
    setError(null)
    setNotice(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const resp = await fetch('/api/orders/finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ orderId: order.id }),
      })
      clearTimeout(timeoutId)
      const json = await resp.json().catch(() => null)
      if (!resp.ok) {
        if (resp.status >= 500) {
          setError('Server error. Please try again in a few moments.')
        } else {
          setError(json?.error || 'Finalize failed. Please try again.')
        }
        return
      }
      beginTracking({
        id: order.id,
        status: 'applied',
        previewAliveUrl: order.previewAliveUrl,
        reason: order.reason,
        appliedAt: new Date().toISOString(),
      })
      if (addressCanonical && aliveUrl) {
        try {
          const addFn =
            typeof window !== 'undefined'
              ? (window as any).BlobletsWorld_addSprites
              : undefined
          if (typeof addFn === 'function') {
            const update = addFn([
              {
                address: addressCanonical,
                alive: true,
                aliveUrl,
                replace: true,
              },
            ])
            if (update && typeof (update as Promise<unknown>).then === 'function') {
              ;(update as Promise<unknown>).catch((err) => {
                console.warn('[persona] sprite update promise rejected', err)
              })
            }
          }
        } catch (err) {
          console.warn('[persona] failed to push avatar update to canvas', err)
        }
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Please try again.')
        } else if (err.message?.includes('fetch')) {
          setError('Network error. Check your connection and try again.')
        } else {
          setError(err.message || 'Finalize failed. Please try again.')
        }
      } else {
        setError('Finalize failed. Please try again.')
      }
    } finally {
      setFinalizing(false)
    }
  }, [beginTracking, order, session.address])

  const handleCancel = useCallback(async () => {
    const orderId = order?.id
    if (!orderId) return
    setCancelling(true)
    setError(null)
    setNotice(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const resp = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ orderId }),
      })
      clearTimeout(timeoutId)
      const json = await resp.json().catch(() => null)
      if (!resp.ok) {
        if (resp.status >= 500) {
          setError('Server error. Please try again in a few moments.')
        } else {
          setError(json?.error || 'Cancel failed. Please try again.')
        }
        return
      }
      beginTracking({
        id: orderId,
        status: 'expired',
        reason: json?.reason || 'cancelled_by_user',
      })
      setNotice('Order cancelled. Start a new request.')
      Promise.resolve(onRefresh()).catch(() => {})
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Please try again.')
        } else if (err.message?.includes('fetch')) {
          setError('Network error. Check your connection and try again.')
        } else {
          setError(err.message || 'Cancel failed. Please try again.')
        }
      } else {
        setError('Cancel failed. Please try again.')
      }
    } finally {
      setCancelling(false)
    }
  }, [beginTracking, onRefresh, order?.id])

  const handleRefreshStatus = useCallback(() => {
    void refreshStatus()
  }, [refreshStatus])

  const handleReset = useCallback(() => {
    reset()
    setCancelling(false)
    setNotice(null)
    setError(null)
    setPrompt('')
  }, [reset])

  useEffect(() => {
    if (!session.address) {
      reset()
      setNotice(null)
      setError(null)
      setPrompt('')
      setCancelling(false)
    }
  }, [reset, session.address])

  const statusLabel =
    statusNormalized && STATUS_LABELS[statusNormalized]
      ? STATUS_LABELS[statusNormalized]
      : order?.status
      ? order.status.replace(/_/g, ' ')
      : 'No active order'

  const heroUrl = order?.previewAliveUrl || currentAvatarUrl || DEFAULT_AVATAR_SPRITE

  const canSubmit =
    Boolean(session.address && session.isHolder) &&
    !submitting &&
    !finalizing &&
    !cancelling &&
    !refreshing &&
    !hasActiveOrder &&
    prompt.trim().length >= 3

  const finalizeReady = !!order && previewReady
  const terminalOrder =
    !!order &&
    (statusNormalized === 'applied' ||
      statusNormalized === 'expired' ||
      statusNormalized === 'rejected')

  const submitLabel = submitting
    ? 'Submitting…'
    : hasActiveOrder
    ? previewReady
      ? 'Preview ready'
      : 'Preview rendering…'
    : 'Generate Preview (Free)'

  return (
    <div className="space-y-4">
      {!session.address ? (
        <div className="rounded-2xl border border-yellow-400/35 bg-yellow-500/10 px-4 py-3 text-[12px] text-yellow-100">
          Connect and verify a holder wallet to request a custom avatar.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Compact horizontal layout */}
          <div className="rounded-2xl border border-[rgba(148,93,255,0.25)] bg-[rgba(8,2,30,0.55)] p-4">
            <div className="grid gap-4 md:grid-cols-[280px,1fr]">
              {/* Preview side */}
              <div className="space-y-3">
                <div className="flex items-center justify-center rounded-xl bg-[rgba(12,0,46,0.3)] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order?.previewAliveUrl || heroUrl}
                    alt="Avatar preview"
                    className="max-h-[240px] w-auto rounded-lg object-contain"
                    style={{ imageRendering: 'pixelated' as const }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="rounded-full border border-[rgba(148,93,255,0.35)] px-3 py-1 text-[10px] text-fantasy-muted truncate">
                    {statusLabel}
                  </div>
                  {order && (
                    <button
                      type="button"
                      className="btn-fantasy-ghost px-2 py-1 text-[10px] flex-shrink-0"
                      onClick={handleRefreshStatus}
                      disabled={refreshing || finalizing || cancelling || terminalOrder}
                      title="Refresh status"
                    >
                      {refreshing ? '↻' : '↻'}
                    </button>
                  )}
                </div>
                {statusNormalized === 'applied' && (
                  <div className="rounded-full border border-[rgba(123,255,214,0.35)] bg-[rgba(123,255,214,0.12)] px-3 py-1 text-center font-pressstart text-[9px] uppercase tracking-[0.14em] text-[#7bffd6]">
                    Applied ✓
                  </div>
                )}
              </div>

              {/* Form side */}
              <div className="space-y-3">
                {/* BC Balance Display */}
                {rewardBalance != null && (
                  <div className="rounded-xl border border-[rgba(148,93,255,0.3)] bg-[rgba(24,8,54,0.5)] px-3 py-2">
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div>
                        <div className="text-fantasy-muted uppercase tracking-wider mb-1">Balance</div>
                        <div className="text-[#c7b5ff] font-medium">{formatDisplayPoints(rewardBalance)} BC</div>
                      </div>
                      <div>
                        <div className="text-fantasy-muted uppercase tracking-wider mb-1">Cost</div>
                        <div className="text-[#c7b5ff] font-medium">{formatDisplayPoints(avatarCost)} BC</div>
                      </div>
                      <div>
                        <div className="text-fantasy-muted uppercase tracking-wider mb-1">After Apply</div>
                        <div className={`font-medium ${rewardBalance - avatarCost >= 0 ? 'text-[#7dffcf]' : 'text-[#ffb4c2]'}`}>
                          {formatDisplayPoints(Math.max(0, rewardBalance - avatarCost))} BC
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {!session.isHolder && (
                  <div className="rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-100">
                    Holder verification required.
                  </div>
                )}
                {insufficientBalance && !hasActiveOrder && (
                  <div className="rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-[10px] text-yellow-100">
                    Preview generation is free. You&apos;ll need {formatDisplayPoints(avatarCost)} BC to apply the preview after generation.
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase tracking-[0.1em] text-fantasy-muted">
                      Describe Changes
                    </label>
                    <span className="text-[10px] text-fantasy-muted">
                      {formatDisplayPoints(avatarCost)} BC
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(event) => {
                      setPrompt(event.target.value)
                      setError(null)
                    }}
                    placeholder="e.g. add silver armor with glowing teal runes"
                    className="w-full rounded-lg border border-[rgba(140,105,255,0.35)] bg-[rgba(4,0,20,0.65)] px-3 py-2 text-sm text-white resize-none"
                    disabled={submitting || finalizing || cancelling || hasActiveOrder}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn-fantasy text-[11px] disabled:opacity-60"
                    onClick={handleCreate}
                    disabled={!canSubmit}
                  >
                    {submitLabel}
                  </button>
                  {terminalOrder && (
                    <button
                      type="button"
                      className="btn-fantasy-ghost text-[11px]"
                      onClick={handleReset}
                      disabled={submitting || finalizing || cancelling}
                    >
                      Start Another
                    </button>
                  )}
                </div>
                {finalizeReady && (
                  <button
                    type="button"
                    className="btn-fantasy w-full disabled:opacity-60"
                    onClick={handleFinalize}
                    disabled={finalizing || cancelling}
                  >
                    {finalizing ? 'Applying…' : 'Finalize & Apply Preview'}
                  </button>
                )}
                {order && !terminalOrder && previewReady && !finalizing && (
                  <button
                    type="button"
                    className="btn-fantasy-ghost w-full text-[11px] disabled:opacity-60"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel Preview'}
                  </button>
                )}
                {order?.reason && (
                  <div className="rounded-xl border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-[10px] text-yellow-100">
                    {order.reason}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[18px] border border-red-400/40 bg-red-900/40 px-4 py-3 text-[11px] text-red-100">
          {error}
        </div>
      )}
      {order?.lastError && order?.lastError !== order?.reason && (
        <div className="rounded-[18px] border border-yellow-400/35 bg-yellow-500/10 px-4 py-2 text-[11px] text-yellow-100">
          {order.lastError}
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

export const PersonaAvatarCard = memo(PersonaAvatarCardComponent)
