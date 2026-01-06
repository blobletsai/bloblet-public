type Props = {
  successAmountLabel: string | null
  successBalanceLabel: string | null
  successLoading: boolean
  successError: string | null
  autoEnergizeEnabled: boolean
  autoStatus: 'idle' | 'running' | 'success' | 'error'
  onFinish: () => void
  onBuyMore: () => void
}

export default function TopUpSuccessCard({
  successAmountLabel,
  successBalanceLabel,
  successLoading,
  successError,
  autoEnergizeEnabled,
  autoStatus,
  onFinish,
  onBuyMore,
}: Props) {
  return (
    <div className="space-y-5 rounded-2xl border border-[rgba(148,93,255,0.25)] bg-[rgba(24,10,44,0.85)] px-4 py-5 text-[12px] text-fantasy-muted">
      <div className="flex items-start gap-3">
        <div className="text-[26px] leading-none">✅</div>
        <div>
          <div className="font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#7bffd6]">BlobCoin credited</div>
          <div className="mt-2 text-[13px] text-white/90">
            {successAmountLabel ? `+${successAmountLabel} BC added to your balance.` : 'BlobCoin added to your balance.'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[rgba(148,93,255,0.35)] bg-[rgba(18,6,40,0.85)] px-3 py-3 text-[11px] text-fantasy-muted">
        <div className="flex items-center justify-between text-white">
          <span>New balance</span>
          <span>{successLoading ? 'Updating…' : successBalanceLabel ? `${successBalanceLabel} BC` : '—'}</span>
        </div>
        {successError ? (
          <div className="mt-2 text-[10px] text-[#ff9fa0]">{successError}</div>
        ) : null}
      </div>

      {autoEnergizeEnabled ? (
        <div className="rounded-xl border border-[rgba(123,255,214,0.25)] bg-[rgba(22,38,32,0.65)] px-3 py-2 text-[11px] text-[#7bffd6]">
          {autoStatus === 'running'
            ? 'Auto-nourishing…'
            : autoStatus === 'success'
            ? 'Nourish complete.'
            : 'Auto-nourish failed. Try nourishing from the Life panel.'}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-fantasy px-4 py-2 disabled:opacity-60"
          onClick={onFinish}
          disabled={autoStatus === 'running'}
        >
          Done
        </button>
        <button
          type="button"
          className="btn-fantasy-ghost px-4 py-2 disabled:opacity-60"
          onClick={onBuyMore}
          disabled={autoStatus === 'running'}
        >
          Buy more BlobCoin
        </button>
      </div>
    </div>
  )
}
