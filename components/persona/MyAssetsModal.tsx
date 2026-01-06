"use client"

import { useCallback, useMemo, useState, useEffect, useRef } from 'react'

import { formatDisplayPoints } from '@/src/shared/points'
import { resolvePublicEconomyConfig } from '@/src/config/economy'
import { assetConfig } from '@/src/config/assets'
import { usePersonaAssets } from '@/src/client/hooks/persona/usePersonaAssets'
import type { PersonaLandmark } from '@/src/client/persona/types'
import { useClientEventPublisher } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import { PersonaAvatarCard } from './PersonaAvatarCard'
import { PersonaRenameCard } from './PersonaRenameCard'
import { PersonaSocialHandleCard } from './PersonaSocialHandleCard'

type MyAssetsModalProps = {
  onClose: () => void
}

const ECONOMY_CONFIG = resolvePublicEconomyConfig()
const EPSILON = 1e-6
const DEFAULT_RENAME_RP = ECONOMY_CONFIG.pricing.renameRp
const DEFAULT_AVATAR_RP = ECONOMY_CONFIG.pricing.customAvatarRp
const DEFAULT_SPRITE_URL = assetConfig.sprites.defaultAlive

type PersonaTabId = 'avatar' | 'identity' | 'rename' | 'landmarks'

const TABS: Array<{ id: PersonaTabId; label: string }> = [
  { id: 'avatar', label: 'Custom Avatar' },
  { id: 'identity', label: 'Identity' },
  { id: 'rename', label: 'Rename' },
  { id: 'landmarks', label: 'Landmarks' },
]

function formatAddress(address: string | null | undefined) {
  if (!address) return 'Not connected'
  const trimmed = address.trim()
  if (trimmed.length <= 10) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

export function MyAssetsModal({ onClose }: MyAssetsModalProps) {
  const {
    session,
    sessionLoading,
    bloblet,
    landmarks,
    pricing,
    rewardBalance,
    loading,
    refreshing,
    error,
    refresh,
  } = usePersonaAssets()

  const eventPublisher = useClientEventPublisher()

  const [activeTab, setActiveTab] = useState<PersonaTabId>('avatar')

  const avatarSrc = useMemo(() => {
    if (bloblet?.avatarUrl256) return bloblet.avatarUrl256
    if (bloblet?.avatarUrl) return bloblet.avatarUrl
    return DEFAULT_SPRITE_URL
  }, [bloblet])

  const rewardBalanceLabel = useMemo(
    () => (rewardBalance != null ? `${formatDisplayPoints(rewardBalance)} BC` : '—'),
    [rewardBalance],
  )

  const sortedLandmarks = useMemo(
    () =>
      [...landmarks].sort((a, b) => {
        if (Number.isFinite(a.id) && Number.isFinite(b.id)) return a.id - b.id
        return String(a.name ?? '').localeCompare(String(b.name ?? ''))
      }),
    [landmarks],
  )

  const handleRefresh = useCallback(() => {
    void refresh({ showSpinner: true })
  }, [refresh])

  const handleBackgroundRefresh = useCallback(() => {
    return refresh({ showSpinner: false })
  }, [refresh])

  const handleFocusBloblet = useCallback(() => {
    if (!session.address) return
    eventPublisher.emit(CLIENT_EVENT.PERSONA_FOCUS_BLOBLET, {
      address: bloblet?.addressCased ?? session.address,
      addressCanonical: session.address,
      name: bloblet?.name ?? null,
    })
  }, [bloblet?.addressCased, bloblet?.name, eventPublisher, session.address])

  const handleFocusLandmark = useCallback(
    (landmark: PersonaLandmark) => {
      eventPublisher.emit(CLIENT_EVENT.PERSONA_FOCUS_LANDMARK, {
        propId: landmark.id,
        propType: landmark.type,
        name: landmark.name,
        renameCount: landmark.renameCount,
        lastPrice: landmark.lastPrice,
        ownerAddress: session.address,
        ownerAddressCased: session.address,
      })
    },
    [eventPublisher, session.address],
  )

  const handleTopUp = useCallback(() => {
    eventPublisher.emit(CLIENT_EVENT.PERSONA_OPEN_TOPUP, {})
  }, [eventPublisher])

  const walletConnected = Boolean(session.address)
  const minActionCost = useMemo(() => {
    const candidates = [DEFAULT_RENAME_RP, DEFAULT_AVATAR_RP, pricing.base]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
    if (!candidates.length) return null
    return Math.min(...candidates)
  }, [pricing.base])

  const rewardStatus = useMemo(() => {
    if (!walletConnected) {
      return {
        label: 'Connect wallet',
        detail: 'Verify your holder wallet to manage assets.',
        tone: 'muted',
      }
    }
    if (rewardBalance == null) {
      return {
        label: 'Fetching BlobCoin…',
        detail: 'Refresh if the balance does not load.',
        tone: 'muted',
      }
    }
    if (minActionCost != null && rewardBalance + EPSILON < minActionCost) {
      return {
        label: 'Need BlobCoin',
        detail: 'Buy BlobCoin before rename, avatar, or landmark spends.',
        tone: 'warn',
      }
    }
    return {
      label: 'BlobCoin ready',
      detail: 'Persona actions will debit instantly.',
      tone: 'ok',
    }
  }, [minActionCost, rewardBalance, walletConnected])

  const rewardStatusClasses =
    rewardStatus.tone === 'warn'
      ? 'border-[rgba(255,118,118,0.5)] bg-[rgba(54,8,32,0.45)] text-[#ffb4c2]'
      : rewardStatus.tone === 'ok'
      ? 'border-[rgba(125,255,207,0.45)] bg-[rgba(12,40,32,0.45)] text-[#7dffcf]'
      : 'border-[rgba(148,93,255,0.35)] bg-[rgba(24,8,54,0.45)] text-[#c7b5ff]'

  // Track previous address to detect wallet changes
  const prevAddressRef = useRef(session.address)
  useEffect(() => {
    const prevAddress = prevAddressRef.current
    const currentAddress = session.address

    // Reset state when address changes (including switching between different addresses)
    if (prevAddress !== currentAddress) {
      setActiveTab('avatar')
      if (currentAddress) {
        // Refresh data for the new address
        void refresh({ showSpinner: true })
      }
      prevAddressRef.current = currentAddress
    }
  }, [session.address, refresh])

  return (
    <div className="w-[920px] max-w-[calc(100vw-56px)] rounded-[36px] border border-[rgba(148,93,255,0.45)] bg-[rgba(16,6,40,0.96)] px-6 py-5 shadow-[0_36px_96px_rgba(12,2,28,0.6)]">
      {/* Compact header - title, avatar, info, and actions all in one row */}
      <header className="flex items-center gap-4 pb-4 border-b border-[rgba(148,93,255,0.25)]">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-[rgba(148,93,255,0.35)] bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt="Bloblet avatar"
            className="h-full w-full object-contain"
            style={{ imageRendering: 'pixelated' as const }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-pressstart text-[11px] text-fantasy-primary uppercase tracking-[0.18em] truncate">
            {bloblet?.name ?? 'Unnamed Bloblet'}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-[#c7b5ff]/85">
            <span className="truncate">{formatAddress(session.address)}</span>
            <span className="flex-shrink-0">•</span>
            <span className="flex-shrink-0 font-medium">{rewardBalanceLabel}</span>
          </div>
        </div>
        <span
          className={`flex-shrink-0 inline-flex items-center rounded-full border px-3 py-1 font-pressstart text-[8px] uppercase tracking-[0.14em] ${rewardStatusClasses}`}
        >
          {rewardStatus.label}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="btn-fantasy px-3 py-1 text-[11px]"
            onClick={handleTopUp}
            disabled={!walletConnected}
          >
            Buy BlobCoin
          </button>
          <button
            type="button"
            className="btn-fantasy-ghost px-2 py-1 text-[11px]"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </header>

      <section className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                className={`rounded-full border border-[rgba(148,93,255,0.35)] px-4 py-2 font-pressstart text-[10px] uppercase tracking-[0.16em] transition ${
                  active
                    ? 'bg-[rgba(148,93,255,0.3)] text-fantasy-primary shadow-[0_0_20px_rgba(148,93,255,0.2)]'
                    : 'bg-[rgba(24,8,54,0.7)] text-[#c7b5ff]/70 hover:bg-[rgba(34,12,82,0.75)]'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {error && (
          <div className="rounded-[18px] border border-red-400/40 bg-red-900/40 px-4 py-3 text-[12px] text-red-100">
            {error}
          </div>
        )}

        <div className="max-h-[64vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-4 rounded-[24px] border border-[rgba(148,93,255,0.35)] bg-[rgba(24,8,54,0.6)] px-5 py-6">
              <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,1fr)]">
                <div className="h-64 animate-pulse rounded-xl bg-white/10" />
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
                  <div className="h-10 w-full animate-pulse rounded bg-white/5" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'avatar' && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn-fantasy-ghost px-3 py-1 text-[11px]"
                      onClick={onClose}
                    >
                      ← Back
                    </button>
                  </div>
                  <PersonaAvatarCard
                    session={session}
                    rewardBalance={rewardBalance}
                    avatarCost={DEFAULT_AVATAR_RP}
                    currentAvatarUrl={bloblet?.avatarUrl256 || bloblet?.avatarUrl || DEFAULT_SPRITE_URL}
                    onRefresh={handleBackgroundRefresh}
                    onTopUp={handleTopUp}
                  />
                </div>
              )}

              {activeTab === 'identity' && (
                <div className="mt-4">
                  <PersonaSocialHandleCard
                    bloblet={bloblet}
                    session={session}
                    onRefresh={handleBackgroundRefresh}
                  />
                </div>
              )}

              {activeTab === 'rename' && (
                <div className="mt-4">
                  <PersonaRenameCard
                    bloblet={bloblet}
                    session={session}
                    renameCost={DEFAULT_RENAME_RP}
                    rewardBalance={rewardBalance}
                    onRefresh={handleBackgroundRefresh}
                    onTopUp={handleTopUp}
                  />
                </div>
              )}

              {activeTab === 'landmarks' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="font-pressstart text-[10px] text-fantasy-primary uppercase tracking-[0.12em]">
                      Owned Landmarks ({sortedLandmarks.length})
                    </div>
                    <div className="text-[10px] text-fantasy-muted">
                      Base {formatDisplayPoints(pricing.base)} BC · Step {formatDisplayPoints(pricing.step)} BC
                    </div>
                  </div>
                  {sortedLandmarks.length === 0 ? (
                    <div className="rounded-[18px] border border-[rgba(148,93,255,0.35)] bg-[rgba(24,8,54,0.82)] px-5 py-8 text-center">
                      <p className="text-[11px] text-fantasy-muted">No landmarks owned yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sortedLandmarks.map((landmark) => (
                        <div
                          key={`${landmark.id}-${landmark.name ?? 'unnamed'}`}
                          className="rounded-[18px] border border-[rgba(148,93,255,0.25)] bg-[rgba(24,8,54,0.82)] px-4 py-3 hover:border-[rgba(148,93,255,0.45)] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-pressstart text-[10px] text-fantasy-primary flex-shrink-0">
                              #{landmark.id}
                            </span>
                            <button
                              type="button"
                              className="text-[10px] text-[#c7b5ff]/70 hover:text-[#c7b5ff] transition-colors flex-shrink-0"
                              onClick={() => handleFocusLandmark(landmark)}
                              title="Highlight on canvas"
                            >
                              ⌖
                            </button>
                          </div>
                          <div className="text-[11px] text-[#d3c6ff] mb-2 truncate" title={landmark.name || 'Unnamed Landmark'}>
                            {landmark.name && landmark.name.trim().length
                              ? landmark.name
                              : 'Unnamed Landmark'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-fantasy-muted">
                            <span>
                              {landmark.renameCount} rename{landmark.renameCount === 1 ? '' : 's'}
                            </span>
                            {landmark.lastPrice > 0 && (
                              <>
                                <span>•</span>
                                <span>Last {formatDisplayPoints(landmark.lastPrice)} BC</span>
                              </>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-[rgba(148,93,255,0.15)] text-[10px] text-fantasy-primary">
                            Next: {formatDisplayPoints(landmark.currentPrice)} BC
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {pricing.premiumPct > 0 && (
                    <p className="text-[10px] text-fantasy-muted/80 px-1">
                      Premium landmarks use the higher of step pricing or a {Math.round(pricing.premiumPct * 100)}% bump
                      over the last sale.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
