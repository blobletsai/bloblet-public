type Props = {
  amountInput: string
  onAmountChange: (value: string) => void
  minLabel: string
  loading: boolean
  submitting: boolean
  canceling: boolean
  amountValid: boolean
  entryError: string | null
  onSubmit: () => void
  tokenBalanceLabel?: string | null
  gateLabel?: string | null
  onBuyMax?: () => void
  buyMaxLoading?: boolean
}

export default function TopUpAmountForm({
  amountInput,
  onAmountChange,
  minLabel,
  loading,
  submitting,
  canceling,
  amountValid,
  entryError,
  onSubmit,
  tokenBalanceLabel,
  gateLabel,
  onBuyMax,
  buyMaxLoading,
}: Props) {
  return (
    <div>
      <label className="font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#c7b5ff]">BlobCoin to buy</label>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        value={amountInput}
        onChange={(event) => onAmountChange(event.target.value)}
        placeholder={`Minimum ${minLabel}`}
        className="mt-2 w-full rounded-xl border border-[rgba(148,93,255,0.35)] bg-[rgba(18,6,38,0.9)] px-3 py-2 text-[13px] text-white focus:border-[rgba(123,255,214,0.55)] focus:outline-none"
        disabled={loading || submitting || canceling}
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-fantasy-muted/70">
        <span>Min {minLabel} BC</span>
        {onBuyMax ? (
          <button
            type="button"
            className="text-fantasy-primary hover:text-white disabled:opacity-60"
            onClick={onBuyMax}
            disabled={loading || submitting || canceling || buyMaxLoading}
          >
            {buyMaxLoading ? 'Calculating…' : 'Buy Max (leaves entry balance)'}
          </button>
        ) : null}
      </div>
      {(tokenBalanceLabel || gateLabel) ? (
        <div className="mt-1 flex items-center justify-between text-[11px] text-fantasy-muted/70">
          <span>{gateLabel ?? ''}</span>
          <span>{tokenBalanceLabel ? `Token balance: ${tokenBalanceLabel}` : ''}</span>
        </div>
      ) : null}
      {entryError ? (
        <div className="mt-3 font-pressstart text-[11px] text-red-300">{entryError}</div>
      ) : null}
      <button
        type="button"
        className="btn-fantasy mt-4 w-full disabled:opacity-60"
        disabled={!amountValid || loading || submitting || canceling}
        onClick={onSubmit}
      >
        {submitting || loading ? 'Preparing…' : 'Buy BlobCoin'}
      </button>
    </div>
  )
}
