"use client"

import React from 'react'
import { useSound } from '@/src/hooks/useSound'
import HudTooltip from './HudTooltip'

export function SoundToggle() {
  const { muted, toggleMute } = useSound()

  return (
    <HudTooltip content={muted ? 'Unmute Audio' : 'Mute Audio'} side="left">
      <button
        type="button"
        onClick={toggleMute}
        className="pointer-events-auto grid h-12 w-12 place-items-center rounded-system-sm border border-[rgba(148,93,255,0.35)] bg-[rgba(22,10,48,0.85)] text-[18px] text-[#c7b5ff] shadow-[0_14px_32px_rgba(12,2,28,0.45)] transition hover:border-[rgba(255,134,230,0.45)] hover:text-white hover:shadow-[0_18px_40px_rgba(12,2,28,0.65)]"
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={!muted}
        data-hud-interactive="true"
      >
        <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
      </button>
    </HudTooltip>
  )
}
