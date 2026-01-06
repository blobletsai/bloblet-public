"use client"

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { formatDisplayPoints } from '@/src/shared/points'
import { useClientEventPublisher } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

export type BlobletOverlayDetail = {
  address: string
  addressCanonical: string
  name: string | null
  worldX: number
  worldY: number
}

export type BlobletRenameOverlayProps = {
  detail: BlobletOverlayDetail
  anchor: { left: number; top: number }
  rewardBalance: number | null
  renameCost: number
  addressCanonical: string | null
  onTopUp?: () => void
  onCustomize?: () => void
  onClose: () => void
}

function usePortalNode() {
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setNode(document.body)
  }, [])
  return node
}

export function BlobletRenameOverlay({
  detail,
  anchor,
  rewardBalance,
  renameCost,
  addressCanonical,
  onTopUp,
  onCustomize,
  onClose,
}: BlobletRenameOverlayProps) {
  const portalNode = usePortalNode()
  const eventPublisher = useClientEventPublisher()
  const [name, setName] = useState(detail.name ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setName(detail.name ?? '')
    setError(null)
    setNotice(null)
  }, [detail.name])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const insufficient = useMemo(() => {
    if (rewardBalance == null || Number.isNaN(rewardBalance)) return false
    return rewardBalance + 1e-6 < renameCost
  }, [renameCost, rewardBalance])

  const rewardLabel = rewardBalance != null ? `${formatDisplayPoints(rewardBalance)} BC` : '—'
  const costLabel = `${formatDisplayPoints(renameCost)} BC`

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!addressCanonical) {
      setError('Connect and verify your wallet first.')
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
    try {
      const resp = await fetch('/api/orders/intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          address: addressCanonical,
          type: 'rename',
          source: 'life_hub_overlay',
          params: { name: trimmed },
        }),
      })
      const json = await resp.json().catch(() => null)
      if (!resp.ok) {
        if (resp.status === 402) {
          const deficit = json?.quoteAmount && json?.ledgerBalance != null
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
        orderId: json?.order?.id ?? null,
      })
      setTimeout(onClose, 400)
    } catch (err: any) {
      setError(err?.message || 'Rename failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCustomize = () => {
    onCustomize?.()
    onClose()
  }

  if (!portalNode) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[14000]">
      <div
        className="pointer-events-auto absolute w-[min(320px,90vw)]"
        style={{ left: anchor.left, top: anchor.top, transform: 'translate(-50%, calc(-100% - 16px))' }}
      >
        <div className="rounded-[28px] border border-[rgba(148,93,255,0.45)] bg-[rgba(16,6,40,0.96)] px-5 py-4 shadow-[0_24px_64px_rgba(12,2,28,0.65)]">
          <div className="flex items-start gap-3">
            <div>
              <div className="font-pressstart pixel-small text-fantasy-primary uppercase tracking-[0.12em]">
                {detail.name && detail.name.trim().length ? detail.name : 'Rename Your Bloblet'}
              </div>
              <div className="text-[11px] text-fantasy-muted">
                Balance: {rewardLabel} · Cost: {costLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-[11px] text-fantasy-muted transition hover:text-fantasy-primary"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-[0.1em] text-fantasy-muted">
                New Name
              </label>
              <input
                type="text"
                maxLength={32}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                  setNotice(null)
                }}
                placeholder={detail.name || 'e.g. Star Voyager'}
                className="w-full rounded bg-[rgba(4,0,20,0.65)] border border-[rgba(140,105,255,0.35)] px-3 py-2 text-sm text-white"
                disabled={submitting}
              />
            </div>

            {insufficient && (
              <div className="rounded-2xl border border-yellow-400/35 bg-yellow-500/10 px-4 py-2 text-[11px] text-yellow-100">
                Not enough BlobCoin. Top up to continue.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className={`btn-fantasy ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={submitting || insufficient}
              >
                {submitting ? 'Renaming…' : 'Spend BC'}
              </button>
              {onTopUp && (
                <button
                  type="button"
                  className="btn-fantasy-ghost"
                  onClick={onTopUp}
                  disabled={submitting}
                >
                  Buy BlobCoin
                </button>
              )}
              {onCustomize && (
                <button
                  type="button"
                  className="btn-fantasy-ghost"
                  onClick={handleCustomize}
                  disabled={submitting}
                >
                  Customize Avatar
                </button>
              )}
            </div>
          </form>

          {error && (
            <div className="mt-3 rounded-[18px] border border-red-400/40 bg-red-900/40 px-4 py-2 text-[11px] text-red-100">
              {error}
            </div>
          )}
          {notice && (
            <div className="mt-3 rounded-[18px] border border-[rgba(125,255,207,0.35)] bg-[rgba(32,96,72,0.45)] px-4 py-2 text-[11px] text-[#7dffcf]">
              {notice}
            </div>
          )}
        </div>
      </div>
    </div>,
    portalNode,
  )
}
