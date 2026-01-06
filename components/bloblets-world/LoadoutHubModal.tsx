"use client"

import React, { useEffect, useState } from 'react'
import type { LoadoutCard } from './loadoutSelectors'
import { GearCard } from './GearCard'
import { usePlayerStatus } from '@/src/client/hooks/usePlayerStatus'
import { usePersonaAssets } from '@/src/client/hooks/persona/usePersonaAssets'

type LoadoutHubModalProps = {
  primaryCards: LoadoutCard[]
  futureCards: LoadoutCard[]
  onClose: () => void
  onManageGear: () => void
  onLaunchChallenge: () => void
}

// Empty slot component for unequipped positions
const EmptySlot: React.FC<{ kind: 'weapon' | 'shield'; onClick: () => void; hasStash: boolean }> = ({ kind, onClick, hasStash }) => {
  const icon = kind === 'weapon' ? '⚔️' : '🛡️'
  const label = kind === 'weapon' ? 'Weapon' : 'Shield'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-[220px] w-[180px] overflow-hidden rounded-[28px] border-2 border-dashed border-[rgba(148,93,255,0.42)] bg-[rgba(16,6,40,0.75)] transition-all duration-300 hover:border-[rgba(255,157,225,0.65)] hover:bg-[rgba(20,8,44,0.85)] hover:shadow-[0_0_30px_rgba(255,157,225,0.3)]"
    >
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-[64px] opacity-25 grayscale transition-all duration-300 group-hover:opacity-40 group-hover:grayscale-0">{icon}</div>
        <div className="space-y-2">
          <div className="text-[14px] font-semibold text-[#8ff7ff]">
            {hasStash ? `Select ${label}` : `Get Your First ${label}`}
          </div>
          {hasStash ? (
            <div className="text-[11px] text-[#8ff7ff]/60">Click to equip from stash</div>
          ) : (
            <div className="space-y-2">
              <div className="inline-block rounded-full border border-[rgba(255,157,225,0.5)] bg-[rgba(255,157,225,0.15)] px-3 py-1 text-[10px] font-semibold text-[#ff9de1]">
                💎 Nourish to Equip
              </div>
              <div className="text-[10px] leading-relaxed text-[#c7b5ff]/70">
                Guaranteed gear drop within 5 energizes
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

export const LoadoutHubModal: React.FC<LoadoutHubModalProps> = ({
  primaryCards,
  futureCards,
  onClose,
  onManageGear,
  onLaunchChallenge,
}) => {
  const { data: status } = usePlayerStatus({ refreshIntervalMs: 120000 })
  const boosterLevel = status?.care?.boosterLevel ?? 0
  const coveredUntil = status?.care?.boostersActiveUntil ?? null

  // Get bloblet avatar data
  const { bloblet } = usePersonaAssets()
  const avatarUrl = bloblet?.avatarUrl256 || bloblet?.avatarUrl

  // Separate weapon and shield
  const weaponCard = primaryCards.find((c) => c.kind === 'weapon')
  const shieldCard = primaryCards.find((c) => c.kind === 'shield')

  // Track equipment changes for entrance animations
  const [showWeaponAnimation, setShowWeaponAnimation] = useState(false)
  const [showShieldAnimation, setShowShieldAnimation] = useState(false)
  const [prevWeaponKey, setPrevWeaponKey] = useState<string | null>(null)
  const [prevShieldKey, setPrevShieldKey] = useState<string | null>(null)

  // Set modal-open attribute on body to hide sidebar
  useEffect(() => {
    document.body.setAttribute('data-modal-open', 'true')
    return () => {
      document.body.removeAttribute('data-modal-open')
    }
  }, [])

  // Detect equipment changes and trigger animations
  useEffect(() => {
    const currentWeaponKey = weaponCard?.equipped ? weaponCard.key : null
    const currentShieldKey = shieldCard?.equipped ? shieldCard.key : null

    // Weapon changed or newly equipped
    if (currentWeaponKey && currentWeaponKey !== prevWeaponKey) {
      setShowWeaponAnimation(true)
      setTimeout(() => setShowWeaponAnimation(false), 500) // Animation duration
    }

    // Shield changed or newly equipped
    if (currentShieldKey && currentShieldKey !== prevShieldKey) {
      setShowShieldAnimation(true)
      setTimeout(() => setShowShieldAnimation(false), 500) // Animation duration
    }

    setPrevWeaponKey(currentWeaponKey)
    setPrevShieldKey(currentShieldKey)
  }, [weaponCard?.key, weaponCard?.equipped, shieldCard?.key, shieldCard?.equipped, prevWeaponKey, prevShieldKey])

  // Extract stat values for equipment status
  const getStatValue = (statValue: string | undefined): number => {
    if (!statValue) return 0
    const match = statValue.match(/\+?(\d+)/)
    return match && match[1] ? parseInt(match[1], 10) : 0
  }

  const weaponOP = weaponCard?.equipped ? getStatValue(weaponCard.statValue) : 0
  const shieldDP = shieldCard?.equipped ? getStatValue(shieldCard.statValue) : 0
  const totalPower = weaponOP + shieldDP

  // Calculate roll range (base + luck variance ±20%)
  const baseRoll = totalPower
  const minRoll = Math.round(baseRoll * 0.8)
  const maxRoll = Math.round(baseRoll * 1.2)

  const shieldEmptyOrZero = !shieldCard || !shieldCard.equipped || shieldDP === 0
  const isBattleReady = weaponCard?.equipped && shieldCard?.equipped

  // Get stash count for inventory visibility
  const stashCount = Array.isArray(status?.gear?.stash) ? status.gear.stash.length : 0

  return (
    <div className="relative w-[920px] max-w-[calc(100vw-72px)] max-h-[90vh] overflow-y-auto rounded-[36px] border-2 border-[rgba(148,93,255,0.65)] bg-[rgba(16,6,40,0.85)] px-3 py-3 shadow-[0_0_60px_rgba(148,93,255,0.65),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(143,247,255,0.3)]">
      {/* Atmospheric background layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
        {/* Purple nebula glow */}
        <div className="absolute inset-0 bg-gradient-radial from-[rgba(148,93,255,0.25)] via-[rgba(255,45,215,0.15)] to-transparent opacity-75" />

        {/* Star field - layer 1 (small stars - 25 total) */}
        <div className="absolute inset-0 opacity-65" style={{
          backgroundImage: 'radial-gradient(1px 1px at 20% 15%, white, transparent), radial-gradient(1px 1px at 75% 35%, white, transparent), radial-gradient(1px 1px at 45% 60%, white, transparent), radial-gradient(1px 1px at 85% 80%, white, transparent), radial-gradient(1px 1px at 10% 45%, white, transparent), radial-gradient(1px 1px at 60% 25%, white, transparent), radial-gradient(1px 1px at 30% 85%, white, transparent), radial-gradient(1px 1px at 95% 50%, white, transparent), radial-gradient(1px 1px at 12% 72%, white, transparent), radial-gradient(1px 1px at 55% 8%, white, transparent), radial-gradient(1px 1px at 88% 42%, white, transparent), radial-gradient(1px 1px at 35% 28%, white, transparent), radial-gradient(1px 1px at 68% 92%, white, transparent), radial-gradient(1px 1px at 22% 55%, white, transparent), radial-gradient(1px 1px at 78% 12%, white, transparent), radial-gradient(1px 1px at 42% 78%, white, transparent), radial-gradient(1px 1px at 92% 65%, white, transparent), radial-gradient(1px 1px at 5% 20%, white, transparent), radial-gradient(1px 1px at 50% 45%, white, transparent), radial-gradient(1px 1px at 82% 55%, white, transparent), radial-gradient(1px 1px at 15% 88%, white, transparent), radial-gradient(1px 1px at 65% 15%, white, transparent), radial-gradient(1px 1px at 38% 95%, white, transparent), radial-gradient(1px 1px at 72% 68%, white, transparent), radial-gradient(1px 1px at 25% 38%, white, transparent)',
          backgroundSize: '250px 250px'
        }} />

        {/* Star field - layer 2 (medium stars - 12 total) */}
        <div className="absolute inset-0 opacity-45" style={{
          backgroundImage: 'radial-gradient(2px 2px at 40% 40%, white, transparent), radial-gradient(2px 2px at 65% 75%, white, transparent), radial-gradient(2px 2px at 15% 70%, white, transparent), radial-gradient(2px 2px at 80% 20%, white, transparent), radial-gradient(2px 2px at 50% 90%, white, transparent), radial-gradient(2px 2px at 28% 18%, white, transparent), radial-gradient(2px 2px at 72% 52%, white, transparent), radial-gradient(2px 2px at 18% 35%, white, transparent), radial-gradient(2px 2px at 58% 65%, white, transparent), radial-gradient(2px 2px at 85% 88%, white, transparent), radial-gradient(2px 2px at 32% 82%, white, transparent), radial-gradient(2px 2px at 92% 32%, white, transparent)',
          backgroundSize: '300px 300px'
        }} />

        {/* Star field - layer 3 (bright stars - NEW) */}
        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: 'radial-gradient(1.5px 1.5px at 18% 25%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 62% 48%, rgba(255,231,128,0.9), transparent), radial-gradient(1.5px 1.5px at 35% 72%, rgba(125,255,207,0.9), transparent), radial-gradient(1.5px 1.5px at 78% 15%, rgba(148,93,255,0.9), transparent), radial-gradient(1.5px 1.5px at 45% 88%, rgba(255,157,225,0.9), transparent), radial-gradient(1.5px 1.5px at 88% 62%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 25% 42%, rgba(255,231,128,0.9), transparent), radial-gradient(1.5px 1.5px at 70% 78%, rgba(125,255,207,0.9), transparent), radial-gradient(1.5px 1.5px at 12% 58%, rgba(148,93,255,0.9), transparent), radial-gradient(1.5px 1.5px at 55% 22%, rgba(255,157,225,0.9), transparent), radial-gradient(1.5px 1.5px at 92% 38%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 38% 95%, rgba(255,231,128,0.9), transparent)',
          backgroundSize: '280px 280px'
        }} />

        {/* Star field - layer 4 (micro particles - NEW) */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(0.5px 0.5px at 15% 12%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 48% 35%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 82% 58%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 25% 68%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 65% 18%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 35% 85%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 78% 42%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 52% 72%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 92% 22%, rgba(255,255,255,0.8), transparent), radial-gradient(0.5px 0.5px at 8% 48%, rgba(255,255,255,0.8), transparent)',
          backgroundSize: '200px 200px'
        }} />

        {/* Atmospheric haze */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(148,93,255,0.1)] via-transparent to-[rgba(148,93,255,0.15)] opacity-40" />

        {/* Floating particles/debris layer */}
        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: 'radial-gradient(3px 3px at 22% 18%, rgba(255,231,128,0.6), transparent), radial-gradient(2px 2px at 68% 32%, rgba(143,247,255,0.5), transparent), radial-gradient(4px 4px at 85% 55%, rgba(255,231,128,0.4), transparent), radial-gradient(3px 3px at 12% 72%, rgba(143,247,255,0.6), transparent), radial-gradient(2px 2px at 45% 88%, rgba(255,231,128,0.5), transparent), radial-gradient(3px 3px at 75% 12%, rgba(143,247,255,0.4), transparent), radial-gradient(4px 4px at 32% 45%, rgba(255,231,128,0.6), transparent), radial-gradient(2px 2px at 58% 68%, rgba(143,247,255,0.5), transparent), radial-gradient(3px 3px at 92% 75%, rgba(255,231,128,0.4), transparent), radial-gradient(4px 4px at 15% 38%, rgba(143,247,255,0.6), transparent), radial-gradient(2px 2px at 48% 22%, rgba(255,231,128,0.5), transparent), radial-gradient(3px 3px at 78% 92%, rgba(143,247,255,0.4), transparent), radial-gradient(4px 4px at 35% 62%, rgba(255,231,128,0.6), transparent), radial-gradient(2px 2px at 88% 28%, rgba(143,247,255,0.5), transparent), radial-gradient(3px 3px at 52% 82%, rgba(255,231,128,0.4), transparent)',
          backgroundSize: '350px 350px'
        }} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-pressstart pixel-tiny uppercase tracking-[0.32em] text-[#ffe780]">⚔️ Battle Preparation</div>
          <div className="mt-2 text-[11px] text-[#c7b5ff]">Equip your weapon and shield to prepare for combat. Your loadout determines your battle roll range.</div>
        </div>
        <button type="button" className="btn-fantasy-ghost px-3 py-1" onClick={onClose}>Close</button>
      </div>

      {/* Vulnerability Warning */}
      {shieldEmptyOrZero && (
        <div className="mt-3 rounded-2xl border border-[rgba(255,107,154,0.35)] bg-[rgba(80,10,26,0.45)] px-2.5 py-1.5 text-[12px] text-white">
          <span className="font-pressstart pixel-tiny uppercase tracking-[0.18em] text-[#ff9de1]">⚠️ Vulnerable</span>
          <div className="mt-1">Shield DP: 0 — you&apos;re easy to farm. Nourish uses a luck bucket: you&apos;re guaranteed a drop within 5 nourishes (can happen earlier), or win gear in battle.</div>
        </div>
      )}

      {/* 3-Column Ceremony Layout */}
      <div className="mt-5 flex flex-col lg:flex-row items-center justify-center gap-3">
        {/* LEFT: Weapon Slot */}
        <div className="flex flex-col items-center gap-3">
          <div className="font-pressstart text-[11px] uppercase tracking-[0.18em] text-[#ffe780]">Weapon</div>
          {weaponCard?.equipped ? (
            <GearCard card={weaponCard} variant="hero" boosterLevel={boosterLevel} coveredUntil={coveredUntil} />
          ) : (
            <EmptySlot kind="weapon" onClick={onManageGear} hasStash={stashCount > 0} />
          )}
        </div>

        {/* CENTER: Bloblet Avatar */}
        <div className="flex flex-col items-center justify-center gap-4 px-6">
          <div className="flex h-[190px] w-[160px] items-center justify-center rounded-[28px] border-2 border-[rgba(148,93,255,0.45)] bg-[rgba(12,4,26,0.6)] shadow-[0_0_30px_rgba(148,93,255,0.2)]">
            {/* Bloblet avatar with breathing animation */}
            <div className="relative text-center">
              {avatarUrl ? (
                <div className="animate-breathe">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt="Your Bloblet"
                    className="h-[120px] w-[120px] object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  {/* Equipment overlay icons */}
                  {weaponCard?.equipped && (
                    <div className="absolute bottom-2 left-2 text-[32px]">⚔️</div>
                  )}
                  {shieldCard?.equipped && (
                    <div className="absolute bottom-2 right-2 text-[32px]">🛡️</div>
                  )}
                </div>
              ) : (
                <div className="animate-breathe">
                  <div className="text-[72px] opacity-30">👤</div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#8ff7ff]/40">Your Bloblet</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Shield Slot */}
        <div className="flex flex-col items-center gap-3">
          <div className="font-pressstart text-[11px] uppercase tracking-[0.18em] text-[#7dffcf]">Shield</div>
          {shieldCard?.equipped ? (
            <GearCard
              card={shieldCard}
              variant="hero"
              boosterLevel={boosterLevel}
              coveredUntil={coveredUntil}
              isBroken={shieldDP === 0}
            />
          ) : (
            <EmptySlot kind="shield" onClick={onManageGear} hasStash={stashCount > 0} />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="my-2 h-px bg-gradient-to-r from-transparent via-[rgba(148,93,255,0.45)] to-transparent shadow-[0_0_8px_rgba(148,93,255,0.3)]" />

      {/* Equipment Status Section */}
      <div className="rounded-2xl border-2 border-[rgba(148,93,255,0.5)] bg-[rgba(12,4,26,0.9)] px-3 py-2 shadow-[0_0_20px_rgba(148,93,255,0.2)]">
        <div className="space-y-3">
            {/* Weapon Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${weaponCard?.equipped ? 'bg-[rgba(125,255,207,0.2)] text-[#7dffcf] shadow-[0_0_10px_rgba(125,255,207,0.5)]' : 'bg-[rgba(255,107,154,0.2)] text-[#ff6b9a]'}`}>
                  {weaponCard?.equipped ? '✓' : '✕'}
                </div>
                <div>
                  <span className="text-[13px] text-white">Weapon</span>
                  {weaponCard?.equipped && (
                    <span className="ml-2 text-[11px] text-[#c7b5ff]">{weaponCard.title}</span>
                  )}
                </div>
              </div>
              <div className={`text-[13px] font-semibold ${weaponCard?.equipped ? 'text-[#ffe780] shadow-[0_0_8px_rgba(255,231,128,0.4)]' : 'text-[#8ff7ff]/40'}`}>
                {weaponCard?.equipped ? `+${weaponOP} OP` : '—'}
              </div>
            </div>

            {/* Shield Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${shieldCard?.equipped ? 'bg-[rgba(125,255,207,0.2)] text-[#7dffcf] shadow-[0_0_10px_rgba(125,255,207,0.5)]' : 'bg-[rgba(255,107,154,0.2)] text-[#ff6b9a]'}`}>
                  {shieldCard?.equipped ? '✓' : '✕'}
                </div>
                <div>
                  <span className="text-[13px] text-white">Shield</span>
                  {shieldCard?.equipped && (
                    <span className="ml-2 text-[11px] text-[#c7b5ff]">{shieldCard.title}</span>
                  )}
                </div>
              </div>
              <div className={`text-[13px] font-semibold ${shieldCard?.equipped ? 'text-[#7dffcf] shadow-[0_0_8px_rgba(125,255,207,0.4)]' : 'text-[#8ff7ff]/40'}`}>
                {shieldCard?.equipped ? `+${shieldDP} DP` : '—'}
              </div>
            </div>

            {/* Combat Power Summary */}
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold text-[#8ff7ff]">Combined Power</div>
              <div className="text-[17px] font-bold text-white shadow-[0_0_10px_rgba(255,255,255,0.3)]">{totalPower}</div>
            </div>

            {/* Roll Range */}
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-[#8ff7ff]">Battle Roll Range</div>
              <div className="text-[15px] font-semibold text-white">{minRoll}–{maxRoll}</div>
            </div>
          </div>
        </div>

      {/* Action Buttons */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          className={`font-pressstart relative overflow-hidden rounded-full px-5 py-3 text-[11px] transition-all duration-300 ${
            stashCount > 0
              ? 'border-2 border-[rgba(148,93,255,0.7)] bg-[rgba(60,20,100,0.8)] text-white shadow-[0_0_20px_rgba(148,93,255,0.5),0_4px_12px_rgba(0,0,0,0.4)] hover:scale-105 hover:border-[rgba(148,93,255,0.9)] hover:shadow-[0_0_30px_rgba(148,93,255,0.7)]'
              : 'border-2 border-[rgba(148,93,255,0.35)] bg-[rgba(20,8,44,0.6)] text-[#8ff7ff]/70 hover:border-[rgba(148,93,255,0.5)]'
          }`}
          onClick={onManageGear}
        >
          🎒 Manage Stash
          {stashCount > 0 ? (
            <span className="ml-2 rounded-full border border-[rgba(255,231,128,0.6)] bg-[rgba(255,231,128,0.2)] px-2 py-0.5 text-[10px] font-bold text-[#ffe780] shadow-[0_0_8px_rgba(255,231,128,0.4)]">
              {stashCount}
            </span>
          ) : (
            <span className="ml-2 text-[10px] text-[#8ff7ff]/40">(empty)</span>
          )}
        </button>
        <button
          type="button"
          className={`font-pressstart relative overflow-hidden rounded-full border-2 px-8 py-4 text-[12px] transition-all duration-300 ${
            isBattleReady
              ? 'border-[rgba(255,157,225,0.8)] bg-[rgba(100,20,80,0.9)] text-white shadow-[0_0_25px_rgba(255,157,225,0.6),0_4px_16px_rgba(0,0,0,0.5)] hover:scale-105 hover:border-[rgba(255,157,225,1)] hover:shadow-[0_0_40px_rgba(255,157,225,0.8)]'
              : 'cursor-not-allowed border-[rgba(148,93,255,0.3)] bg-[rgba(20,8,44,0.5)] text-[#8ff7ff]/40 opacity-60'
          }`}
          onClick={onLaunchChallenge}
          disabled={!isBattleReady}
        >
          {isBattleReady && (
            <div className="absolute inset-0 animate-pulse-subtle bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.2)] to-transparent" />
          )}
          <span className="relative z-10">{isBattleReady ? '🎯 Ready for Combat' : '⚠️ Equip Gear First'}</span>
        </button>
      </div>
    </div>
  )
}
