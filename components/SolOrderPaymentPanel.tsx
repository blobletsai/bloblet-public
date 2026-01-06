"use client"

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { UseMarketOrderResult } from '@/src/client/hooks/useMarketOrder'
import { explorerTxUrl } from '@/src/shared/explorer'

const PREVIEW_STEPS = [
  { key: 'pay', label: 'Pay' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'preview', label: 'Preview' },
  { key: 'apply', label: 'Apply' },
] as const

const SIMPLE_STEPS = [
  { key: 'pay', label: 'Pay' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'complete', label: 'Complete' },
] as const

type PreviewStageKey = (typeof PREVIEW_STEPS)[number]['key']
type SimpleStageKey = (typeof SIMPLE_STEPS)[number]['key']
type StageKey = PreviewStageKey | SimpleStageKey

type PhaseMeta = { label: string; message: string; stage: StageKey }

const PREVIEW_PHASE_META: Record<UseMarketOrderResult['phase'], PhaseMeta> = {
  awaiting_payment: { label: 'Awaiting payment', message: 'Send the transfer with your wallet to start.', stage: 'pay' },
  confirming_payment: { label: 'Confirming', message: 'Waiting for Solana confirmations…', stage: 'confirm' },
  generating_preview: { label: 'Generating preview', message: 'Artwork is rendering. Hang tight…', stage: 'preview' },
  preview_ready: { label: 'Preview ready', message: 'Preview ready — finalize when it looks good.', stage: 'preview' },
  applying: { label: 'Applying', message: 'Finalizing changes…', stage: 'apply' },
  applied: { label: 'Applied', message: 'Order applied successfully.', stage: 'apply' },
  expired: { label: 'Expired', message: 'Order expired. Start a new one to continue.', stage: 'pay' },
  rejected: { label: 'Needs attention', message: 'This order needs attention. See details below.', stage: 'pay' },
}

const SIMPLE_PHASE_META: Record<UseMarketOrderResult['phase'], PhaseMeta> = {
  awaiting_payment: { label: 'Awaiting payment', message: 'Send the transfer with your wallet to start.', stage: 'pay' },
  confirming_payment: { label: 'Confirming transfer', message: 'Waiting for blockchain confirmations…', stage: 'confirm' },
  generating_preview: { label: 'Processing payment', message: 'Payment confirmed — applying your changes…', stage: 'complete' },
  preview_ready: { label: 'Processing payment', message: 'Applying your changes…', stage: 'complete' },
  applying: { label: 'Applying', message: 'Finalizing changes…', stage: 'complete' },
  applied: { label: 'Applied', message: 'Order applied successfully.', stage: 'complete' },
  expired: { label: 'Expired', message: 'Order expired. Start a new one to continue.', stage: 'pay' },
  rejected: { label: 'Needs attention', message: 'This order needs attention. See details below.', stage: 'pay' },
}

const HISTORY_RENDER_LIMIT = 4

type Props = {
  state: UseMarketOrderResult['state']
  phase: UseMarketOrderResult['phase']
  history: UseMarketOrderResult['history']
  notice: string | null
  pollDelayMs: number
  confirming: boolean
  transferring: boolean
  mint: string
  decimals: number
  treasuryWallet: string
  detailItems: ReactNode[]
  onPay: () => Promise<void>
  onRetryConfirm?: () => Promise<void>
  onCancel?: () => Promise<void>
  cancelDisabled?: boolean
  helpText?: ReactNode
}

export default function SolOrderPaymentPanel({
  state,
  phase,
  history,
  notice,
  pollDelayMs,
  confirming,
  transferring,
  mint,
  decimals,
  treasuryWallet,
  detailItems,
  onPay,
  onRetryConfirm,
  onCancel,
  cancelDisabled,
  helpText,
}: Props) {
  const hasPreviewStages = state.type === 'avatar_custom'
  const phaseMeta = (hasPreviewStages ? PREVIEW_PHASE_META : SIMPLE_PHASE_META)[phase] ?? (hasPreviewStages ? PREVIEW_PHASE_META.awaiting_payment : SIMPLE_PHASE_META.awaiting_payment)
  const steps = useMemo(() => (hasPreviewStages ? PREVIEW_STEPS : SIMPLE_STEPS), [hasPreviewStages])
  const stageKey = useMemo(() => phaseMeta.stage, [phaseMeta.stage])
  const stageIndexRaw = steps.findIndex((step) => step.key === stageKey)
  const stageIndex = stageIndexRaw >= 0 ? stageIndexRaw : 0
  const historyItems = history.slice(0, HISTORY_RENDER_LIMIT)
  const primaryMessage = notice ?? phaseMeta.message
  const showPayButton = phase === 'awaiting_payment'
  const showRetry = phase === 'confirming_payment' && !!onRetryConfirm
  const txUrl = state.signature ? explorerTxUrl(state.signature) : null
  const reasonToShow = state.reason
  const showCancel = Boolean(onCancel) && !!state.orderId && !['applied', 'expired', 'rejected'].includes(phase)

  const formattedAmount = state.quote != null && Number.isFinite(state.quote) ? state.quote.toLocaleString() : null
  const orderType = state.type || ''
  const rewardPointType = ['rename', 'prop_name', 'avatar_custom', 'reward_topup'].includes(orderType)
  const requiresWalletPayment = ['reward_topup', 'care', 'care_bundle'].includes(orderType)
  const amountUnit = rewardPointType ? 'BC' : 'tokens'
  const chipClass = phase === 'rejected' || phase === 'expired' ? 'chip-fantasy bg-[rgba(255,159,159,0.16)] border-[rgba(255,159,159,0.35)] text-[#ff9fa0]' : 'chip-fantasy bg-[rgba(123,255,214,0.16)] border-[rgba(123,255,214,0.35)] text-[#7bffd6]'
  const [detailsOpen, setDetailsOpen] = useState(phase === 'awaiting_payment')

  const progressPercent = useMemo(() => {
    if (steps.length <= 1) return 0
    return stageIndex / (steps.length - 1)
  }, [stageIndex, steps])

  useEffect(() => {
    if (phase === 'awaiting_payment') setDetailsOpen(true)
  }, [phase])

  if (!state.orderId) return null

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(148,93,255,0.35)] bg-[rgba(16,8,30,0.7)] px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-fantasy-muted">Order</div>
          <div className="font-pressstart text-[12px] text-fantasy-primary">#{state.orderId}</div>
        </div>
        <span className={chipClass}>{phaseMeta.label}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-fantasy-muted">
          {steps.map((step, idx) => {
            const current = stageIndex === idx
            const reached = stageIndex >= idx
            const arrow = idx < steps.length - 1 ? <span key={`${step.key}-arrow`} className="text-[10px] text-fantasy-muted/70">→</span> : null
            return (
              <div key={step.key} className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] ${current ? 'bg-[rgba(123,255,214,0.16)] text-[#7bffd6]' : reached ? 'text-fantasy-primary' : 'text-fantasy-muted/70'}`}>{step.label}</span>
                {arrow}
              </div>
            )
          })}
        </div>
        <div className="h-1 rounded-full bg-[rgba(148,93,255,0.35)]">
          <div className="h-full rounded-full bg-[rgba(123,255,214,0.9)] shadow-[0_0_8px_rgba(123,255,214,0.45)] transition-all" style={{ width: `${Math.max(0, Math.min(1, progressPercent)) * 100}%` }} />
        </div>
        <div className="text-[12px] text-fantasy-muted">{primaryMessage}</div>
        {reasonToShow && <div className="font-pressstart text-[11px] text-red-300">{state.reason}</div>}
      </div>

      {phase === 'awaiting_payment' && (
        <button type="button" className="btn-fantasy w-full disabled:opacity-50" disabled={transferring || confirming} onClick={onPay}>
          {transferring ? 'Waiting for wallet…' : 'Pay with Wallet'}
        </button>
      )}

      {showCancel && (
        <button type="button" className="btn-fantasy-ghost w-full disabled:opacity-50" disabled={cancelDisabled || confirming || transferring} onClick={() => onCancel && onCancel().catch(() => {})}>
          Cancel order
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-fantasy-muted">
        {showRetry && (
          <button type="button" className="btn-fantasy-ghost flex-1 min-w-[140px] disabled:opacity-50" disabled={confirming || transferring} onClick={() => onRetryConfirm && onRetryConfirm().catch(() => {})}>
            Retry confirmation
          </button>
        )}
        {txUrl && (
          <Link href={txUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[140px] rounded-full border border-[rgba(148,93,255,0.45)] px-3 py-1.5 text-center text-[11px] text-blue-200 hover:border-[rgba(123,255,214,0.35)]">
            View on Explorer
          </Link>
        )}
      </div>

      <details className="rounded-md border border-[rgba(148,93,255,0.25)] bg-[rgba(18,4,54,0.55)] px-3 py-2 text-[11px] text-fantasy-muted" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between font-pressstart text-[10px] uppercase text-fantasy-primary">
          <span>{requiresWalletPayment ? 'Payment details' : 'Ledger details'}</span>
          <span className="text-[10px] text-fantasy-muted">{detailsOpen ? 'Hide' : 'Show'}</span>
        </summary>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span>Amount</span>
            <span className="font-mono text-white text-[10px]">{formattedAmount ? `${formattedAmount} ${amountUnit}` : '—'}</span>
          </div>
          {requiresWalletPayment && (
            <>
              <div className="flex items-center justify-between gap-3 text-[10px]"><span>Token</span><span className="font-mono text-white text-[10px]">{mint}</span></div>
              <div className="flex items-center justify-between gap-3 text-[10px]"><span>Treasury</span><span className="font-mono text-white text-[9px] text-right break-all">{treasuryWallet}</span></div>
            </>
          )}
          {detailItems.length > 0 && <ul className="list-disc pl-4 text-[10px] text-fantasy-muted">{detailItems.map((item, idx) => (<li key={idx}>{item}</li>))}</ul>}
          {helpText && <div className="pt-1 text-[10px] text-fantasy-muted">{helpText}</div>}
        </div>
      </details>

      {historyItems.length > 0 && (
        <details className="rounded-md border border-[rgba(148,93,255,0.2)] bg-[rgba(18,4,54,0.45)] px-3 py-2 text-[10px] text-fantasy-muted">
          <summary className="cursor-pointer list-none font-pressstart text-[10px] uppercase text-fantasy-primary">Recent activity</summary>
          <ul className="mt-2 space-y-1">
            {historyItems.map((item) => {
              const isActive = item.id === state.orderId
              const when = (() => {
                const t = item.updatedAt || item.createdAt
                if (!t) return ''
                const ms = Date.parse(t)
                if (!Number.isFinite(ms)) return ''
                const diff = Date.now() - ms
                const m = Math.round(Math.abs(diff) / 60000)
                if (m <= 1) return 'just now'
                if (m < 60) return `${m}m ago`
                const h = Math.round(m / 60)
                if (h < 24) return `${h}h ago`
                const d = Math.round(h / 24)
                return `${d}d ago`
              })()
              return (
                <li key={item.id} className="flex items-center gap-2 text-[10px]">
                  <span className={`font-pressstart ${isActive ? 'text-fantasy-primary' : 'text-fantasy-muted'}`}>#{item.id}</span>
                  <span className={`${isActive ? 'text-fantasy-primary' : 'text-fantasy-muted'} uppercase tracking-[0.12em]`}>{item.status || 'pending'}</span>
                  {item.signature && <span className="max-w-[110px] truncate font-mono text-[9px] text-blue-200">{item.signature.slice(0, 10)}…</span>}
                  {when && <span className="ml-auto opacity-60">{when}</span>}
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </div>
  )
}
