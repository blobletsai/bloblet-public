import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'

import WelcomeModal from '@/components/WelcomeModal'
import { HomeFaucet } from '@/components/home/HomeFaucet'
import { brandingConfig } from '@/src/config/branding'
import { assetConfig } from '@/src/config/assets'
import { appConfig } from '@/src/config/app'
import { solanaConfig } from '@/src/config/solana'
import { useOnlineStatus } from '@/src/client/hooks/useOnlineStatus'
import { useSession } from '@/src/client/hooks/useSession'
import { useClientEventBus } from '@/src/client/events/useClientEventBus'
import { useHomeUI } from '@/src/client/hooks/home/useHomeUI'
import { useHomeRealtime } from '@/src/client/hooks/home/useHomeRealtime'
import { useHomeDataSync } from '@/src/client/hooks/home/useHomeDataSync'
import { getHomePageProps, HomePageProps } from '@/src/server/services/homePage'

const BlobletsWorld = dynamic(() => import('@/components/BlobletsWorld'), { ssr: false })
const HUDPortal = dynamic(() => import('@/components/HUDPortal'), { ssr: false })
const HUDRightPortal = dynamic(() => import('@/components/HUDRightPortal'), { ssr: false })
const DebugPanel = dynamic(() => import('@/components/DebugPanel'), { ssr: false })
const VisualGuideModal = dynamic(() => import('@/components/help/VisualGuideModal').then(m => m.VisualGuideModal), { ssr: false })

const LOGO_COMPOSITE_SRC =
  (brandingConfig.logoGraphicUrl || brandingConfig.fallbackLogoUrl || '/branding/bloblets-mascot-logo.png').trim()
const CLIENT_CHAIN_KIND: 'sol' = 'sol'
const SHARED_DEAD_SPRITE = (assetConfig.sprites.defaultDead || '').trim() || null
const DOCS_URL = appConfig.urls.docs || 'https://docs.bloblets.ai'

export const getServerSideProps: GetServerSideProps<HomePageProps> = async (context) => {
  const props = await getHomePageProps(context)
  return { props }
}

export default function Home({
  bloblets,
  mint,
  decimals,
  treasuryWallet,
  treasuryAta,
  loadouts: maskedLoadouts,
  pvpItems,
  battles,
  rewardTopUpMin,
  rewardTopUpMax,
}: HomePageProps) {
  const {
    toast,
    countdownSeconds,
    showWelcome,
    isMobileLayout,
    faucetOpen,
    setToast,
    setCountdownSeconds,
    dismissWelcome,
    remindLater,
    toggleFaucet,
    openFaucet,
    closeFaucet,
    clearToast,
  } = useHomeUI()

  const [visualGuideOpen, setVisualGuideOpen] = useState(false)

  const isOnline = useOnlineStatus()
  const session = useSession()
  const walletConnected = session.verified
  const isHolder = session.isHolder
  const minTokens = session.minTokens ?? null
  const eventBus = useClientEventBus()

  const rewardsConfig = useMemo(() => ({
    mint,
    decimals,
    treasuryWallet,
    treasuryAta: treasuryAta || undefined,
    tokenSymbol: solanaConfig.token.symbol || 'BLOBLET',
    conversionRate: 1,
    walletConnected,
    isHolder,
    minTokens,
    rewardTopUpMin,
    rewardTopUpMax,
  }), [mint, decimals, treasuryWallet, treasuryAta, walletConnected, isHolder, minTokens, rewardTopUpMin, rewardTopUpMax])

  useHomeDataSync({
    bloblets,
    maskedLoadouts,
    pvpItems,
    battles,
    session,
    sharedDeadSprite: SHARED_DEAD_SPRITE,
    clientChainKind: CLIENT_CHAIN_KIND,
  })

  useHomeRealtime({
    isOnline,
    session,
    clientChainKind: CLIENT_CHAIN_KIND,
    sharedDeadSprite: SHARED_DEAD_SPRITE,
    eventBus,
    setCountdownSeconds,
    setToast,
  })

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <WelcomeModal 
        open={showWelcome} 
        onDismiss={dismissWelcome} 
        onMaybeLater={remindLater}
        onOpenGuide={() => setVisualGuideOpen(true)} 
      />
      <VisualGuideModal open={visualGuideOpen} onClose={() => setVisualGuideOpen(false)} />
      <HUDRightPortal>
        <div className="flex flex-col items-end gap-2">
          <DebugPanel />
        </div>
      </HUDRightPortal>
      {!isMobileLayout && (
        <HUDPortal>
          <div className="relative flex flex-col items-center gap-3">
            <HomeFaucet
              isMobileLayout={false}
              faucetOpen={faucetOpen}
              onToggleFaucet={toggleFaucet}
              onCloseFaucet={closeFaucet}
              onOpenFaucet={openFaucet}
            />
            <button
              onClick={() => setVisualGuideOpen(true)}
              className="pointer-events-auto grid h-12 w-12 place-items-center rounded-system-sm border border-[rgba(148,93,255,0.35)] bg-[rgba(22,10,48,0.85)] text-[18px] transition hover:border-[rgba(255,134,230,0.45)]"
              title="Visual Guide"
              aria-label="Visual Guide"
            >
              <span aria-hidden>📘</span>
            </button>
          </div>
        </HUDPortal>
      )}
      {isMobileLayout && (
        <HomeFaucet
          isMobileLayout
          faucetOpen={faucetOpen}
          onToggleFaucet={toggleFaucet}
          onCloseFaucet={closeFaucet}
          onOpenFaucet={openFaucet}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[20000] max-w-[90vw]">
          <div className="pointer-events-auto toast-fantasy rounded-2xl px-4 py-3 flex items-start gap-3 max-w-[720px] backdrop-blur">
            <div className="font-pressstart pixel-small text-fantasy-primary whitespace-pre-line">
              {toast}
            </div>
            <button
              onClick={clearToast}
              className="ml-2 text-fantasy-muted hover:text-fantasy-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <BlobletsWorld rewardsConfig={rewardsConfig} logoSrc={LOGO_COMPOSITE_SRC || undefined} />
    </div>
  )
}
