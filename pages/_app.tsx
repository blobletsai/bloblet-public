import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import Link from 'next/link'
import '../app/globals.css'
import dynamic from 'next/dynamic'
import { brandingConfig } from '@/src/config/branding'

const NAV_LOGO =
  (brandingConfig.logoTextUrl || brandingConfig.logoGraphicUrl || '/branding/bloblets-text-logo.png').trim()

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isHome = router.pathname === '/'
  const ConnectWallet = dynamic(() => import('@/components/WalletButton'), { ssr: false })

  if (isHome) {
    return <Component {...pageProps} />
  }
  return (
    <div className="relative z-0 max-w-6xl mx-auto px-4 py-6">
      <header className="relative z-20 mb-6 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Bloblets home"
          className="flex items-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={NAV_LOGO}
            alt="Bloblets logo"
            className="h-10 w-auto drop-shadow-[0_0_12px_rgba(186,140,255,0.45)]"
            loading="lazy"
          />
        </Link>
        <div className="relative z-20 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { try { window.location.href = '/'; } catch { window.location.assign('/'); } }}
            className="btn-fantasy"
          >Home</button>
          <button
            onClick={() => { router.push('/?modal=my-assets').catch(() => {}) }}
            aria-label="Open My Assets"
            data-cta="life_panel_link"
            className="btn-fantasy"
            type="button"
          >
            My Assets
          </button>
          <a
            href="https://docs.bloblets.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-fantasy-ghost"
            aria-label="Help & Documentation"
          >
            Help
          </a>
          <ConnectWallet />
        </div>
      </header>
      <Component {...pageProps} />
    </div>
  )
}
