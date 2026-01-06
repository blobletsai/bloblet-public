"use client"

import ActiveOrderBanner from './buy-points/ActiveOrderBanner'
import TopUpAmountForm from './buy-points/TopUpAmountForm'
import TopUpSuccessCard from './buy-points/TopUpSuccessCard'
import { useSolTopUpController } from './buy-points/useSolTopUpController'
import type { RewardsModalConfig } from './rewards-modal/types'
import SolOrderPaymentPanel from './SolOrderPaymentPanel'

type Props = {
  open: boolean
  onClose: () => void
  rewardsConfig?: RewardsModalConfig
  onRewardsUpdated?: (options?: { silent?: boolean }) => Promise<unknown>
}

export default function SolCareTopUpModal({ open, onClose, rewardsConfig, onRewardsUpdated }: Props) {
  const {
    view,
    hasActiveOrder,
    loading,
    submitting,
    canceling,
    amountInput,
    amountValid,
    minLabel,
    entryError,
    tokenBalanceLabel,
    gateLabel,
    successAmountLabel,
    successBalanceLabel,
    successLoading,
    successError,
    autoStatus,
    payment,
    handlers,
    computingMax,
  } = useSolTopUpController({ open, onClose, rewardsConfig, onRewardsUpdated })

  if (!open) return null

  const { handleModalClose, handleAmountChange, handleAmountSubmit, handleResumeOrder, handleCancelExisting, handleFinish, handleBuyMore } = handlers

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(9,0,23,0.86)] px-4 py-10">
      <div className="relative w-full max-w-lg rounded-3xl border border-[rgba(148,93,255,0.35)] bg-[rgba(17,8,34,0.95)] p-6 shadow-[0_24px_72px_rgba(10,0,24,0.65)]">
        <button type="button" onClick={handleModalClose} className="absolute right-4 top-4 rounded-full border border-[rgba(148,93,255,0.45)] bg-[rgba(26,10,44,0.9)] px-3 py-1 font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#d1b5ff] transition hover:border-[#ff9de1] hover:text-white">Close</button>

        <div className="mb-4 pr-16">
          <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#7bffd6]">Buy BlobCoin</div>
          <p className="mt-2 text-[12px] text-fantasy-muted">Add BlobCoin to your balance using your verified wallet.</p>
        </div>

        {view === 'entry' ? (
          <div className="space-y-4 rounded-2xl border border-[rgba(148,93,255,0.25)] bg-[rgba(24,10,44,0.85)] px-4 py-5 text-[12px] text-fantasy-muted">
            {hasActiveOrder ? (
              <ActiveOrderBanner orderId={payment.state.orderId} quote={payment.state.quote} canceling={canceling} onResume={handleResumeOrder} onCancel={handleCancelExisting} />
            ) : null}
            <TopUpAmountForm
              amountInput={amountInput}
              onAmountChange={handleAmountChange}
              minLabel={minLabel}
              tokenBalanceLabel={tokenBalanceLabel}
              gateLabel={gateLabel}
              loading={loading}
              submitting={submitting}
              canceling={canceling}
              amountValid={amountValid}
              entryError={entryError}
              onSubmit={handleAmountSubmit}
              onBuyMax={handlers.handleBuyMax}
              buyMaxLoading={computingMax}
            />
          </div>
        ) : null}

        {view === 'success' ? (
          <TopUpSuccessCard successAmountLabel={successAmountLabel} successBalanceLabel={successBalanceLabel} successLoading={successLoading} successError={successError} autoEnergizeEnabled={false} autoStatus={autoStatus} onFinish={handleFinish} onBuyMore={handleBuyMore} />
        ) : null}

        {view === 'payment' && hasActiveOrder ? (
          <div className="space-y-4">
            <SolOrderPaymentPanel
              state={payment.state}
              phase={payment.phase}
              history={payment.history}
              notice={payment.notice}
              pollDelayMs={payment.pollDelayMs}
              confirming={payment.confirming}
              transferring={payment.transferring}
              mint={payment.mint}
              decimals={payment.decimals}
              treasuryWallet={payment.treasuryWallet}
              detailItems={[]}
              onPay={payment.onPay}
              onRetryConfirm={payment.onRetryConfirm}
              onCancel={payment.onCancel}
              cancelDisabled={canceling}
              helpText="Send the transfer to credit your BlobCoin."
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
