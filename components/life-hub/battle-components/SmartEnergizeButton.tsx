"use client"

import React, { useState, useEffect } from 'react'

import { useLifeHub } from '../LifeHubProvider'
import { useSound } from '@/src/hooks/useSound'

interface SmartEnergizeButtonProps {
  state: 'covered' | 'cooldown' | 'ready'
  targetTime: string | null
  boosterLevel: number
  energizeCost: number | null
  balance: number | null
}

export const SmartEnergizeButton: React.FC<SmartEnergizeButtonProps> = ({
  state,
  targetTime,
  boosterLevel,
  energizeCost,
  balance
}) => {
  const [timeRemaining, setTimeRemaining] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])
  const { play } = useSound()

  const lifeHub = useLifeHub()
  if (!lifeHub) {
    throw new Error('SmartEnergizeButton must be rendered within a LifeHubProvider')
  }

  const {
    energizing,
    disabledReason,
    onEnergize,
    onTopUp,
    topUpStatus,
  } = lifeHub

  // Update countdown timer
  useEffect(() => {
    if (!targetTime || state === 'ready') {
      setTimeRemaining('')
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const target = new Date(targetTime).getTime()
      const diff = Math.max(0, target - now)

      const hours = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)

      if (hours > 0) {
        setTimeRemaining(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      } else {
        setTimeRemaining(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [targetTime, state])

  const hasEnoughBalance = (balance ?? 0) >= (energizeCost ?? 0)
  const buttonDisabled = energizing || state !== 'ready' || !hasEnoughBalance

  // Button state configuration
  const stateConfig = {
    ready: {
      text: energizing ? 'NOURISHING...' : `⚡ NOURISH • ${energizeCost ?? 0} BC`,
      subtext: hasEnoughBalance ? 'Click to refresh boosters' : 'Insufficient BlobCoin',
      color: hasEnoughBalance ? 'cyan' : 'amber',
      borderColor: hasEnoughBalance ? 'border-combat-cyan' : 'border-combat-amber',
      bgGradient: hasEnoughBalance
        ? 'from-[rgba(0,255,247,0.25)] to-[rgba(143,247,255,0.15)]'
        : 'from-[rgba(255,185,70,0.25)] to-[rgba(255,180,107,0.15)]',
      textColor: hasEnoughBalance ? 'text-combat-cyan' : 'text-combat-amber',
      glow: hasEnoughBalance ? 'shadow-[0_0_30px_rgba(0,255,247,0.6)]' : 'shadow-[0_0_30px_rgba(255,185,70,0.5)]',
    },
    cooldown: {
      text: `COOLING DOWN • ${timeRemaining}`,
      subtext: 'Boosters will be ready soon',
      color: 'pink',
      borderColor: 'border-[#ff7fe6]',
      bgGradient: 'from-[rgba(255,127,230,0.25)] to-[rgba(255,127,230,0.15)]',
      textColor: 'text-[#ff7fe6]',
      glow: 'shadow-[0_0_30px_rgba(255,127,230,0.5)]',
    },
    covered: {
      text: `ACTIVE • ${timeRemaining} remaining`,
      subtext: 'Boosters currently active',
      color: 'green',
      borderColor: 'border-[#7dffcf]',
      bgGradient: 'from-[rgba(125,255,207,0.25)] to-[rgba(125,255,207,0.15)]',
      textColor: 'text-[#7dffcf]',
      glow: 'shadow-[0_0_30px_rgba(125,255,207,0.5)]',
    }
  }

  const config = stateConfig[state]

  const handleEnergizeClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonDisabled) return

    // Play Charge Sound
    play('energize_charge')

    // Trigger activation animation
    setIsActivating(true)

    // Create particle burst
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const newParticles = Array.from({ length: 16 }, (_, i) => ({
      id: Date.now() + i,
      x: centerX,
      y: centerY
    }))

    setParticles(newParticles)

    // Clear particles after animation
    setTimeout(() => setParticles([]), 800)
    setTimeout(() => setIsActivating(false), 600)

    // Trigger actual energize
    await onEnergize()
  }

  const buyPointsBusy = Boolean(topUpStatus?.active) || topUpStatus?.autoStatus === 'running'
  const buyPointsApplied = topUpStatus?.phase === 'applied' || topUpStatus?.status === 'applied'
  const buyPointsLabel = buyPointsBusy
    ? 'Buy BlobCoin (processing…)'
    : buyPointsApplied
    ? 'Buy BlobCoin (credited)'
    : 'Buy BlobCoin'

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Screen pulse overlay */}
      {isActivating && (
        <div className="fixed inset-0 pointer-events-none z-50 animate-screen-pulse" />
      )}

      {/* Booster Level Badge */}
      <div className="px-4 py-2 border-2 border-[#ffe780]/40 bg-[rgba(255,231,128,0.1)] font-pressstart text-[11px] text-[#ffe780] rounded">
        Lv {boosterLevel} BOOSTER
      </div>

      {/* Smart Action Button */}
      <button
        type="button"
        onClick={handleEnergizeClick}
        disabled={buttonDisabled}
        className={`
          relative overflow-hidden
          w-[500px] h-[120px]
          border-3 ${config.borderColor}
          bg-gradient-to-r ${config.bgGradient}
          ${config.glow}
          font-pressstart
          transition-all duration-300
          rounded-lg
          ${isActivating ? 'scale-105 brightness-125' : ''}
          ${buttonDisabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-102 hover:brightness-110'}
          flex flex-col items-center justify-center gap-2
        `}
      >
        {/* Animated border lines */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent animate-circuit-flow opacity-50" />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent animate-circuit-flow opacity-50" style={{animationDelay: '1s'}} />

        {/* Main text */}
        <span className={`text-[18px] ${config.textColor} relative z-10`}>
          {config.text}
        </span>

        {/* Subtext */}
        <span className="text-[9px] text-[#c7b5ff]/70 relative z-10">
          {config.subtext}
        </span>

        {/* Energy particles */}
        {particles.map((particle, index) => (
          <div
            key={particle.id}
            className="absolute w-3 h-3 bg-combat-cyan animate-particle-burst shadow-[0_0_8px_rgba(0,255,247,1)] rounded-sm"
            style={{
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              animationDelay: `${index * 0.04}s`,
              animationDuration: '0.8s',
              // @ts-ignore
              '--angle': `${(360 / particles.length) * index}deg`
            }}
          />
        ))}
      </button>

      {/* Secondary Actions */}
      <div className="flex gap-3 items-center">
        {typeof onTopUp === 'function' && (
          <button
            type="button"
            className="px-4 py-2 text-[11px] border border-[#ff7fe6]/50 bg-[rgba(255,127,230,0.1)] text-[#ff7fe6] font-pressstart hover:bg-[rgba(255,127,230,0.2)] transition-all rounded"
            onClick={() => onTopUp()}
            disabled={buyPointsBusy}
          >
            {buyPointsLabel}
          </button>
        )}
      </div>
    </div>
  )
}
