import { useState, useEffect } from 'react'
import type { ChallengeResult } from '@/components/ChallengeModal'
import { defaultAvatars } from '@/components/bloblets-world/avatar'
import { useSound } from '@/src/hooks/useSound'

export type ChallengeBattleStageProps = {
  myAddress: string
  opponentAddress: string
  myAvatarUrl: string | null
  opponentAvatarUrl: string | null
  result: ChallengeResult | null
}

export function ChallengeBattleStage(props: ChallengeBattleStageProps) {
  const { myAddress, opponentAddress, myAvatarUrl, opponentAvatarUrl, result } = props
  const [showImpact, setShowImpact] = useState(false)
  const [showDamage, setShowDamage] = useState(false)
  const { play } = useSound()

  const iAmWinner = result?.winner === 'attacker'

  // Battle Sequence Audio & Visuals
  useEffect(() => {
    // 1. Launch Sound immediately
    play('battle_launch')

    // 2. Impact (Visual + Audio)
    const impactTimer = setTimeout(() => {
      setShowImpact(true)
      play('battle_impact')
    }, 300)

    // 3. Damage/Result (Visual + Audio)
    const damageTimer = setTimeout(() => {
      setShowDamage(true)
      if (result) {
        if (iAmWinner) {
          play('battle_win')
        } else {
          play('battle_defeat')
        }
      }
    }, 600)

    return () => {
      clearTimeout(impactTimer)
      clearTimeout(damageTimer)
    }
  }, [play, result, iAmWinner])

  // Calculate health percentages (simulated for animation)
  const myHealthPercent = result ? (result.winner === 'attacker' ? 75 : 25) : 50
  const opponentHealthPercent = result ? (result.winner === 'defender' ? 60 : 15) : 50
  const isCritical = result?.critical || false
  const opponentLabel = result?.opponent?.maskedId || 'Opponent'

  return (
    <div className="relative flex min-h-[500px] flex-col gap-system-lg px-system-lg py-system-lg">
      {/* Battle In Progress Header */}
      <div className="text-center">
        <div className="animate-pulse font-pressstart text-[10px] uppercase tracking-[0.18em] text-[#ff2dd7]">
          ⚔️ Battle In Progress
        </div>
      </div>

      {/* Health Bars */}
      <div className="grid grid-cols-2 gap-system-lg">
        {/* Your Health */}
        <div>
          <div className="mb-system-xs flex items-center justify-between text-[9px] font-pressstart">
            <span className="text-[#00ffff]">YOU</span>
            <span className="text-[#00ffff]">{myHealthPercent}%</span>
          </div>
          <div className="h-[12px] overflow-hidden rounded-full border-2 border-[#00ffff] bg-[#0a0217]">
            <div
              className="h-full bg-gradient-to-r from-[#00ffff] to-[#00ff9f] shadow-[0_0_12px_rgba(0,255,255,0.6)] transition-all duration-1000"
              style={{ width: `${myHealthPercent}%` }}
            />
          </div>
        </div>

        {/* Opponent Health */}
        <div>
          <div className="mb-system-xs flex items-center justify-between text-[9px] font-pressstart">
            <span className="text-[#ff6b9a]">OPPONENT</span>
            <span className="text-[#ff6b9a]">{opponentHealthPercent}%</span>
          </div>
          <div className="h-[12px] overflow-hidden rounded-full border-2 border-[#ff6b9a] bg-[#0a0217]">
            <div
              className="h-full bg-gradient-to-r from-[#ff6b9a] to-[#ff2d2d] shadow-[0_0_12px_rgba(255,107,154,0.6)] transition-all duration-1000"
              style={{ width: `${opponentHealthPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Combat Zone */}
      <div className="relative flex flex-1 items-center justify-center">
        {/* Your Bloblet (Left) */}
        <div className={`absolute left-[20%] transition-all duration-500 ${showImpact ? 'scale-110' : 'scale-100'}`}>
          <div className="relative">
            <div className="h-[96px] w-[96px] overflow-hidden rounded-full border-4 border-[#00ffff] bg-[#0a0217] shadow-[0_0_24px_rgba(0,255,255,0.6)]">
              {myAvatarUrl || defaultAvatars.alive ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={myAvatarUrl || defaultAvatars.alive || ''}
                  alt="Your bloblet"
                  className="h-full w-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[48px]">🎮</div>
              )}
            </div>
            {/* Attack indicator */}
            {iAmWinner && (
              <div className="absolute -right-4 top-0 animate-bounce text-[24px]">⚔️</div>
            )}
          </div>
        </div>

        {/* Central Impact Zone */}
        {showImpact && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {/* Explosion Effect */}
            <div className="relative h-[120px] w-[120px]">
              {/* Core Flash */}
              <div className="absolute inset-0 animate-ping rounded-full bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 opacity-75" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-200 via-orange-300 to-red-400 blur-xl" />

              {/* Shockwave Rings */}
              <div className="absolute inset-[-20px] animate-ping rounded-full border-4 border-[#ff8c38] opacity-60" style={{ animationDelay: '0.1s' }} />
              <div className="absolute inset-[-40px] animate-ping rounded-full border-2 border-[#ffb946] opacity-40" style={{ animationDelay: '0.2s' }} />
            </div>

            {/* Floating Damage Number */}
            {showDamage && isCritical && (
              <div className="absolute left-1/2 top-[-60px] -translate-x-1/2 animate-bounce">
                <div className="text-center">
                  <div className="font-pressstart text-[11px] uppercase tracking-[0.14em] text-[#ffe780]">
                    Critical Hit!
                  </div>
                  <div className="mt-1 font-pressstart text-[20px] text-[#ff2d2d]">
                    -45 HP
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Opponent Bloblet (Right) */}
        <div className={`absolute right-[20%] transition-all duration-500 ${showImpact ? 'scale-90' : 'scale-100'}`}>
          <div className="relative">
            <div className="h-[96px] w-[96px] overflow-hidden rounded-full border-4 border-[#ff6b9a] bg-[#0a0217] shadow-[0_0_24px_rgba(255,107,154,0.6)]">
              {opponentAvatarUrl || defaultAvatars.alive ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={opponentAvatarUrl || defaultAvatars.alive || ''}
                  alt="Opponent bloblet"
                  className="h-full w-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[48px]">👾</div>
              )}
            </div>
            {/* Defense indicator */}
            {!iAmWinner && (
              <div className="absolute -left-4 top-0 animate-bounce text-[24px]">🛡️</div>
            )}
          </div>
        </div>

        {/* Speed Lines Effect */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,45,215,0.1)] to-transparent opacity-50" />
        </div>
      </div>

      {/* Battle Rolls Display */}
      {result && (
        <div className="grid grid-cols-2 gap-system-md">
          {/* Your Roll */}
          <div className="rounded-system-sm border-2 border-[#00ffff] bg-[rgba(0,20,26,0.6)] px-system-md py-system-sm text-center">
            <div className="text-[8px] font-pressstart uppercase tracking-[0.14em] text-[#00ffff]">
              Your Roll
            </div>
            <div className="mt-1 font-pressstart text-[24px] text-[#00ff9f]">
              {result.attacker.roll}
            </div>
            <div className="mt-1 text-[8px] text-[#8ff7ff]">
              Base {result.attacker.base} + Booster +{result.attacker.booster}
            </div>
          </div>

          {/* Opponent Roll */}
          <div className="rounded-system-sm border-2 border-[#ff6b9a] bg-[rgba(40,6,26,0.6)] px-system-md py-system-sm text-center">
            <div className="text-[8px] font-pressstart uppercase tracking-[0.14em] text-[#ff6b9a]">
              {opponentLabel} Roll
            </div>
            <div className="mt-1 font-pressstart text-[24px] text-[#ff2d2d]">
              ???
            </div>
            <div className="mt-1 text-[8px] text-[#ffb3e1]">
              Stats hidden (fog-of-war)
            </div>
          </div>
        </div>
      )}

      {/* Battle Status Log */}
      {result && (
        <div className="rounded-system-sm border border-[rgba(107,61,204,0.4)] bg-[rgba(26,13,53,0.8)] px-system-md py-system-sm">
          <div className="text-center text-[9px] font-pressstart leading-relaxed text-[#c7b5ff]">
            {iAmWinner ? (
              <>
                <span className="text-[#00ff9f]">⚔️ You struck {isCritical ? 'CRITICAL' : 'true'}!</span>
                <span className="mx-2">·</span>
                <span className="text-[#ff6b9a]">Opponent blocked 40%</span>
              </>
            ) : (
              <>
                <span className="text-[#ff2d2d]">🛡️ Opponent struck back!</span>
                <span className="mx-2">·</span>
                <span className="text-[#ff8c38]">You defended but took damage</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
