import { useState } from 'react'
import { shortAddress } from '@/src/shared/pvp'

export interface ManualEntrySectionProps {
  addressInput: string
  normalizedTarget: string
  suggestions: string[]
  initialTarget?: string | null
  onAddressInput: (value: string) => void
  onSelectSuggestion: (value: string) => void
}

export function ManualEntrySection({
  addressInput,
  normalizedTarget,
  suggestions,
  initialTarget,
  onAddressInput,
  onSelectSuggestion,
}: ManualEntrySectionProps) {
  const [showManualEntry, setShowManualEntry] = useState(false)

  // Show pre-selected opponent if initialTarget is provided
  if (initialTarget) {
    return (
      <div className="rounded-[20px] border border-[rgba(143,247,255,0.4)] bg-[rgba(12,4,26,0.5)] px-4 py-3">
        <div className="font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#8ff7ff]">
          Pre-selected Opponent
        </div>
        <div className="mt-2 font-pressstart text-[11px] text-white">{shortAddress(initialTarget)}</div>
      </div>
    )
  }

  // Don't show manual entry if target is already selected
  if (normalizedTarget) {
    return null
  }

  return (
    <div
      className={`rounded-system-md border-2 border-dashed transition-all duration-300 ${
        showManualEntry
          ? 'border-[#00ffff] bg-[rgba(0,20,26,0.6)] shadow-[0_0_20px_rgba(0,255,255,0.2)]'
          : 'border-[#7c3aed] bg-[#1a0d35] shadow-[0_0_8px_rgba(124,58,237,0.3)]'
      } px-system-md py-system-md`}
    >
      <button
        type="button"
        onClick={() => setShowManualEntry(!showManualEntry)}
        className="flex w-full items-center justify-between text-left transition-colors duration-200 hover:text-[#00ffff]"
      >
        <span className="font-pressstart text-[10px] uppercase tracking-[0.18em] text-[#c7b5ff]">
          ⚙️ Manual Entry
        </span>
        <span className="text-[12px] text-[#00ffff]">{showManualEntry ? '▼' : '▶'}</span>
      </button>
      {showManualEntry && (
        <div className="mt-system-md space-y-system-sm">
          {/* Address Input with Scan Line Effect */}
          <div className="relative">
            <div className="flex items-center gap-system-sm rounded-system-sm border-2 border-[rgba(0,255,255,0.5)] bg-[rgba(10,3,24,0.95)] px-system-md py-system-sm">
              <input
                value={addressInput}
                onChange={(event) => onAddressInput(event.target.value)}
                placeholder="Paste Solana address (e.g. F7m1...HxKc)"
                className="flex-1 bg-transparent font-pressstart text-[11px] text-white placeholder:text-[rgba(143,247,255,0.4)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.readText().then((text) => {
                    onAddressInput(text.trim())
                  }).catch(() => {
                    // Fallback if clipboard access fails
                  })
                }}
                className="rounded-system-sm bg-[rgba(0,255,255,0.2)] px-system-sm py-[4px] text-[9px] font-pressstart uppercase tracking-[0.14em] text-[#00ffff] transition-all hover:bg-[rgba(0,255,255,0.3)] hover:shadow-[0_0_8px_rgba(0,255,255,0.3)]"
              >
                📋 Paste
              </button>
            </div>
            {/* Scan Line Animation */}
            {addressInput && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-system-sm">
                <div className="absolute h-[2px] w-full bg-gradient-to-r from-transparent via-[rgba(0,255,255,0.6)] to-transparent animate-scan-line" />
              </div>
            )}
          </div>

          {/* Validation Status */}
          {addressInput && (
            <div className="flex items-center gap-system-xs text-[9px] font-pressstart">
              {normalizedTarget ? (
                <>
                  <span className="text-[#00ff9f]">✓</span>
                  <span className="text-[#00ff9f]">Valid address</span>
                </>
              ) : (
                <>
                  <span className="text-[#ff8c38]">⚠</span>
                  <span className="text-[#ff8c38]">Validating...</span>
                </>
              )}
            </div>
          )}

          {/* Recent Opponents Quick Select */}
          {suggestions.length > 4 && (
            <div>
              <div className="mb-system-xs text-[9px] font-pressstart uppercase tracking-[0.14em] text-[#8ff7ff]/70">
                Recent Opponents:
              </div>
              <div className="flex flex-wrap gap-system-xs">
                {suggestions.slice(4, 8).map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    onClick={() => onSelectSuggestion(addr)}
                    className="rounded-full border border-[rgba(0,255,255,0.3)] bg-[rgba(0,255,255,0.1)] px-system-sm py-[4px] text-[8px] font-pressstart text-[#8ff7ff] transition-all hover:border-[rgba(0,255,255,0.6)] hover:bg-[rgba(0,255,255,0.2)] hover:text-[#00ffff]"
                  >
                    {shortAddress(addr)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
