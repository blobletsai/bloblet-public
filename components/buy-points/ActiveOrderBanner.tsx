import { formatDisplayPoints } from '@/src/shared/points'

type Props = {
  orderId: number | null
  quote: number | null
  canceling: boolean
  onResume: () => void
  onCancel: () => void
}

export default function ActiveOrderBanner({ orderId, quote, canceling, onResume, onCancel }: Props) {
  if (!orderId) return null

  return (
    <div className="rounded-xl border border-[rgba(148,93,255,0.35)] bg-[rgba(18,6,40,0.85)] px-3 py-3 text-[11px] text-fantasy-muted">
      <div className="flex items-center justify-between text-[11px] text-white">
        <span>Open order #{orderId}</span>
        <span>{quote != null ? `${formatDisplayPoints(Number(quote))} BC` : '—'}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-fantasy px-3 py-1 text-[11px]"
          onClick={onResume}
          disabled={canceling}
        >
          Resume order
        </button>
        <button
          type="button"
          className="btn-fantasy-ghost px-3 py-1 text-[11px] disabled:opacity-60"
          onClick={onCancel}
          disabled={canceling}
        >
          Cancel order
        </button>
      </div>
    </div>
  )
}
