"use client"

import React from 'react'

interface BattleStatsCardProps {
  title: string
  icon: string
  stats: Array<{
    label: string
    value: string | number
    highlight?: boolean
    progress?: number // 0-100
  }>
  tone?: 'ready' | 'cooldown' | 'warning' | 'success'
}

export const BattleStatsCard: React.FC<BattleStatsCardProps> = ({
  title,
  icon,
  stats,
  tone = 'ready'
}) => {
  const toneConfig = {
    ready: {
      border: 'border-[#8ff7ff]',
      bg: 'bg-[rgba(143,247,255,0.08)]',
      headerBg: 'bg-[rgba(143,247,255,0.15)]',
      text: 'text-[#8ff7ff]',
      glow: 'shadow-[0_0_15px_rgba(143,247,255,0.3)]'
    },
    cooldown: {
      border: 'border-[#ff7fe6]',
      bg: 'bg-[rgba(255,127,230,0.08)]',
      headerBg: 'bg-[rgba(255,127,230,0.15)]',
      text: 'text-[#ff7fe6]',
      glow: 'shadow-[0_0_15px_rgba(255,127,230,0.3)]'
    },
    warning: {
      border: 'border-[#ffb46b]',
      bg: 'bg-[rgba(255,180,107,0.08)]',
      headerBg: 'bg-[rgba(255,180,107,0.15)]',
      text: 'text-[#ffb46b]',
      glow: 'shadow-[0_0_15px_rgba(255,180,107,0.3)]'
    },
    success: {
      border: 'border-[#7dffcf]',
      bg: 'bg-[rgba(125,255,207,0.08)]',
      headerBg: 'bg-[rgba(125,255,207,0.15)]',
      text: 'text-[#7dffcf]',
      glow: 'shadow-[0_0_15px_rgba(125,255,207,0.3)]'
    }
  }

  const config = toneConfig[tone]

  return (
    <div className={`
      clip-slash-corner-br border-2 ${config.border} ${config.bg} ${config.glow}
      overflow-hidden relative
      transition-all duration-300
      hover:scale-[1.02]
      damage-texture battle-scratches
    `}>
      {/* Header */}
      <div className={`${config.headerBg} px-4 py-2 flex items-center gap-2 border-b-2 ${config.border} relative z-10`}>
        <span className="text-[16px]">{icon}</span>
        <span className={`font-pressstart text-[9px] ${config.text} tracking-wider`}>
          {title}
        </span>
        {/* Tech corner accent */}
        <div className="ml-auto w-2 h-2 border-t-2 border-r-2 ${config.border} opacity-50" />
      </div>

      {/* Stats */}
      <div className="px-4 py-3 space-y-3 relative z-10">
        {stats.map((stat, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-pressstart text-[8px] text-[#c7b5ff] uppercase tracking-wide">
                {stat.label}
              </span>
              <span className={`
                font-pressstart text-[10px]
                ${stat.highlight ? config.text : 'text-white'}
              `}>
                {stat.value}
              </span>
            </div>

            {/* Progress bar if provided */}
            {stat.progress !== undefined && (
              <div className="h-2 bg-[rgba(20,8,50,0.9)] clip-slash-corner-tl overflow-hidden border border-[rgba(0,255,247,0.2)]">
                <div
                  className={`h-full ${config.border.replace('border', 'bg')} transition-all duration-500 animate-circuit-flow`}
                  style={{
                    width: `${stat.progress}%`,
                    boxShadow: `0 0 8px currentColor`
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Warning flash animation for warning tone */}
      {tone === 'warning' && (
        <div className="absolute inset-0 animate-warning-flash pointer-events-none z-0" />
      )}
    </div>
  )
}
