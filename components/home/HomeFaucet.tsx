import BplayFaucetButton from '@/components/BplayFaucetButton'

type HomeFaucetProps = {
  isMobileLayout: boolean
  faucetOpen: boolean
  onToggleFaucet: () => void
  onCloseFaucet: () => void
  onOpenFaucet: () => void
}

export function HomeFaucet({
  isMobileLayout,
  faucetOpen,
  onToggleFaucet,
  onCloseFaucet,
  onOpenFaucet,
}: HomeFaucetProps) {
  if (isMobileLayout) {
    return (
      <>
        <button
          type="button"
          onClick={onOpenFaucet}
          className="fixed bottom-24 right-4 z-[12000] inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(148,93,255,0.35)] bg-[rgba(22,10,48,0.9)] text-[20px] shadow-[0_16px_44px_rgba(16,4,30,0.5)] transition hover:border-[rgba(255,134,230,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ff7ff]"
          aria-label="Open faucet panel"
          aria-expanded={faucetOpen}
        >
          <span aria-hidden>💧</span>
        </button>
        {faucetOpen && (
          <div
            className="fixed inset-0 z-[13000] flex items-end justify-center bg-[rgba(6,2,12,0.7)] backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={onCloseFaucet}
          >
            <div
              className="pointer-events-auto mb-6 w-full max-w-[min(420px,calc(100vw-32px))]"
              onClick={(event) => event.stopPropagation()}
            >
              <BplayFaucetButton compact onRequestClose={onCloseFaucet} autoDismiss />
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggleFaucet}
        className={`pointer-events-auto grid h-12 w-12 place-items-center rounded-system-sm border border-[rgba(148,93,255,0.35)] bg-[rgba(22,10,48,0.85)] text-[18px] transition hover:border-[rgba(255,134,230,0.45)] ${faucetOpen ? 'border-[rgba(255,134,230,0.6)]' : ''}`}
        title="Faucet: claim test BPLAY"
        aria-label="Faucet"
        aria-expanded={faucetOpen}
      >
        <span aria-hidden>💧</span>
      </button>
      {faucetOpen && (
        <div className="pointer-events-auto absolute left-14 top-0 z-[12000]">
          <BplayFaucetButton compact onRequestClose={onCloseFaucet} autoDismiss />
        </div>
      )}
    </>
  )
}
