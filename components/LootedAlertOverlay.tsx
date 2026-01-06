"use client"

import React, { useEffect, useState } from 'react'
import { useSound } from '@/src/hooks/useSound'

export type LootedAlertDetail = {
  amount: number
  attackerName: string
  timestamp: number
}

type LootedAlertOverlayProps = {
  detail: LootedAlertDetail
  onDismiss: () => void
}

export const LootedAlertOverlay: React.FC<LootedAlertOverlayProps> = ({ detail, onDismiss }) => {
  const { play } = useSound()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Entrance animation trigger
    const timer = setTimeout(() => setVisible(true), 50)
    play('battle_defeat')
    return () => clearTimeout(timer)
  }, [play])

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
      {/* Backdrop with red tint for danger context */}
      <div 
        className={`absolute inset-0 bg-[#0f0205]/90 backdrop-blur-sm transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onDismiss}
      />

      {/* Alert Container */}
      <div 
        className={`
          relative w-full max-w-md overflow-hidden rounded-system-lg border-2 border-combat-red bg-[rgba(30,5,10,0.95)] 
          p-8 text-center shadow-[0_0_80px_rgba(255,45,45,0.4)] transition-all duration-500
          ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
        `}
      >
        {/* Scan line effect - Red tinted */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="h-[2px] w-full bg-combat-red/50 animate-scan-line" />
        </div>

        {/* Background grid pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,45,45,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,45,45,0.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        {/* Danger Icon */}
        <div className="relative z-10 mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-combat-red bg-combat-red/10 text-4xl shadow-[0_0_30px_rgba(255,45,45,0.3)] animate-pulse">
            ⚠️
          </div>
        </div>

        {/* Header */}
        <h2 className="relative z-10 font-game text-2xl-game text-combat-red drop-shadow-[0_0_10px_rgba(255,45,45,0.8)]">
          YOU&apos;VE BEEN LOOTED
        </h2>

        {/* Details */}
        <div className="relative z-10 mt-6 space-y-2">
          <p className="font-mono text-base-mono text-combat-orange">
            Defeat against <span className="font-bold text-white">{detail.attackerName}</span>
          </p>
          <div className="mt-4 inline-block rounded-system-sm border border-combat-red/30 bg-[#2a0505] px-6 py-3">
            <span className="font-game text-xl-game text-white">
              -{detail.amount} <span className="text-sm text-combat-red">BC</span>
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="relative z-10 mt-8">
          <button
            onClick={onDismiss}
            className="w-full rounded-system-sm border border-combat-red/50 bg-gradient-to-r from-[#5c0a0a] to-[#3d0404] px-6 py-3 font-game text-sm-game text-white shadow-[0_0_20px_rgba(255,45,45,0.25)] transition-all hover:border-combat-red hover:brightness-110 hover:scale-[1.02]"
          >
            ACKNOWLEDGE
          </button>
        </div>

        {/* Decorative corners */}
        <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-combat-red" />
        <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-combat-red" />
        <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-combat-red" />
        <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-combat-red" />
      </div>
    </div>
  )
}
