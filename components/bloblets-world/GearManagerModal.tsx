"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { usePlayerStatus } from '@/src/client/hooks/usePlayerStatus'

type Tab = 'weapon' | 'shield'

type Props = {
  onClose: () => void
  initialTab?: Tab
}

function statFor(item: any, slot: Tab) {
  if (!item) return 0
  return slot === 'weapon' ? Number(item.op || 0) : Number(item.dp || 0)
}

function getStatColors(stat: number) {
  // T6-T8 (Legendary tier) - Cyan/Blue borders - VIBRANT
  if (stat >= 6) {
    return {
      border: 'rgba(143,247,255,0.95)',
      glow: '0 0 30px rgba(143,247,255,0.6), 0 0 60px rgba(143,247,255,0.4), 0 0 90px rgba(143,247,255,0.25)',
      hoverGlow: '0 0 40px rgba(143,247,255,0.8), 0 0 80px rgba(143,247,255,0.6), 0 0 120px rgba(143,247,255,0.35)',
      badgeBg: 'rgba(143,247,255,0.2)',
      badgeBorder: 'rgba(143,247,255,0.6)',
      badgeText: '#8ff7ff'
    }
  }

  // T4-T5 (Rare tier) - Golden/Yellow borders - VIBRANT
  if (stat >= 4) {
    return {
      border: 'rgba(255,231,128,0.95)',
      glow: '0 0 28px rgba(255,231,128,0.55), 0 0 56px rgba(255,231,128,0.35), 0 0 84px rgba(255,231,128,0.2)',
      hoverGlow: '0 0 38px rgba(255,231,128,0.75), 0 0 76px rgba(255,231,128,0.5), 0 0 114px rgba(255,231,128,0.3)',
      badgeBg: 'rgba(255,231,128,0.2)',
      badgeBorder: 'rgba(255,231,128,0.6)',
      badgeText: '#ffe780'
    }
  }

  // T3 (Uncommon tier) - Purple/Magenta borders - VIBRANT & DISTINCT
  if (stat >= 3) {
    return {
      border: 'rgba(168,85,247,0.95)',
      glow: '0 0 26px rgba(168,85,247,0.55), 0 0 52px rgba(168,85,247,0.35), 0 0 78px rgba(168,85,247,0.2)',
      hoverGlow: '0 0 36px rgba(168,85,247,0.75), 0 0 72px rgba(168,85,247,0.5), 0 0 108px rgba(168,85,247,0.3)',
      badgeBg: 'rgba(168,85,247,0.2)',
      badgeBorder: 'rgba(168,85,247,0.6)',
      badgeText: '#a855f7'
    }
  }

  // T2 (Common tier) - Emerald/Green borders - VIBRANT & COMPLETELY DIFFERENT
  if (stat >= 2) {
    return {
      border: 'rgba(16,185,129,0.95)',
      glow: '0 0 24px rgba(16,185,129,0.55), 0 0 48px rgba(16,185,129,0.35), 0 0 72px rgba(16,185,129,0.2)',
      hoverGlow: '0 0 34px rgba(16,185,129,0.75), 0 0 68px rgba(16,185,129,0.5), 0 0 102px rgba(16,185,129,0.3)',
      badgeBg: 'rgba(16,185,129,0.2)',
      badgeBorder: 'rgba(16,185,129,0.6)',
      badgeText: '#10b981'
    }
  }

  // T1 (Basic tier) - Bronze/Orange borders - VIBRANT
  return {
    border: 'rgba(217,119,6,0.95)',
    glow: '0 0 22px rgba(217,119,6,0.55), 0 0 44px rgba(217,119,6,0.35), 0 0 66px rgba(217,119,6,0.2)',
    hoverGlow: '0 0 32px rgba(217,119,6,0.75), 0 0 64px rgba(217,119,6,0.5), 0 0 96px rgba(217,119,6,0.3)',
    badgeBg: 'rgba(217,119,6,0.2)',
    badgeBorder: 'rgba(217,119,6,0.6)',
    badgeText: '#d97706'
  }
}

export const GearManagerModal: React.FC<Props> = ({ onClose, initialTab = 'weapon' }) => {
  const { data, refresh } = usePlayerStatus({ refreshIntervalMs: 120000 })
  const [tab, setTab] = useState<Tab>(initialTab)
  const [pendingSlot, setPendingSlot] = useState<Tab | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const equipped = data?.gear?.equipped || { weapon: null, shield: null }
  const equippedIds = useMemo(() => ({
    weapon: equipped.weapon?.baseItemId != null ? Number(equipped.weapon.baseItemId) : null,
    shield: equipped.shield?.baseItemId != null ? Number(equipped.shield.baseItemId) : null,
  }), [equipped.weapon?.baseItemId, equipped.shield?.baseItemId])

  const stash = useMemo(() => {
    const list = Array.isArray(data?.gear?.stash) ? data.gear.stash : []
    return list.filter((it: any) => (it?.type === 'weapon' || it?.type === 'shield') && it.type === tab)
  }, [data?.gear?.stash, tab])

  // Set modal-open attribute on body to hide sidebar
  useEffect(() => {
    document.body.setAttribute('data-modal-open', 'true')
    return () => {
      document.body.removeAttribute('data-modal-open')
    }
  }, [])

  const resetMessages = () => { setError(null); setNotice(null) }

  const callEquip = useCallback(async (slot: Tab, baseItemId: number) => {
    if (pendingSlot) return
    setPendingSlot(slot)
    resetMessages()
    try {
      const res = await fetch('/api/gear/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ slot, itemId: baseItemId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || (json as any).error) {
        const code = (json as any).error || `equip_failed_${res.status}`
        setError(code === 'not_in_inventory' ? 'Item not in your inventory.' : code.replace(/_/g, ' '))
        return
      }
      setNotice('Equipped ✓')
      await refresh().catch(() => {})
    } catch (e: any) {
      setError(e?.message || 'Equip failed')
    } finally {
      setPendingSlot(null)
    }
  }, [pendingSlot, refresh])

  const callUnequip = useCallback(async (slot: Tab) => {
    if (pendingSlot) return
    setPendingSlot(slot)
    resetMessages()
    try {
      const res = await fetch('/api/gear/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ slot }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || (json as any).error) {
        const code = (json as any).error || `unequip_failed_${res.status}`
        setError(code.replace(/_/g, ' '))
        return
      }
      setNotice('Unequipped ✓')
      await refresh().catch(() => {})
    } catch (e: any) {
      setError(e?.message || 'Unequip failed')
    } finally {
      setPendingSlot(null)
    }
  }, [pendingSlot, refresh])

  const activeEquipped = tab === 'weapon' ? equipped.weapon : equipped.shield

  return (
    <div className="font-game relative w-[740px] max-w-[calc(100vw-72px)] max-h-[90vh] overflow-y-auto rounded-[36px] border-2 border-[rgba(148,93,255,0.65)] bg-[rgba(16,6,40,0.98)] px-6 py-6 shadow-[0_0_60px_rgba(148,93,255,0.65),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(143,247,255,0.3)] scrollbar-thin scrollbar-track-[rgba(20,8,50,0.5)] scrollbar-thumb-[rgba(148,93,255,0.5)] hover:scrollbar-thumb-[rgba(148,93,255,0.7)]">
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-xl-game uppercase text-[#ffe780]">⚔ ARSENAL</div>
          <div className="mt-1 text-base-game text-[#b5b5b5]">Equip items from your stash or unequip your current loadout.</div>
        </div>
        <button type="button" className="btn-fantasy-ghost px-3 py-1" onClick={onClose}>Close</button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          className={`group relative flex items-center gap-2 rounded-full border-2 px-5 py-3 text-base-game transition-all duration-300 ${
            tab === 'weapon'
              ? 'border-[rgba(255,231,128,0.7)] bg-[rgba(60,40,12,0.9)] text-[#ffe780] shadow-[0_0_20px_rgba(255,231,128,0.3)]'
              : 'border-[rgba(148,93,255,0.3)] bg-[rgba(20,8,50,0.6)] text-[#c7b5ff] hover:border-[rgba(148,93,255,0.5)] hover:bg-[rgba(28,12,64,0.8)]'
          }`}
          onClick={() => setTab('weapon')}
        >
          <span className="text-[24px]">⚔️</span>
          <span>Weapons</span>
        </button>
        <button
          type="button"
          className={`group relative flex items-center gap-2 rounded-full border-2 px-5 py-3 text-base-game transition-all duration-300 ${
            tab === 'shield'
              ? 'border-[rgba(125,255,207,0.7)] bg-[rgba(12,46,36,0.9)] text-[#7dffcf] shadow-[0_0_20px_rgba(125,255,207,0.3)]'
              : 'border-[rgba(148,93,255,0.3)] bg-[rgba(20,8,50,0.6)] text-[#c7b5ff] hover:border-[rgba(148,93,255,0.5)] hover:bg-[rgba(28,12,64,0.8)]'
          }`}
          onClick={() => setTab('shield')}
        >
          <span className="text-[24px]">🛡️</span>
          <span>Shields</span>
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-[20px] border border-red-400/40 bg-red-900/40 px-4 py-3 text-base-game text-red-100">{error}</div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-[20px] border border-emerald-400/30 bg-emerald-900/30 px-4 py-3 text-base-game text-emerald-100">{notice}</div>
      ) : null}

      <div className="mt-6 space-y-5">
        {/* Equipped Section */}
        <div className="rounded-[24px] border border-[rgba(148,93,255,0.4)] bg-[rgba(20,8,50,0.95)] px-5 py-5">
          <div className="text-sm-game uppercase text-[#8ff7ff] opacity-100">Equipped</div>
          {activeEquipped ? (() => {
            const equippedStat = statFor(activeEquipped, tab)
            const statColors = getStatColors(equippedStat)
            return (
              <div
                className="mt-4 flex items-center justify-between gap-4 rounded-[12px] border bg-[rgba(16,6,36,0.9)] px-5 py-4 min-h-[96px]"
                style={{
                  borderColor: statColors.border,
                  boxShadow: statColors.glow
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="h-[64px] w-[64px] flex-shrink-0 overflow-hidden rounded-[12px] border bg-[rgba(12,4,26,0.6)]" style={{ borderColor: statColors.border }}>
                    {activeEquipped.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={activeEquipped.iconUrl} alt="" className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[28px]">{tab === 'weapon' ? '⚔️' : '🛡️'}</div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="text-lg-game text-white mb-2">{activeEquipped.name || (tab === 'weapon' ? 'Weapon' : 'Shield')}</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full border-2 px-3 py-1 text-sm-game font-mono inline-block"
                        style={{
                          backgroundColor: statColors.badgeBg,
                          borderColor: statColors.badgeBorder,
                          color: statColors.badgeText
                        }}
                      >
                        T{equippedStat}
                      </span>
                      <span
                        className={`font-mono text-sm-mono inline-block ${tab === 'weapon' ? 'text-[#ffe780]' : 'text-[#7dffcf]'}`}
                        title={tab === 'weapon' ? 'Offense Points - Increases attack power' : 'Defense Points - Reduces incoming damage'}
                      >
                        +{equippedStat} {tab === 'weapon' ? 'OP' : 'DP'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn-fantasy-ghost px-4 py-2.5 flex-shrink-0 ${pendingSlot ? 'opacity-60' : ''}`}
                  disabled={pendingSlot !== null}
                  onClick={() => callUnequip(tab)}
                >
                  Unequip
                </button>
              </div>
            )
          })() : (
            <div className="mt-4 rounded-[20px] border border-dashed border-[rgba(148,93,255,0.25)] bg-[rgba(12,4,26,0.3)] px-5 py-6 text-center text-base-game text-[#c7b5ff]/70">
              Nothing equipped in this slot. Select an item below to equip.
            </div>
          )}
        </div>

        {/* Stash Section */}
        <div className="rounded-[24px] border border-[rgba(148,93,255,0.4)] bg-[rgba(20,8,50,0.95)] px-5 py-5">
          <div className="text-sm-game uppercase text-[#8ff7ff] opacity-100">Stash — {tab === 'weapon' ? 'Weapons' : 'Shields'}</div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {stash.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-[rgba(148,93,255,0.25)] bg-[rgba(12,4,26,0.3)] px-5 py-8 text-center">
                <div className="text-[48px] opacity-30 grayscale">🎒</div>
                <div className="text-base-game text-[#c7b5ff]/70">No items in stash for this slot.</div>
                <div className="text-sm-game leading-relaxed text-[#8ff7ff]/50">
                  Nourish to get your first gear drop (guaranteed within 5 nourishes)
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-full border-2 border-[rgba(148,93,255,0.3)] bg-transparent px-4 py-2 text-base-game text-[#c7b5ff] transition-all duration-300 hover:border-[rgba(148,93,255,0.5)] hover:bg-[rgba(28,12,64,0.5)]"
                  onClick={onClose}
                >
                  Go to Life Hub
                </button>
              </div>
            ) : stash.map((it: any) => {
              const baseId = Number(it.baseItemId ?? it.base_item_id ?? 0)
              const isEquipped = equippedIds[tab] != null && baseId === equippedIds[tab]
              const currentStat = statFor(it, tab)
              const statColors = getStatColors(currentStat)
              const statClass = currentStat >= 6 ? 'gear-card-legendary' : currentStat >= 4 ? 'gear-card-rare' : 'gear-card-common'
              return (
                <div
                  key={String(it.id || `${it.type}-${baseId}`)}
                  className={`group flex flex-col items-center rounded-[12px] border bg-[rgba(16,6,36,0.9)] px-4 py-5 transition-all duration-300 cursor-pointer hover:bg-[rgba(20,8,42,0.95)] hover:scale-105 hover:-translate-y-0.5 ${statClass}`}
                  style={{
                    borderColor: statColors.border,
                    boxShadow: statColors.glow
                  }}
                  onClick={() => !isEquipped && !pendingSlot && callEquip(tab, baseId)}
                >
                  {/* Icon - Large and centered - Fixed height container */}
                  <div className="h-[80px] w-[80px] flex-shrink-0 overflow-hidden rounded-[12px] border bg-[rgba(12,4,26,0.6)] mb-3" style={{ borderColor: statColors.border }}>
                    {it.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.iconUrl} alt="" className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[32px]">{it.type === 'weapon' ? '⚔️' : '🛡️'}</div>
                    )}
                  </div>

                  {/* Name - Bright white, centered - Fixed height for alignment */}
                  <div className="text-lg-game text-center text-white h-[20px] flex items-center justify-center mb-3">
                    {it.name || (it.type === 'weapon' ? 'Weapon' : 'Shield')}
                  </div>

                  {/* Tier Badge - Shows power level - Larger and more prominent */}
                  <span
                    className="rounded-full border-2 px-4 py-1.5 text-sm-game font-mono mb-3 inline-block"
                    style={{
                      backgroundColor: statColors.badgeBg,
                      borderColor: statColors.badgeBorder,
                      color: statColors.badgeText
                    }}
                  >
                    T{currentStat}
                  </span>

                  {/* Stats - Centered - Fixed height */}
                  <div
                    className={`font-mono text-sm-mono mb-3 h-[18px] flex items-center justify-center ${tab === 'weapon' ? 'text-[#ffe780]' : 'text-[#7dffcf]'}`}
                    title={tab === 'weapon' ? 'Offense Points - Increases attack power' : 'Defense Points - Reduces incoming damage'}
                  >
                    +{currentStat} {tab === 'weapon' ? 'OP' : 'DP'}
                  </div>

                  {/* Button - Fixed at bottom */}
                  <button
                    type="button"
                    className={`w-full btn-fantasy px-3 py-2.5 mt-auto ${isEquipped || pendingSlot ? 'opacity-60' : ''}`}
                    disabled={isEquipped || pendingSlot !== null}
                    onClick={(e) => {
                      e.stopPropagation()
                      callEquip(tab, baseId)
                    }}
                  >
                    {isEquipped ? '✓ Equipped' : 'Equip'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GearManagerModal
