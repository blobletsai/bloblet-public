import { useState, useMemo } from 'react'
import { shortAddress } from '@/src/shared/pvp'
import { defaultAvatars } from '@/components/bloblets-world/avatar'
import type { ChallengeAvatarResolver } from './avatarResolver'

export interface OpponentCardProps {
  address: string
  isSelected: boolean
  onSelectSuggestion: (address: string) => void
  resolveAvatarUrl?: ChallengeAvatarResolver
}

export function OpponentCard({ address, isSelected, onSelectSuggestion, resolveAvatarUrl }: OpponentCardProps) {
  const [avatarErrored, setAvatarErrored] = useState(false)
  const defaultAlive = useMemo(() => defaultAvatars.alive || null, [])

  // Resolve actual avatar URL for this opponent address
  const resolvedUrl = resolveAvatarUrl ? resolveAvatarUrl(address) : null
  const avatarUrl = avatarErrored ? defaultAlive : (resolvedUrl || defaultAlive)

  return (
    <button
      type="button"
      onClick={() => onSelectSuggestion(address)}
      className={`group relative flex flex-col items-center gap-system-sm rounded-system-lg px-system-md py-3 transition-all duration-300 ${
        isSelected
          ? 'border-[#6b3dcc] bg-[#2d1854] shadow-[0_0_24px_rgba(107,61,204,0.4),0_0_48px_rgba(107,61,204,0.2)] border-2'
          : 'border-[rgba(107,61,204,0.4)] bg-[#1a0d35] hover:border-[rgba(107,61,204,0.7)] hover:bg-[#2d1854] hover:shadow-[0_0_16px_rgba(107,61,204,0.4)] border'
      }`}
    >
      {/* Circular Avatar with glow ring and targeting reticle */}
      <div className="mt-system-md flex justify-center">
        <div className="relative flex h-[132px] w-[132px] items-center justify-center">
          {/* Avatar Circle */}
          <div className={`h-[100px] w-[100px] overflow-hidden rounded-full transition-all duration-300 ${
            isSelected
              ? 'border-[#ff2dd7] shadow-[0_0_20px_rgba(255,45,215,0.3)] border-2'
              : 'border-[rgba(107,61,204,0.5)] group-hover:border-[rgba(107,61,204,0.8)] border'
          }`}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
                onError={() => setAvatarErrored(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#0a0217] text-[38px]">👾</div>
            )}
          </div>

          {/* Cyan Corner Bracket Targeting Reticle */}
          <div className="pointer-events-none absolute inset-0">
            {/* Top-left corner */}
            <div className="absolute left-0 top-0 h-[12px] w-[12px] border-l-[2px] border-t-[2px] border-[#00d9ff]" />
            {/* Top-right corner */}
            <div className="absolute right-0 top-0 h-[12px] w-[12px] border-r-[2px] border-t-[2px] border-[#00d9ff]" />
            {/* Bottom-left corner */}
            <div className="absolute bottom-0 left-0 h-[12px] w-[12px] border-b-[2px] border-l-[2px] border-[#00d9ff]" />
            {/* Bottom-right corner */}
            <div className="absolute bottom-0 right-0 h-[12px] w-[12px] border-b-[2px] border-r-[2px] border-[#00d9ff]" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className={`font-pressstart text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 ${
        isSelected ? 'text-[#ff2dd7]' : 'text-[#c7b5ff] group-hover:text-[#e0d0ff]'
      }`}>
        {shortAddress(address)}
      </div>

      {/* Status Badge */}
      <div className={`rounded-full px-system-sm py-[2px] text-[8px] font-pressstart uppercase tracking-[0.14em] transition-all duration-300 ${
        isSelected
          ? 'bg-[rgba(255,45,215,0.2)] text-[#ff9de1] border border-[rgba(255,45,215,0.4)]'
          : 'bg-[rgba(107,61,204,0.15)] text-[#8ff7ff] border border-[rgba(107,61,204,0.3)]'
      }`}>
        {isSelected ? 'Selected' : '✓ Equal Match'}
      </div>

      {/* Select Target Button */}
      <div className={`mt-system-xs w-full rounded-system-sm px-system-sm py-[6px] text-[9px] font-pressstart uppercase tracking-[0.16em] transition-all duration-300 ${
        isSelected
          ? 'bg-[#ff2dd7] text-white shadow-[0_0_12px_rgba(255,45,215,0.4)]'
          : 'bg-[rgba(107,61,204,0.3)] text-[#c7b5ff] group-hover:bg-[rgba(107,61,204,0.5)] group-hover:text-white'
      }`}>
        {isSelected ? '✓ Selected' : 'Select Target'}
      </div>

      {/* Outer glow for selected state */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-[-4px] rounded-system-lg border-2 border-[rgba(107,61,204,0.6)] blur-md" />
      )}
    </button>
  )
}
