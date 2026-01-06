"use client"

import React, { useState, useEffect } from 'react'

interface BattleTimerProps {
  state: 'covered' | 'cooldown' | 'ready'
  targetTime: string | null
  boosterLevel: number
}

export const BattleTimer: React.FC<BattleTimerProps> = ({
  state,
  targetTime,
  boosterLevel
}) => {
  const [timeRemaining, setTimeRemaining] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!targetTime) {
      setTimeRemaining('READY')
      setProgress(100)
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const target = new Date(targetTime).getTime()
      const diff = Math.max(0, target - now)

      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)

      // Calculate progress (assuming 1 hour max cooldown)
      const totalDuration = 3600000 // 1 hour
      setProgress(Math.max(0, Math.min(100, ((totalDuration - diff) / totalDuration) * 100)))
    }, 100)

    return () => clearInterval(interval)
  }, [targetTime])

  const stateColors = {
    covered: {
      ring: 'stroke-[#7dffcf]',
      glow: 'shadow-[0_0_20px_rgba(125,255,207,0.6)]',
      text: 'text-[#7dffcf]',
      label: 'ACTIVE'
    },
    cooldown: {
      ring: 'stroke-[#ff7fe6]',
      glow: 'shadow-[0_0_20px_rgba(255,127,230,0.5)]',
      text: 'text-[#ff7fe6]',
      label: 'COOLDOWN'
    },
    ready: {
      ring: 'stroke-[#8ff7ff]',
      glow: 'shadow-[0_0_24px_rgba(143,247,255,0.8)]',
      text: 'text-[#8ff7ff]',
      label: 'READY'
    }
  }

  const colors = stateColors[state]
  const circumference = 2 * Math.PI * 75
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex flex-col items-center">
      {/* SVG Ring - Enlarged to 180x180 */}
      <div className={`relative ${colors.glow} cracked-glass`}>
        {/* Radar sweep effect for active state */}
        {state === 'covered' && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute top-1/2 left-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-[#7dffcf] to-transparent opacity-60 animate-radar-sweep origin-center" />
          </div>
        )}

        <svg width="180" height="180" className="transform -rotate-90 relative z-10">
          {/* Background ring */}
          <circle
            cx="90"
            cy="90"
            r="75"
            fill="none"
            stroke="rgba(148,93,255,0.2)"
            strokeWidth="10"
          />
          {/* Animated progress ring */}
          <circle
            cx="90"
            cy="90"
            r="75"
            fill="none"
            className={`${colors.ring} transition-all duration-300 animate-hologram-flicker`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: 'drop-shadow(0 0 8px currentColor)'
            }}
          />
          {/* Inner hexagonal frame */}
          <polygon
            points="90,25 145,57.5 145,122.5 90,155 35,122.5 35,57.5"
            fill="none"
            stroke="rgba(0,255,247,0.3)"
            strokeWidth="1"
            className="animate-energy-pulse"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className={`font-pressstart text-[24px] ${colors.text} animate-pulse-subtle`}>
            {timeRemaining}
          </div>
          <div className={`font-pressstart text-[10px] mt-2 ${colors.text} opacity-70`}>
            {colors.label}
          </div>
        </div>

        {/* Corner markers */}
        <div className="corner-markers" />
      </div>

      {/* Booster level indicator with tech styling */}
      <div className="mt-4 font-pressstart text-[11px] text-[#ffe780] border border-[#ffe780]/40 px-3 py-1 clip-slash-corner-tl bg-[rgba(255,231,128,0.1)]">
        Lv {boosterLevel} BOOSTER
      </div>
    </div>
  )
}
