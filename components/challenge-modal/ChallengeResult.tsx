import { formatDisplayPoints } from '@/src/shared/points'
import type { ChallengeResult } from '@/components/ChallengeModal'
import type { PvpItem } from '@/types'
import { Button } from '@/components/ui'

type ChallengeResultProps = {
  result: ChallengeResult
  myAddressCanonical: string
  onClose: () => void
  onNewChallenge: () => void
  itemCatalog?: Record<number, PvpItem>
  myAvatarUrl?: string | null
  opponentAvatarUrl?: string | null
}

const formatPointsDelta = (value: number) =>
  formatDisplayPoints(Math.abs(value), Math.abs(value) >= 10 ? { maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })

const formatRoll = (value: number) =>
  formatDisplayPoints(value, { maximumFractionDigits: 1 })

export function ChallengeResultView(props: ChallengeResultProps) {
  const { result, myAddressCanonical: _myAddressCanonical, onClose, onNewChallenge, itemCatalog, myAvatarUrl, opponentAvatarUrl } = props

  const iWon = result.winner === 'attacker'

  const pointsDelta = result.attacker.pointsAfter - result.attacker.pointsBefore

  const myData = result.attacker
  const opponentLabel = result.opponent?.maskedId || 'Unknown opponent'
  const opponentRollLabel = '???'
  const myRollDisplay = formatRoll(result.attacker.roll)
  const winnerRollDisplay = iWon ? myRollDisplay : opponentRollLabel
  const defeatedRollDisplay = iWon ? opponentRollLabel : myRollDisplay

  const lootWithIcons = (result.loot || [])
    .map((entry) => {
      const item = entry.item_id && itemCatalog ? itemCatalog[entry.item_id] : null
      if (!item) return null
      return { name: `${item.name}`, icon: item.icon_url || null, slot: entry.slot, equipped: entry.equipped }
    })
    .filter(Boolean) as Array<{ name: string; icon: string | null; slot: 'weapon' | 'shield'; equipped: boolean }>

  // Calculate simulated stats for display (matching mockup aesthetics)
  const winnerHealth = iWon ? 56 : 60
  const defeatedHealth = 0
  const battleDuration = '3.2s'
  const defenseBonus = myData.shield?.op || 15
  const damageDealt = Math.max(0, Math.round(myData.roll))

  return (
    <div className="flex min-h-[500px] flex-col gap-system-lg px-system-lg py-system-lg">
      {/* Victory/Defeat Header */}
      <div className="text-center">
        <div className="text-[48px]">{iWon ? '🏆' : '💀'}</div>
        <div
          className="mt-2 font-pressstart text-[18px] uppercase tracking-[0.18em]"
          style={{ color: iWon ? '#ffe780' : '#ff6b9a' }}
        >
          {iWon ? 'VICTORY!' : 'DEFEATED'}
        </div>
        <div className="mt-1 text-[10px] text-[#c7b5ff]">
          {iWon ? 'You have triumphed in glorious combat' : 'You have fallen in battle'}
        </div>
        <div className="mt-1 text-[10px] text-[#8f7fb3]">
          Opponent: {opponentLabel}
        </div>
      </div>

      {/* Battle Summary */}
      <div className="rounded-system-lg border-2 border-[rgba(107,61,204,0.4)] bg-[rgba(26,13,53,0.8)] px-system-lg py-system-md">
        <div className="mb-system-md text-center font-pressstart text-[9px] uppercase tracking-[0.18em] text-[#c7b5ff]">
          ⚔️ Battle Summary
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-system-md">
          {/* Winner Section */}
          <div className="text-center">
            <div className="mb-system-xs font-pressstart text-[8px] uppercase tracking-[0.14em] text-[#00ffff]">
              WINNER
            </div>
            <div className="mx-auto h-[80px] w-[80px] overflow-hidden rounded-full border-4 border-[#00ffff] bg-[#0a0217] shadow-[0_0_24px_rgba(0,255,255,0.6)]">
              {iWon ? (
                myAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={myAvatarUrl} alt="Winner" className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                ) : <div className="flex h-full w-full items-center justify-center text-[40px]">🎮</div>
              ) : (
                opponentAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opponentAvatarUrl} alt="Winner" className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                ) : <div className="flex h-full w-full items-center justify-center text-[40px]">👾</div>
              )}
            </div>
            <div className="mt-system-sm space-y-1 text-[8px]">
              <div className="flex items-center justify-center gap-1 text-[#8ff7ff]">
                <span>⚔️ Duration</span>
                <span className="text-white">{battleDuration}</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-[#8ff7ff]">
                <span>🛡️ Defense</span>
                <span className="text-white">+{defenseBonus}</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-[#8ff7ff]">
                <span>💥 Damage Dealt</span>
                <span className="text-white">{damageDealt}</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-[#00ff9f]">
                <span>❤️ Final Health</span>
                <span className="font-pressstart text-white">{winnerHealth}%</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-[#00ff9f]">
                <span>🎲 Combat Roll</span>
                <span className="font-pressstart text-white">{winnerRollDisplay}</span>
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div className="font-pressstart text-[16px] text-[#ff9de1]">VS</div>

          {/* Defeated Section */}
          <div className="text-center">
            <div className="mb-system-xs font-pressstart text-[8px] uppercase tracking-[0.14em] text-[#ff6b9a]">
              DEFEATED
            </div>
            <div className="mx-auto h-[80px] w-[80px] overflow-hidden rounded-full border-4 border-[#ff6b9a] bg-[#0a0217] shadow-[0_0_24px_rgba(255,107,154,0.6)]">
              {!iWon ? (
                myAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={myAvatarUrl} alt="Defeated" className="h-full w-full object-contain grayscale" style={{ imageRendering: 'pixelated' }} />
                ) : <div className="flex h-full w-full items-center justify-center text-[40px]">🎮</div>
              ) : (
                opponentAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opponentAvatarUrl} alt="Defeated" className="h-full w-full object-contain grayscale" style={{ imageRendering: 'pixelated' }} />
                ) : <div className="flex h-full w-full items-center justify-center text-[40px]">👾</div>
              )}
            </div>
            <div className="mt-system-sm space-y-1 text-[8px]">
              <div className="flex items-center justify-center gap-1 text-[#ff2d2d]">
                <span>❤️ Final Health</span>
                <span className="font-pressstart text-white">{defeatedHealth}%</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-[#ffb3e1]">
                <span>🎲 Combat Roll</span>
                <span className="font-pressstart text-white">{defeatedRollDisplay}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spoils of War */}
      <div className="rounded-system-lg border-2 border-[rgba(107,61,204,0.4)] bg-[rgba(26,13,53,0.8)] px-system-lg py-system-md">
        <div className="mb-system-md text-center font-pressstart text-[9px] uppercase tracking-[0.18em] text-[#c7b5ff]">
          💎 Spoils of War
        </div>

        <div className="grid grid-cols-2 gap-system-md">
          {/* BlobCoin Panel */}
          <div className="rounded-system-md border-2 border-[#00ffff] bg-[rgba(0,20,26,0.6)] px-system-md py-system-lg text-center shadow-[0_0_20px_rgba(0,255,255,0.2)]">
            <div className="font-pressstart text-[24px] text-[#00ff9f]">
              {pointsDelta >= 0 ? '+' : ''}{formatPointsDelta(pointsDelta)} BC
            </div>
            <div className="mt-1 text-[8px] text-[#8ff7ff]">BlobCoin</div>
          </div>

          {/* Battle Loot Panel */}
          <div className="rounded-system-md border-2 border-[#945dff] bg-[rgba(40,6,26,0.6)] px-system-md py-system-sm">
            <div className="mb-system-xs text-center font-pressstart text-[9px] uppercase tracking-[0.14em] text-[#c7b5ff]">
              Battle Loot
            </div>
            {lootWithIcons.length > 0 ? (
              <div className="space-y-1">
                {lootWithIcons.map((item, i) => (
                  <div key={`loot-${i}`} className="flex items-center gap-2 text-[9px]">
                    {item.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.icon}
                        alt=""
                        className="h-6 w-6 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <span className="text-[20px]" aria-hidden>
                        {item.slot === 'shield' ? '🛡️' : '⚔️'}
                      </span>
                    )}
                    <div>
                      <div className="text-white">{item.name}</div>
                      {item.equipped && (
                        <div className="text-[7px] text-[#ffe780]">★ EQUIPPED</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-system-sm text-center text-[9px] text-[#8f7fb3]">No items dropped</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="grid grid-cols-3 gap-system-md">
        <button
          type="button"
          className="rounded-system-sm border-2 border-[rgba(107,61,204,0.5)] bg-transparent px-system-sm py-system-sm font-pressstart text-[9px] uppercase tracking-[0.14em] text-[#c7b5ff] transition-all duration-200 hover:border-[#6b3dcc] hover:bg-[rgba(107,61,204,0.2)]"
          onClick={() => {
            // TODO: Implement detailed stats view
            console.log('Detailed stats clicked')
          }}
        >
          📊 Detailed Stats
        </button>
        <button
          type="button"
          className="rounded-system-sm border-2 border-[#ffe780] bg-gradient-to-r from-[#ff8c38] to-[#ffe780] px-system-sm py-system-sm font-pressstart text-[9px] uppercase tracking-[0.14em] text-[#1a0d35] transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,231,128,0.4)]"
          onClick={onNewChallenge}
        >
          ⚔️ Challenge Another
        </button>
        <button
          type="button"
          className="rounded-system-sm border-2 border-[rgba(107,61,204,0.5)] bg-transparent px-system-sm py-system-sm font-pressstart text-[9px] uppercase tracking-[0.14em] text-[#c7b5ff] transition-all duration-200 hover:border-[#6b3dcc] hover:bg-[rgba(107,61,204,0.2)]"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}
