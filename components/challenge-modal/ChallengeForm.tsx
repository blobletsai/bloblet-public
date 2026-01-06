import type { ChallengeRisk } from './useChallengeFlow'
import { Button } from '@/components/ui'
import { OpponentCard } from './OpponentCard'
import { InfoPanel } from './InfoPanel'
import { DuelPreviewSection } from './DuelPreviewSection'
import { ManualEntrySection } from './ManualEntrySection'
import type { ChallengeAvatarResolver } from './avatarResolver'

export type ChallengeFormProps = {
  addressInput: string
  normalizedTarget: string
  myAddress: string
  suggestions: string[]
  initialTarget?: string | null
  myAvatarUrl: string | null
  opponentAvatarUrl: string | null
  risk: ChallengeRisk
  submitting: boolean
  formError: string | null
  onAddressInput: (value: string) => void
  onSelectSuggestion: (value: string) => void
  onCopyAddress: (value: string | null | undefined) => Promise<void>
  onSubmit: (event: React.FormEvent) => Promise<void>
  stakeBlocked?: boolean
  stakeWarning?: string | null
  resolveAvatarUrl?: ChallengeAvatarResolver
  pairCooldownActive?: boolean
  pairCooldownLabel?: string | null
  myOp: number
  myDp: number
  loadoutHydrating?: boolean
}

export function ChallengeForm(props: ChallengeFormProps) {
  const {
    addressInput,
    normalizedTarget,
    myAddress,
    suggestions,
    initialTarget,
    myAvatarUrl,
    opponentAvatarUrl,
    risk,
    submitting,
    formError,
    onAddressInput,
    onSelectSuggestion,
    onCopyAddress,
    onSubmit,
    stakeBlocked = false,
    stakeWarning,
    resolveAvatarUrl,
    pairCooldownActive = false,
    pairCooldownLabel = null,
    myOp,
    myDp,
    loadoutHydrating = false,
  } = props

  return (
    <form className="mt-5 flex h-full flex-col gap-6" onSubmit={onSubmit}>
      {/* Opponent Roster Grid */}
      {!initialTarget && !normalizedTarget && suggestions.length > 0 && (
        <div>
          <div className="mb-system-md flex items-center justify-between">
            <div className="font-pressstart text-[11px] uppercase tracking-[0.18em] text-[#c7b5ff]">
              🎯 Choose Your Opponent
            </div>
            <div className="text-[9px] font-pressstart text-[#8ff7ff]">{suggestions.slice(0, 4).length} Available</div>
          </div>
          <div className="grid grid-cols-2 gap-system-md lg:grid-cols-4">
            {suggestions.slice(0, 4).map((addr) => {
              const normalized = addr.trim()
              const isSelected = normalized === normalizedTarget
              return (
                <OpponentCard
                  key={addr}
                  address={addr}
                  isSelected={isSelected}
                  onSelectSuggestion={onSelectSuggestion}
                  resolveAvatarUrl={resolveAvatarUrl}
                />
              )
            })}
          </div>
          {suggestions.length > 4 && (
            <div className="mt-system-sm text-center text-[9px] font-pressstart text-[#8ff7ff]/70">
              +{suggestions.length - 4} more via manual entry
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Section */}
      <ManualEntrySection
        addressInput={addressInput}
        normalizedTarget={normalizedTarget}
        suggestions={suggestions}
        initialTarget={initialTarget}
        onAddressInput={onAddressInput}
        onSelectSuggestion={onSelectSuggestion}
      />

      {/* Duel Preview Section - ENHANCED (Mockup 2) */}
      <DuelPreviewSection
        normalizedTarget={normalizedTarget}
        myAvatarUrl={myAvatarUrl}
        opponentAvatarUrl={opponentAvatarUrl}
        risk={risk}
        onSelectSuggestion={onSelectSuggestion}
        myOp={myOp}
        myDp={myDp}
        loadoutHydrating={loadoutHydrating}
      />

      {normalizedTarget && (
        <button
          type="button"
          onClick={() => onSelectSuggestion('')}
          className="mx-auto text-[11px] text-[#b8a6d9] underline-offset-4 hover:text-[#c7b5ff] hover:underline transition-colors duration-200"
        >
          ← Change Opponent
        </button>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={submitting || !normalizedTarget || stakeBlocked || pairCooldownActive}
        loading={submitting}
        className="uppercase tracking-[0.18em] mx-auto max-w-[300px] text-[16px] shadow-[0_0_24px_rgba(255,45,215,0.6),0_0_48px_rgba(255,45,215,0.4),0_0_72px_rgba(255,45,215,0.2)] hover:shadow-[0_0_32px_rgba(255,45,215,0.7),0_0_56px_rgba(255,45,215,0.5),0_0_80px_rgba(255,45,215,0.3)]"
      >
        {submitting ? 'Initiating…' : '🚀 Launch Battle'}
      </Button>

      {pairCooldownActive && pairCooldownLabel ? (
        <p className="text-center text-[9px] text-[#ff9de1] opacity-80">
          {pairCooldownLabel}
        </p>
      ) : !normalizedTarget ? (
        <p className="text-center text-[9px] text-[#8f7fb3] opacity-70">
          Select an opponent above to continue
        </p>
      ) : null}
    </form>
  )
}
