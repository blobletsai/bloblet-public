export interface ErrorModalProps {
  isOpen: boolean
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
}

export function ErrorModal({
  isOpen,
  title,
  message,
  actionLabel,
  onAction,
  onClose,
}: ErrorModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[50000] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(10,2,23,0.85)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md rounded-system-lg border-2 border-[rgba(255,45,215,0.6)] bg-gradient-to-b from-[#2d1854] to-[#1a0d35] shadow-[0_0_40px_rgba(255,45,215,0.4),0_0_80px_rgba(107,61,204,0.3)] animate-in zoom-in-95 duration-200">
        {/* Glow Effect */}
        <div className="pointer-events-none absolute inset-[-2px] rounded-system-lg border-2 border-[rgba(255,45,215,0.4)] blur-sm" />

        {/* Close Button (Top-Right ✕) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(199,181,255,0.4)] bg-[rgba(107,61,204,0.2)] text-[16px] text-[#c7b5ff] transition-all hover:border-[rgba(199,181,255,0.6)] hover:bg-[rgba(107,61,204,0.3)] hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Content */}
        <div className="relative p-6">
          {/* Icon + Title */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#ff2dd7] bg-[rgba(255,45,215,0.1)] shadow-[0_0_16px_rgba(255,45,215,0.4)]">
              <span className="text-[24px]">⚠️</span>
            </div>
            <div className="font-pressstart text-[14px] uppercase tracking-[0.14em] text-[#ff2dd7]">
              {title}
            </div>
          </div>

          {/* Message */}
          <div className="mb-6 font-pressstart text-[13px] leading-relaxed text-[#ffe780] tracking-wide bg-gradient-to-r from-[rgba(255,231,128,0.15)] to-[rgba(255,134,230,0.1)] border-l-4 border-[#ffe780]/60 pl-4 py-3 rounded-r-lg shadow-[0_0_16px_rgba(255,231,128,0.2)]">
            {message}
          </div>

          {/* Actions */}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onAction()
              }}
              className="w-full rounded-system-sm border-2 border-[#ff6b00] bg-gradient-to-r from-[#ff4500] to-[#ff6b38] px-4 py-3 text-center font-pressstart text-[12px] uppercase tracking-[0.14em] text-white shadow-[0_0_24px_rgba(255,107,0,0.7),0_0_48px_rgba(255,69,0,0.5)] transition-all hover:scale-[1.02] hover:brightness-110 hover:shadow-[0_0_32px_rgba(255,107,0,0.8),0_0_56px_rgba(255,69,0,0.6)]"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
