"use client"

import React, { useState } from 'react'

import { useLifeHub } from '../LifeHubProvider'

type EnergizeCTABattleProps = {
  className?: string
}

export const EnergizeCTABattle: React.FC<EnergizeCTABattleProps> = ({ className }) => {
  const [isActivating, setIsActivating] = useState(false)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])

  const lifeHub = useLifeHub()
  if (!lifeHub) {
    throw new Error('EnergizeCTABattle must be rendered within a LifeHubProvider')
  }

  const {
    energizing,
    disabledReason,
    helperLabel,
    onEnergize,
    onTopUp,
    topUpStatus,
  } = lifeHub

  const buttonDisabled = energizing || !!disabledReason

  const handleEnergizeClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonDisabled) return

    // Trigger activation animation
    setIsActivating(true)

    // Create particle burst
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: centerX,
      y: centerY
    }))

    setParticles(newParticles)

    // Clear particles after animation
    setTimeout(() => setParticles([]), 800)

    // Clear activation state
    setTimeout(() => setIsActivating(false), 600)

    // Trigger actual energize
    await onEnergize()
  }

  const handleTopUpClick = () => {
    onTopUp?.()
  }

  const buyPointsBusy = Boolean(topUpStatus?.active) || topUpStatus?.autoStatus === 'running'
  const buyPointsApplied =
    topUpStatus?.phase === 'applied' || topUpStatus?.status === 'applied'
  const buyPointsLabel = buyPointsBusy
    ? 'Buy BlobCoin (processing…)'
    : buyPointsApplied
    ? 'Buy BlobCoin (credited)'
    : 'Buy BlobCoin'

  const rootClassName = ['flex flex-col gap-3 items-stretch w-[380px]', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClassName}>
      {/* Screen pulse overlay */}
      {isActivating && (
        <div className="fixed inset-0 pointer-events-none z-50 animate-screen-pulse" />
      )}

      {/* Nourish button - Aggressive angular design */}
      <button
        type="button"
        onClick={handleEnergizeClick}
        disabled={buttonDisabled}
        className={`
          relative overflow-hidden
          clip-slash-corner-tr
          border-3 border-combat-cyan tech-border
          bg-gradient-to-r from-[rgba(143,247,255,0.25)] to-[rgba(125,255,207,0.2)]
          px-8 py-5
          font-pressstart text-[16px]
          text-combat-cyan
          transition-all duration-300
          shadow-[0_0_25px_rgba(143,247,255,0.5)]
          ${isActivating ? 'scale-110 shadow-[0_0_50px_rgba(143,247,255,1)] animate-energy-pulse' : ''}
          ${buttonDisabled ? 'cursor-not-allowed opacity-50' : 'hover:scale-105 hover:shadow-[0_0_35px_rgba(143,247,255,0.7)]'}
          corner-markers
          damage-texture
        `}
      >
        {/* Button background pulse effect */}
        <div className={`
          absolute inset-0
          bg-gradient-to-r from-[#8ff7ff] via-[#7dffcf] to-[#8ff7ff]
          opacity-0
          ${isActivating ? 'animate-button-charge' : ''}
        `} />

        {/* Animated circuit lines */}
        <div className="absolute top-0 left-0 right-0 h-0.5 animate-circuit-flow" />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 animate-circuit-flow" style={{animationDelay: '0.5s'}} />

        {/* Button text */}
        <span className="relative z-10">
          {energizing ? 'NOURISHING...' : '⚡ NOURISH'}
        </span>

        {/* Energy particles */}
        {particles.map((particle, index) => (
          <div
            key={particle.id}
            className="absolute w-2 h-2 clip-hexagon bg-[#8ff7ff] animate-particle-burst shadow-[0_0_8px_rgba(143,247,255,1)]"
            style={{
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              animationDelay: `${index * 0.05}s`,
              animationDuration: '0.8s',
              // @ts-ignore - CSS custom property
              '--angle': `${(360 / particles.length) * index}deg`
            }}
          />
        ))}
      </button>

      {/* Buy BlobCoin button - Angular design */}
      {typeof onTopUp === 'function' ? (
        <button
          type="button"
          className="clip-slash-corner-bl px-5 py-3 text-[12px] border-2 border-[#ff7fe6]/50 bg-[rgba(255,127,230,0.1)] text-[#ff7fe6] font-pressstart hover:bg-[rgba(255,127,230,0.2)] transition-all"
          onClick={handleTopUpClick}
          disabled={buyPointsBusy}
        >
          {buyPointsLabel}
        </button>
      ) : null}

      {/* Helper text - Combat styling */}
      <div className="text-[10px] text-[#c7b5ff] border-l-2 border-combat-cyan/40 pl-3 py-1">
        {disabledReason || helperLabel || 'Unleash energy to activate boosters and roll for combat rewards'}
      </div>
    </div>
  )
}
