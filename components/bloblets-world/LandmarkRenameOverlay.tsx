"use client"

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { formatDisplayPoints } from '@/src/shared/points'
import { useClientEventPublisher } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

export type LandmarkOverlayDetail = {
  address: string
  addressCanonical: string
  propId: number | null
  propType: string | null
  name: string | null
  renameCount: number
  ownerAddress: string | null
  ownerAddressCased: string | null
  worldX: number
  worldY: number
  radius: number
  basePrice: number
  stepPrice: number
  lastPrice: number | null
  premiumPct: number
}

export type LandmarkRenameOverlayProps = {
  detail: LandmarkOverlayDetail
  anchor: { left: number; top: number }
  myAddressCanonical: string | null
  rewardBalance: number | null
  onTopUp?: () => void
  onClose: () => void
}

function shorten(address: string | null | undefined) {
  if (!address) return '—'
  const trimmed = address.trim()
  if (trimmed.length <= 10) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

function usePortalNode() {
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setNode(document.body)
  }, [])
  return node
}

export function LandmarkRenameOverlay({
  detail,
  anchor,
  myAddressCanonical,
  rewardBalance,
  onTopUp,
  onClose,
}: LandmarkRenameOverlayProps) {
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
  }, [detail.name, detail.propId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const price = useMemo(() => {
    const base = Number.isFinite(detail.basePrice) ? detail.basePrice : 0
    const step = Number.isFinite(detail.stepPrice) ? detail.stepPrice : 0
    const count = Math.max(0, detail.renameCount)
    const stepCost = base + step * count
    const lastPrice = Number.isFinite(detail.lastPrice ?? NaN) ? Math.max(0, Number(detail.lastPrice)) : 0
    const premiumPct = Number.isFinite(detail.premiumPct) ? Math.max(0, detail.premiumPct) : 0
    const premiumFloor = lastPrice > 0 ? Math.ceil(lastPrice * (1 + premiumPct)) : base
    return Math.max(stepCost, premiumFloor)
  }, [detail.basePrice, detail.stepPrice, detail.renameCount, detail.lastPrice, detail.premiumPct])

  const rewardLabel = rewardBalance != null ? `${formatDisplayPoints(rewardBalance)} BC` : '—'
  const priceLabel = `${formatDisplayPoints(price)} BC`
  const lastPriceLabel = useMemo(
    () => `${formatDisplayPoints(Math.max(0, Number(detail.lastPrice || 0)))} BC`,
    [detail.lastPrice],
  )
  const premiumLabel = useMemo(
    () => Math.round(Math.max(0, Number(detail.premiumPct || 0)) * 100),
    [detail.premiumPct],
  )

  const insufficient = rewardBalance != null && rewardBalance + 1e-6 < price

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!myAddressCanonical) {
      setError('Connect and verify your wallet first.')
      return
    }
    const propId = detail.propId != null ? Number(detail.propId) : NaN
    if (!Number.isFinite(propId) || propId <= 0) {
      setError('This landmark is missing its identifier. Re-select it on the canvas to continue.')
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
          address: myAddressCanonical,
          type: 'prop_name',
          source: 'life_hub_overlay',
          params: {
            propId,
            name: trimmed,
            renameCount: detail.renameCount,
            base: detail.basePrice,
            step: detail.stepPrice,
          },
        }),
      })
      const json = await resp.json().catch(() => null)
      if (!resp.ok) {
        if (resp.status === 402) {
          setError('Not enough BlobCoin. Top up to continue.')
        } else if (resp.status === 409) {
          setError('Another player just claimed it. Refresh to see the new price.')
        } else if (resp.status === 404) {
          setError('Landmark not found. Refresh to sync holdings.')
        } else {
          setError(json?.error || 'Rename failed. Please try again.')
        }
        return
      }
      setNotice('Landmark claimed — BlobCoin debited instantly.')
      eventPublisher.emit(CLIENT_EVENT.ORDER_APPLIED, {
        type: 'prop_name',
        propId,
        orderId: json?.order?.id ?? null,
      })
      setTimeout(onClose, 400)
    } catch (err: any) {
      setError(err?.message || 'Rename failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!portalNode) return null

  const ownerLabel = detail.ownerAddressCased || shorten(detail.ownerAddress)

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[14000]">
      <div
        className="pointer-events-auto absolute w-[min(340px,90vw)]"
        style={{ left: anchor.left, top: anchor.top, transform: 'translate(-50%, calc(-100% - 16px))' }}
      >
        <div className="rounded-[28px] border border-[rgba(148,93,255,0.45)] bg-[rgba(16,6,40,0.96)] px-5 py-4 shadow-[0_24px_64px_rgba(12,2,28,0.65)]">
          <div className="flex items-start gap-3">
            <div>
              <div className="font-pressstart pixel-small text-fantasy-primary uppercase tracking-[0.14em]">
                {detail.name && detail.name.trim().length ? detail.name : `Landmark ${detail.propId ?? ''}`}
              </div>
              <div className="text-[11px] text-fantasy-muted">
                Type: {detail.propType ?? '—'} · Price: {priceLabel}
              </div>
              <div className="text-[11px] text-fantasy-muted">
                Owner: {ownerLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-[11px] text-fantasy-muted hover:text-fantasy-primary transition"
            >
              Close
            </button>
          </div>

          <div className="mt-3 text-[11px] text-fantasy-muted">
            Last sale: {lastPriceLabel} · Minimum claim {priceLabel}{' '}
            {detail.premiumPct > 0 ? `(+${premiumLabel}% premium)` : ''}
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
                className="w-full rounded bg-[rgba(4,0,20,0.65)] border border-[rgba(140,105,255,0.35)] px-3 py-2 text-sm text-white"
                placeholder="e.g. Neon Harbor"
                disabled={submitting}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-fantasy-muted">
              <span>Balance: {rewardLabel}</span>
              <span>·</span>
              <span>Cost: {priceLabel}</span>
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
                {submitting ? 'Claiming…' : 'Claim & Rename'}
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
