"use client"

import NextImage from 'next/image'
import type { ReactNode } from 'react'

import { RewardBadge } from './RewardBadge'
import { LifeHubDock } from '../life-hub/LifeHubDock'
import { useFaucetReminderBanner } from '../life-hub/useFaucetReminderBanner'
import type { HubTab } from '../bloblets-world/types'
import type { HubTabMeta } from '../bloblets-world/loadoutSelectors'
import { DockRail, type DockPanelConfig } from './DockRail'
import type { OpponentSearchResult } from './OpponentSearchPanel'
import type { HighlightedTarget } from '../bloblets-world/opponentSelectors'
import type { EnergizeToast } from '../bloblets-world/EnergizeToasts'
import { EnergizeToasts } from '../bloblets-world/EnergizeToasts'
import { RightHudRail } from './RightHudRail'
import { LeftHudFooter } from './LeftHudFooter'

type RewardBadgeConfig = {
  tooltip: string
  balanceLabel: string
  onBuyPoints: () => void
  buyDisabled?: boolean
  walletButton: ReactNode
}

type DesktopHudShellProps<PanelId extends string> = {
  logoSrc?: string | null
  logoAlt?: string
  rewardBadge: RewardBadgeConfig
  dockTabs: HubTab[]
  activeHubTab: HubTab | null
  onToggleHubTab: (tab: HubTab) => void
  hubMeta: HubTabMeta
  dockPanels: DockPanelConfig<PanelId>[]
  activeDockPanel: PanelId | null
  onToggleDockPanel: (panel: PanelId) => void
  toasts: EnergizeToast[]
  feedPanel?: ReactNode
  scannerPanel?: ReactNode
  searchPanel?: ReactNode
  locateButton?: ReactNode
  soundToggle?: ReactNode
  lifeHubModalVisible: boolean
  lifeHubModal: ReactNode
  onCloseLifeHubModal: () => void
}

export function DesktopHudShell<PanelId extends string>({
  logoSrc,
  logoAlt = 'Bloblets logo',
  rewardBadge,
  dockTabs,
  activeHubTab,
  onToggleHubTab,
  hubMeta,
  dockPanels,
  activeDockPanel,
  onToggleDockPanel,
  toasts,
  feedPanel,
  scannerPanel,
  searchPanel,
  locateButton,
  soundToggle,
  lifeHubModalVisible,
  lifeHubModal,
  onCloseLifeHubModal,
}: DesktopHudShellProps<PanelId>) {
  const faucetBanner = useFaucetReminderBanner()
  return (
    <>
      {logoSrc ? (
        <div className="pointer-events-none absolute left-1/2 top-6 z-40 -translate-x-1/2">
          <NextImage
            src={logoSrc}
            alt={logoAlt}
            width={220}
            height={132}
            priority
            unoptimized
            className="h-[84px] w-auto select-none drop-shadow-[0_18px_38px_rgba(12,2,28,0.65)]"
            data-testid="hero-logo"
          />
        </div>
      ) : null}

      <RewardBadge
        tooltip={rewardBadge.tooltip}
        balanceLabel={rewardBadge.balanceLabel}
        onBuyPoints={rewardBadge.onBuyPoints}
        buyDisabled={rewardBadge.buyDisabled}
        walletButton={rewardBadge.walletButton}
      />

      {!!faucetBanner && (
        <div className="pointer-events-auto absolute left-1/2 bottom-[148px] z-40 -translate-x-1/2 px-4">
          {faucetBanner}
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 bottom-10 z-30 -translate-x-1/2">
        <LifeHubDock
          tabs={dockTabs}
          activeTab={activeHubTab}
          onToggle={onToggleHubTab}
          meta={hubMeta}
        />
      </div>

      <DockRail
        panels={dockPanels}
        activePanel={activeDockPanel}
        onToggle={onToggleDockPanel}
      />

      <LeftHudFooter
        locateButton={locateButton}
        soundToggle={soundToggle}
      />

      <RightHudRail
        feedPanel={feedPanel}
        scannerPanel={scannerPanel}
        searchPanel={searchPanel}
      />

      <EnergizeToasts toasts={toasts} />

      {lifeHubModalVisible ? (
        <div
          className="pointer-events-auto fixed inset-0 z-50 overflow-y-auto bg-[rgba(9,2,18,0.6)] backdrop-blur-md"
          onClick={onCloseLifeHubModal}
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div
              className="pointer-events-auto"
              onClick={(event) => event.stopPropagation()}
            >
              {lifeHubModal}
            </div>
          </div>
        </div>
      ) : null}

    </>
  )
}
