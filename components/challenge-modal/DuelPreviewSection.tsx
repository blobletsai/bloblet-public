import { useState, useMemo } from 'react'
import { riskToneClasses } from '@/src/shared/pvp'
import { defaultAvatars } from '@/components/bloblets-world/avatar'
import { InfoPanel } from './InfoPanel'
import type { ChallengeRisk } from './useChallengeFlow'

export interface DuelPreviewSectionProps {
  normalizedTarget: string
  myAvatarUrl: string | null
  opponentAvatarUrl: string | null
  risk: ChallengeRisk
  onSelectSuggestion: (value: string) => void
  myOp: number
  myDp: number
  loadoutHydrating?: boolean
}

export function DuelPreviewSection({
  normalizedTarget,
  myAvatarUrl,
  opponentAvatarUrl,
  risk,
  onSelectSuggestion,
  myOp,
  myDp,
  loadoutHydrating = false,
}: DuelPreviewSectionProps) {
  const [myAvatarErrored, setMyAvatarErrored] = useState(false)
  const [opponentAvatarErrored, setOpponentAvatarErrored] = useState(false)

  const defaultAlive = useMemo(() => defaultAvatars.alive || null, [])
  const safeMyAvatar = myAvatarErrored ? defaultAlive : myAvatarUrl || defaultAlive
  const safeOpponentAvatar = opponentAvatarErrored ? defaultAlive : opponentAvatarUrl || defaultAlive
  const opValue = Number.isFinite(myOp) ? myOp : 0
  const dpValue = Number.isFinite(myDp) ? myDp : 0

  if (!normalizedTarget) return null

  return (
    <div className="flex flex-1 flex-col gap-system-lg">
      {/* Duel Face-Off Section */}
      <div className="relative px-system-md py-system-sm">
        {/* Background effects layer */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Grid pattern */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(107, 61, 204, 0.15) 1px, transparent 1px),
                linear-gradient(90deg, rgba(107, 61, 204, 0.15) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px'
            }}
          />
          {/* Purple glow orbs */}
          <div className="absolute left-[15%] top-[20%] h-[40px] w-[40px] rounded-full bg-[#bf40ff] blur-[35px] opacity-40" />
          <div className="absolute right-[15%] top-[25%] h-[35px] w-[35px] rounded-full bg-[#9d4edd] blur-[30px] opacity-35" />
          <div className="absolute left-[20%] bottom-[30%] h-[30px] w-[30px] rounded-full bg-[#bf40ff] blur-[25px] opacity-45" />
          <div className="absolute right-[20%] bottom-[25%] h-[38px] w-[38px] rounded-full bg-[#9d4edd] blur-[32px] opacity-38" />
          {/* Sparkle particles */}
          <div className="absolute left-[30%] top-[35%] h-[3px] w-[3px] rounded-full bg-[#c7b5ff] opacity-70" />
          <div className="absolute right-[35%] top-[40%] h-[2px] w-[2px] rounded-full bg-[#c7b5ff] opacity-60" />
          <div className="absolute left-[45%] bottom-[45%] h-[3px] w-[3px] rounded-full bg-[#c7b5ff] opacity-65" />
          <div className="absolute right-[30%] bottom-[35%] h-[2px] w-[2px] rounded-full bg-[#c7b5ff] opacity-55" />
        </div>
        <div className="mb-system-md flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectSuggestion('')}
            className="flex items-center gap-2 font-pressstart text-[9px] uppercase tracking-[0.14em] text-[#8ff7ff] transition-colors hover:text-[#00ffff]"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div className="flex-1 text-center font-pressstart text-[10px] uppercase tracking-[0.18em] text-[#c7b5ff]">
            ⚔️ Duel Preview
          </div>
          <div className="w-[60px]">{/* Spacer for balance */}</div>
        </div>

        {/* Face-Off Grid */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-system-lg">
          {/* YOU */}
          <div className="flex flex-col items-center gap-system-sm">
            <div className="text-[14px] font-pressstart uppercase tracking-[0.16em] text-[#00ffff]">
              You
            </div>
            <div className="relative">
              <div className="h-[140px] w-[140px] overflow-hidden rounded-full border-4 border-[#00ffff] bg-[#0a0217] shadow-[0_0_24px_rgba(0,255,255,0.5),0_0_48px_rgba(0,255,255,0.3)]">
                {safeMyAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeMyAvatar}
                    alt="Your bloblet"
                    className="h-full w-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                    loading="eager"
                    onError={() => setMyAvatarErrored(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[48px]">🎮</div>
                )}
              </div>
              {/* Rotating ring effect */}
              <div className="pointer-events-none absolute inset-[-4px] rounded-full border-2 border-[rgba(0,255,255,0.4)] blur-sm" />
            </div>
            {/* Stats */}
            <div className="text-center text-[9px] font-pressstart text-[#00ffff]">
              <div>{`OP: +${opValue} · DP: +${dpValue}`}</div>
              {loadoutHydrating ? (
                <div className="mt-1 text-[8px] uppercase tracking-[0.14em] text-[#8ff7ff]/70">
                  Syncing loadout…
                </div>
              ) : null}
            </div>
          </div>

          {/* VS Icon */}
          <div className="relative flex flex-col items-center gap-system-xs">
            {/* Connection lines */}
            <div className="pointer-events-none absolute left-[-80px] top-[32px] h-[2px] w-[80px] bg-gradient-to-r from-[rgba(0,255,255,0.4)] to-[rgba(255,45,215,0.2)]" />
            <div className="pointer-events-none absolute right-[-80px] top-[32px] h-[2px] w-[80px] bg-gradient-to-l from-[rgba(107,61,204,0.4)] to-[rgba(255,45,215,0.2)]" />
            {/* Connecting dots */}
            <div className="pointer-events-none absolute left-[-85px] top-[30px] h-[6px] w-[6px] rounded-full bg-[#00ffff] opacity-60 shadow-[0_0_8px_rgba(0,255,255,0.6)]" />
            <div className="pointer-events-none absolute right-[-85px] top-[30px] h-[6px] w-[6px] rounded-full bg-[#6b3dcc] opacity-60 shadow-[0_0_8px_rgba(107,61,204,0.6)]" />

            <div className="flex h-[64px] w-[64px] items-center justify-center rounded-system-sm border-2 border-[#ff2dd7] bg-[rgba(255,45,215,0.1)] shadow-[0_0_16px_rgba(255,45,215,0.4)]">
              <div className="text-[32px]">⚔️</div>
            </div>
            <div className="font-pressstart text-[11px] uppercase tracking-[0.18em] text-[#ff2dd7]">
              VS
            </div>
          </div>

          {/* OPPONENT */}
          <div className="flex flex-col items-center gap-system-sm">
            <div className="text-[14px] font-pressstart uppercase tracking-[0.16em] text-[#c7b5ff]">
              Opponent
            </div>
            <div className="relative">
              <div className="h-[140px] w-[140px] overflow-hidden rounded-full border-4 border-[#6b3dcc] bg-[#0a0217] shadow-[0_0_24px_rgba(107,61,204,0.5),0_0_48px_rgba(107,61,204,0.3)]">
                {safeOpponentAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeOpponentAvatar}
                    alt="Opponent bloblet"
                    className="h-full w-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                    loading="eager"
                    onError={() => setOpponentAvatarErrored(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[48px]">👾</div>
                )}
              </div>
              {/* Rotating ring effect */}
              <div className="pointer-events-none absolute inset-[-4px] rounded-full border-2 border-[rgba(107,61,204,0.4)] blur-sm" />
            </div>
            {/* Hidden Stats (Fog of War) */}
            <div className="flex items-center gap-system-xs text-center text-[9px] font-pressstart text-[#ff8c38]">
              <span>🌫️</span>
              <span>HIDDEN</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Assessment & Stakes Side-by-Side */}
      <div className="flex justify-center gap-system-md">
        {/* Risk Assessment */}
        <InfoPanel
          title="Risk Assessment"
          icon="⚠️"
          borderColor="#ff9500"
          gradientFrom="rgba(40,20,5,0.7)"
          gradientTo="rgba(20,10,3,0.8)"
          titleColor="#ff9500"
        >
          <div className="flex items-center justify-between">
            <span className="text-[#ffb366]">Combat Odds:</span>
            <span style={{ color: riskToneClasses[risk.tone] }} className="font-pressstart">
              {risk.label}
            </span>
          </div>
          <div className="mt-system-sm rounded-sm border border-[rgba(255,149,0,0.3)] bg-[rgba(60,30,10,0.5)] px-system-sm py-system-xs text-[9px]">
            <div className="font-pressstart uppercase tracking-[0.14em] text-[#ffb366]">🌫️ Fog of War</div>
            <div className="mt-1 leading-relaxed text-[#ffb366]/80">
              Opponent boosters hidden
            </div>
          </div>
        </InfoPanel>

        {/* Stakes */}
        <InfoPanel
          title="Stakes"
          icon="💎"
          borderColor="#00d9ff"
          gradientFrom="rgba(5,20,35,0.7)"
          gradientTo="rgba(3,10,20,0.8)"
          titleColor="#00d9ff"
        >
          <div className="flex items-center justify-between text-[#00ff9f]">
            <span>If you WIN:</span>
            <span className="font-pressstart">+125 BC</span>
          </div>
          <div className="flex items-center justify-between text-[#ff6b9a]">
            <span>If LOSE:</span>
            <span className="font-pressstart">-87 BC</span>
          </div>
          <div className="mt-system-sm text-[9px] leading-relaxed text-[#8ff7ff]/70">
            House Fee: 10% · Your Balance: 1,247 BC
          </div>
        </InfoPanel>
      </div>
    </div>
  )
}
