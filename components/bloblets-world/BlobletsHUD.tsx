"use client"

import React, { useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'

import CanvasNavHint from "@/components/CanvasNavHint"
import HudTooltip from '@/components/HudTooltip'
import { DesktopHudShell } from '../hud/DesktopHudShell'
import { StatsDockPanel } from '../hud/StatsDockPanel'
import { LedgerDock } from '../hud/LedgerDock'
import { RewardSummaryCard } from '../hud/RewardSummaryCard'
import type { DockPanelConfig } from '../hud/DockRail'
import type { DockPanelId, HubTab } from './types'
import RewardsModalsGateway from './RewardsModalsGateway'
import { MyAssetsModal } from '@/components/persona/MyAssetsModal'
import GearManagerModal from './GearManagerModal'
import { BlobletRenameOverlay } from './BlobletRenameOverlay'
import { LandmarkRenameOverlay } from './LandmarkRenameOverlay'
import type { RewardsModalConfig } from '@/components/rewards-modal/types'
import { LifeHubDesktopModal } from '../life-hub/LifeHubDesktopModal'
import { useWorldHud } from './WorldContext'
import { LootedAlertOverlay } from '@/components/LootedAlertOverlay'
import { TacticalScanner } from '../hud/TacticalScanner'
import { OpponentSearchPanel } from '../hud/OpponentSearchPanel'
import { SoundToggle } from '@/components/SoundToggle'

const ConnectWallet = dynamic(() => import('@/components/WalletButton'), { ssr: false })

type BlobletsHUDProps = {
  logoSrc?: string
  rewardsConfig?: RewardsModalConfig
}

export function BlobletsHUD({ logoSrc, rewardsConfig }: BlobletsHUDProps) {
  const {
    blobletOverlay,
    blobletOverlayAnchor,
    closeBlobletOverlay,
    personaOverlay,
    personaOverlayAnchor,
    closePersonaOverlay,
    rewardBalance,
    personaEconomy,
    openTopUpModal,
    openHubTab,
    closeHub,
    refreshRewards,
    showNavHint,
    navPointerType,
    dismissNavHint,
    dockTabs,
    activeHubTab,
    handleHubTabToggle,
    hubTabMeta,
    activeDockPanel,
    toggleDockPanel,
    highlightedTargets,
    opponentSearchQuery,
    opponentSearchResults,
    opponentSearchIndex,
    opponentsHudVisible,
    handleOpponentSearchChange,
    handleOpponentSearchNavigate,
    handleOpponentSearchSubmit,
    handleOpponentSearchSelect,
    handleOpponentSearchHover,
    handleOpponentSearchClearActive,
    selectedOpponent,
    selectedOpponentMeta,
    selectedOpponentCooldown,
    previewOpponent,
    focusOnAddress,
    openChallengeModal,
    minStake,
    toasts,
    lifeHubModalVisible,
    personaModalVisible,
    gearManagerOpen,
    closeGearManager,
    topUpModalOpen,
    closeTopUpModal,
    lifeHubLoadout,
    handleManageGear,
    rewardSummary,
    ledgerDockProps,
    arenaPanel,
    myAddressCanonical,
    myLandmarkCount,
    handleOpenMyAssetsPanel,
    rewardBalanceDisplay,
    rewardBadgeTooltip,
    rewardButtonsDisabled,
    lootedAlert,
    onDismissLootedAlert,
  } = useWorldHud()

  const hasMyAddress = Boolean(myAddressCanonical)

  const handleFocusSelf = useCallback(() => {
    const key = myAddressCanonical?.trim()
    if (!key) return
    focusOnAddress(key, { zoom: 1.35, duration: 600 })
    try {
      ;(window as any).BlobletsWorld_setHighlight?.(key)
    } catch {
      // ignore highlight failures
    }
  }, [focusOnAddress, myAddressCanonical])

  const statsPanelContent = useMemo(
    () => <StatsDockPanel rewardSummary={rewardSummary} />,
    [rewardSummary],
  )

  const ledgerPanelContent = useMemo(
    () => <LedgerDock {...ledgerDockProps} />,
    [ledgerDockProps],
  )

  const myAssetsPanelContent = useMemo(() => {
    if (!myAddressCanonical) {
      return (
        <div className="relative w-[320px] max-w-[calc(100vw-160px)] overflow-hidden rounded-[36px] border-2 border-[rgba(148,93,255,0.65)] bg-[rgba(16,6,40,0.85)] px-5 py-4 shadow-[0_0_60px_rgba(148,93,255,0.65),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(143,247,255,0.3)] text-[12px] text-[#c7b5ff]/85">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
            <div className="absolute inset-0 bg-gradient-radial from-[rgba(148,93,255,0.2)] via-[rgba(143,247,255,0.12)] to-transparent opacity-75" />
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(1px 1px at 18% 22%, white, transparent), radial-gradient(1px 1px at 72% 28%, white, transparent), radial-gradient(1px 1px at 42% 58%, white, transparent), radial-gradient(1px 1px at 82% 72%, white, transparent), radial-gradient(1px 1px at 14% 48%, white, transparent)',
                backgroundSize: '250px 250px',
              }}
            />
            <div
              className="absolute inset-0 opacity-45"
              style={{
                backgroundImage:
                  'radial-gradient(1.5px 1.5px at 22% 28%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 68% 52%, rgba(125,255,207,0.9), transparent), radial-gradient(1.5px 1.5px at 32% 72%, rgba(148,93,255,0.9), transparent)',
                backgroundSize: '280px 280px',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(148,93,255,0.08)] via-transparent to-[rgba(143,247,255,0.1)] opacity-40" />
          </div>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-4 w-4 border-l-[3px] border-t-[3px] border-[rgba(148,93,255,0.85)]" />
            <div className="absolute right-0 top-0 h-4 w-4 border-r-[3px] border-t-[3px] border-[rgba(148,93,255,0.85)]" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b-[3px] border-l-[3px] border-[rgba(148,93,255,0.85)]" />
            <div className="absolute bottom-0 right-0 h-4 w-4 border-b-[3px] border-r-[3px] border-[rgba(148,93,255,0.85)]" />
          </div>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="h-px animate-scan-line bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.3)] to-transparent" />
          </div>
          <div className="relative flex items-center gap-2">
            <span className="text-[14px]" aria-hidden>💠</span>
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.32em] text-[#ffe780]">
              Highlight My Assets
            </div>
          </div>
          <div className="relative mt-4 rounded-[20px] border-2 border-dashed border-[rgba(148,93,255,0.35)] bg-[rgba(12,4,26,0.6)] px-4 py-6 text-center">
            <div className="text-[48px] opacity-30 grayscale">🔒</div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#c7b5ff]">
              Connect your wallet to highlight landmarks you own.
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className="relative w-[320px] max-w-[calc(100vw-160px)] overflow-hidden rounded-[36px] border-2 border-[rgba(143,247,255,0.65)] bg-[rgba(16,6,40,0.85)] px-5 py-4 shadow-[0_0_60px_rgba(143,247,255,0.55),0_36px_96px_rgba(12,2,28,0.8),0_0_40px_rgba(125,255,207,0.3)] text-[12px] text-[#c7b5ff]/85">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
          <div className="absolute inset-0 bg-gradient-radial from-[rgba(143,247,255,0.18)] via-[rgba(125,255,207,0.1)] to-transparent opacity-75" />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'radial-gradient(1px 1px at 18% 22%, white, transparent), radial-gradient(1px 1px at 72% 28%, white, transparent), radial-gradient(1px 1px at 42% 58%, white, transparent), radial-gradient(1px 1px at 82% 72%, white, transparent), radial-gradient(1px 1px at 14% 48%, white, transparent)',
              backgroundSize: '250px 250px',
            }}
          />
          <div
            className="absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                'radial-gradient(1.5px 1.5px at 22% 28%, rgba(143,247,255,0.9), transparent), radial-gradient(1.5px 1.5px at 68% 52%, rgba(125,255,207,0.9), transparent), radial-gradient(1.5px 1.5px at 32% 72%, rgba(148,93,255,0.9), transparent)',
              backgroundSize: '280px 280px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(143,247,255,0.08)] via-transparent to-[rgba(125,255,207,0.12)] opacity-40" />
        </div>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-4 w-4 border-l-[3px] border-t-[3px] border-[rgba(125,255,207,0.85)]" />
          <div className="absolute right-0 top-0 h-4 w-4 border-r-[3px] border-t-[3px] border-[rgba(125,255,207,0.85)]" />
          <div className="absolute bottom-0 left-0 h-4 w-4 border-b-[3px] border-l-[3px] border-[rgba(125,255,207,0.85)]" />
          <div className="absolute bottom-0 right-0 h-4 w-4 border-b-[3px] border-r-[3px] border-[rgba(125,255,207,0.85)]" />
        </div>
        <div className="relative flex items-center gap-2">
          <span className="text-[14px]" aria-hidden>💠</span>
          <div className="font-pressstart pixel-tiny uppercase tracking-[0.32em] text-[#8ff7ff]">
            Highlight My Assets
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[#c7f7ff]/85">
          Your landmarks glow on the canvas while this toggle is active. Select any highlighted
          landmark to open the rename overlay.
        </p>
        <div className="relative my-3 h-px bg-gradient-to-r from-transparent via-[rgba(143,247,255,0.45)] to-transparent shadow-[0_0_8px_rgba(143,247,255,0.3)]" />
        <div className="animate-breathe relative overflow-hidden rounded-[20px] border-2 border-[rgba(143,247,255,0.5)] bg-[rgba(12,4,26,0.9)] px-4 py-3 shadow-[0_0_20px_rgba(143,247,255,0.2)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-3 w-3 border-l-[2px] border-t-[2px] border-[rgba(143,247,255,0.7)]" />
            <div className="absolute right-0 bottom-0 h-3 w-3 border-r-[2px] border-b-[2px] border-[rgba(143,247,255,0.7)]" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#8ff7ff]">Owned Landmarks</div>
              <div className="mt-1 font-mono text-[20px] font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {myLandmarkCount}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(125,255,207,0.2)] text-[#7dffcf] shadow-[0_0_12px_rgba(125,255,207,0.5)]">
              ✓
            </div>
          </div>
        </div>
        <button
          type="button"
          className="group relative mt-4 w-full overflow-hidden rounded-full border-2 border-[rgba(255,157,225,0.8)] bg-[rgba(100,20,80,0.9)] px-5 py-3 font-pressstart text-[10px] uppercase tracking-[0.16em] text-white shadow-[0_0_25px_rgba(255,157,225,0.6)] transition-all duration-300 hover:scale-105 hover:border-[rgba(255,157,225,1)] hover:shadow-[0_0_40px_rgba(255,157,225,0.8)]"
          onClick={handleOpenMyAssetsPanel}
        >
          <div className="absolute inset-0 animate-pulse-subtle bg-gradient-to-r from-transparent via-[rgba(255,157,225,0.2)] to-transparent" />
          <span className="relative z-10">🎯 Open My Assets →</span>
        </button>
      </div>
    )
  }, [handleOpenMyAssetsPanel, myAddressCanonical, myLandmarkCount])

  const dockPanels = useMemo<DockPanelConfig<DockPanelId>[]>(() => {
    const panels: DockPanelConfig<DockPanelId>[] = [
      { id: 'stats', icon: '📊', label: 'Stats', placement: 'left', content: statsPanelContent },
      { id: 'ledger', icon: '💰', label: 'Ledger', placement: 'left', content: ledgerPanelContent },
    ]
    if (myAddressCanonical) {
      panels.push({
        id: 'assets',
        icon: '💠',
        label: 'Highlight My Assets',
        placement: 'right',
        content: myAssetsPanelContent,
      })
    }
    return panels
  }, [ledgerPanelContent, myAddressCanonical, myAssetsPanelContent, statsPanelContent])

  const lifeHubModal = useMemo(() => {
    if (!lifeHubModalVisible) return null
    return (
      <LifeHubDesktopModal
        activeTab={activeHubTab as HubTab}
        onClose={closeHub}
        loadout={{
          primaryCards: lifeHubLoadout.primaryCards,
          futureCards: lifeHubLoadout.futureCards,
          onManageGear: handleManageGear,
          onLaunchChallenge: () => openChallengeModal(),
        }}
        rewardsCard={<RewardSummaryCard {...rewardSummary} />}
        rewardsHistory={ledgerPanelContent}
        showRewardsHub
      />
    )
  }, [
    activeHubTab,
    closeHub,
    handleManageGear,
    lifeHubLoadout.futureCards,
    lifeHubLoadout.primaryCards,
    lifeHubModalVisible,
    ledgerPanelContent,
    openChallengeModal,
    rewardSummary,
  ])

  const locateButton = useMemo(() => (
    <HudTooltip content={hasMyAddress ? 'Locate My Bloblet' : 'Connect to Locate'} side="left">
      <button
        type="button"
        onClick={handleFocusSelf}
        disabled={!hasMyAddress}
        className="pointer-events-auto grid h-12 w-12 place-items-center rounded-system-sm border border-[rgba(148,93,255,0.35)] bg-[rgba(22,10,48,0.85)] text-[18px] text-[#c7b5ff] shadow-[0_14px_32px_rgba(12,2,28,0.45)] transition hover:border-[rgba(255,134,230,0.45)] hover:text-white hover:shadow-[0_18px_40px_rgba(12,2,28,0.65)] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Locate my bloblet"
        data-hud-interactive="true"
      >
        <span aria-hidden>⌖</span>
      </button>
    </HudTooltip>
  ), [handleFocusSelf, hasMyAddress])

  const soundToggleButton = useMemo(() => <SoundToggle />, [])

  const scannerPanel = useMemo(() => {
    if (!selectedOpponent || !selectedOpponentMeta) return null
    // Don't show tactical scanner for self (Rename Overlay handles that)
    if (myAddressCanonical && selectedOpponent === myAddressCanonical) return null
    return (
      <TacticalScanner
        address={selectedOpponent}
        meta={selectedOpponentMeta}
        cooldownUntil={selectedOpponentCooldown}
        onLaunch={openChallengeModal}
        onClose={handleOpponentSearchClearActive}
        onFocus={(addr) => focusOnAddress(addr, { zoom: 1.35, duration: 600 })}
      />
    )
  }, [selectedOpponent, selectedOpponentMeta, selectedOpponentCooldown, openChallengeModal, handleOpponentSearchClearActive, focusOnAddress, myAddressCanonical])

  const searchPanel = useMemo(() => {
    if (activeHubTab !== 'opponents') return null
    return (
      <OpponentSearchPanel
        targets={highlightedTargets}
        search={{
          query: opponentSearchQuery,
          results: opponentSearchResults,
          activeIndex: opponentSearchIndex,
          onChange: handleOpponentSearchChange,
          onNavigate: handleOpponentSearchNavigate,
          onSubmit: handleOpponentSearchSubmit,
          onSelect: handleOpponentSearchSelect,
          onHover: handleOpponentSearchHover,
          onClearActive: handleOpponentSearchClearActive,
        }}
        selectedAddress={selectedOpponent}
        onSelect={handleOpponentSearchSelect}
        onHover={previewOpponent}
        minStake={minStake}
      />
    )
  }, [activeHubTab, highlightedTargets, opponentSearchQuery, opponentSearchResults, opponentSearchIndex, handleOpponentSearchChange, handleOpponentSearchNavigate, handleOpponentSearchSubmit, handleOpponentSearchSelect, handleOpponentSearchHover, handleOpponentSearchClearActive, selectedOpponent, previewOpponent, minStake])

  return (
    <>
      {blobletOverlay && blobletOverlayAnchor && (
        <BlobletRenameOverlay
          detail={blobletOverlay}
          anchor={blobletOverlayAnchor}
          rewardBalance={rewardBalance}
          renameCost={personaEconomy.pricing.renameRp}
          addressCanonical={myAddressCanonical || null}
          onTopUp={openTopUpModal}
          onCustomize={() => openHubTab('persona')}
          onClose={closeBlobletOverlay}
        />
      )}
      {personaOverlay && personaOverlayAnchor && (
        <LandmarkRenameOverlay
          detail={personaOverlay}
          anchor={personaOverlayAnchor}
          myAddressCanonical={myAddressCanonical || null}
          rewardBalance={rewardBalance}
          onTopUp={openTopUpModal}
          onClose={closePersonaOverlay}
        />
      )}

      <CanvasNavHint open={showNavHint} pointerType={navPointerType} onDismiss={dismissNavHint} />

      <DesktopHudShell
        logoSrc={logoSrc}
        rewardBadge={{
          tooltip: rewardBadgeTooltip,
          balanceLabel: rewardBalanceDisplay,
          onBuyPoints: openTopUpModal,
          buyDisabled: rewardButtonsDisabled,
          walletButton: <ConnectWallet disableToasts />,
        }}
        feedPanel={arenaPanel}
        scannerPanel={scannerPanel}
        searchPanel={searchPanel}
        locateButton={locateButton}
        soundToggle={soundToggleButton}
        dockTabs={dockTabs}
        activeHubTab={activeHubTab}
        onToggleHubTab={handleHubTabToggle}
        hubMeta={hubTabMeta}
        dockPanels={dockPanels}
        activeDockPanel={activeDockPanel}
        onToggleDockPanel={toggleDockPanel}
        toasts={toasts}
        lifeHubModalVisible={lifeHubModalVisible}
        lifeHubModal={lifeHubModal}
        onCloseLifeHubModal={closeHub}
      />

      {personaModalVisible ? (
        <div
          className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[rgba(9,2,18,0.6)] backdrop-blur-md"
          onClick={closeHub}
        >
          <div className="pointer-events-auto" onClick={(event) => event.stopPropagation()}>
            <MyAssetsModal onClose={closeHub} />
          </div>
        </div>
      ) : null}

      {gearManagerOpen ? (
        <div
          className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[rgba(9,2,18,0.85)]"
          onClick={closeGearManager}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ perspective: '900px', perspectiveOrigin: '50% 45%' }}
          >
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  'linear-gradient(to bottom, rgba(0,255,255,0.5) 1px, transparent 1px), linear-gradient(to right, rgba(0,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '45px 45px',
                transform: 'rotateX(72deg) translateZ(-180px) scale(3.2)',
                transformOrigin: 'center 45%',
                transformStyle: 'preserve-3d',
              }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-0 top-0 h-full w-[35%]" style={{ background: 'radial-gradient(ellipse 60% 100% at -10% 50%, rgba(255,107,0,0.3) 0%, rgba(255,69,0,0.15) 30%, transparent 60%)' }} />
            <div className="absolute right-0 top-0 h-full w-[35%]" style={{ background: 'radial-gradient(ellipse 60% 100% at 110% 50%, rgba(255,107,0,0.3) 0%, rgba(255,69,0,0.15) 30%, transparent 60%)' }} />
          </div>
          <div className="pointer-events-none absolute inset-0">
            {[
              { left: '5%', top: '20%', size: '4px', color: '#ff6b00' },
              { left: '8%', top: '45%', size: '3px', color: '#ffa500' },
              { left: '12%', top: '70%', size: '5px', color: '#ff4500' },
              { left: '15%', top: '85%', size: '3px', color: '#ff8c00' },
              { left: '88%', top: '25%', size: '4px', color: '#ff6b00' },
              { left: '92%', top: '50%', size: '3px', color: '#ffa500' },
              { left: '85%', top: '65%', size: '5px', color: '#ff4500' },
              { left: '90%', top: '80%', size: '3px', color: '#ff8c00' },
            ].map((particle, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-pulse"
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  boxShadow: `0 0 ${parseInt(particle.size, 10) * 4}px ${particle.color}`,
                  opacity: 0.7,
                  animationDuration: `${2 + (i % 3)}s`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div
              className="absolute left-0 top-[25%] h-[1px] w-[40%]"
              style={{ background: 'linear-gradient(90deg, rgba(0,255,255,0.8) 0%, transparent 100%)', boxShadow: '0 0 8px rgba(0,255,255,0.6)' }}
            />
            <div
              className="absolute left-0 top-[50%] h-[1px] w-[35%]"
              style={{ background: 'linear-gradient(90deg, rgba(0,255,255,0.6) 0%, transparent 100%)', boxShadow: '0 0 6px rgba(0,255,255,0.4)' }}
            />
            <div
              className="absolute left-0 top-[75%] h-[1px] w-[30%]"
              style={{ background: 'linear-gradient(90deg, rgba(0,255,255,0.8) 0%, transparent 100%)', boxShadow: '0 0 8px rgba(0,255,255,0.6)' }}
            />
          </div>
          <div className="pointer-events-auto" onClick={(event) => event.stopPropagation()}>
            <GearManagerModal onClose={closeGearManager} />
          </div>
        </div>
      ) : null}

      <RewardsModalsGateway
        topUpModalOpen={topUpModalOpen}
        rewardsConfig={rewardsConfig}
        onCloseTopUp={closeTopUpModal}
        onRefreshRewards={refreshRewards}
      />

      {lootedAlert && (
        <LootedAlertOverlay detail={lootedAlert} onDismiss={onDismissLootedAlert} />
      )}
    </>
  )
}
