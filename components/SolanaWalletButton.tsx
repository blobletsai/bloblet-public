"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import bs58 from 'bs58'
import HudTooltip from './HudTooltip'
import { disconnectSolanaProviders, type SolanaWindowProvider } from '@/src/client/solana/disconnectProviders'
import { clearPreferredSolWallet, getPreferredSolWallet, setPreferredSolWallet, type SolWalletKind } from '@/src/client/solana/providerPreference'
import { useSession } from '@/src/client/hooks/useSession'
import { clearSessionCookieClient, getSessionManager } from '@/src/client/session/sessionManager'
import { emitClientEvent, useClientEventBus } from '@/src/client/events/useClientEventBus'
import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

type Props = {
  hideTitles?: boolean
  disableToasts?: boolean
  visuallyHidden?: boolean
}

function getProvider(name: SolWalletKind): SolanaWindowProvider | null {
  const w = typeof window !== 'undefined' ? (window as any) : {}
  if (name === 'phantom') return w?.solana || null
  if (name === 'solflare') return w?.solflare || null
  return null
}

export default function SolanaWalletButton({ hideTitles = false, disableToasts = false, visuallyHidden = false }: Props) {
  const [address, setAddress] = useState<string | null>(null)
  const [currentWallet, setCurrentWallet] = useState<SolWalletKind | null>(() => getPreferredSolWallet())
  const [holder, setHolder] = useState<boolean | null>(null)
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minTokens, setMinTokens] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventBus = useClientEventBus()
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 12, top: 0 })
  const session = useSession()

  const showToast = useCallback((msg: string) => {
    if (disableToasts) return
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2200)
  }, [disableToasts])

  // Close menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (rootRef.current && rootRef.current.contains(target)) return
      if (menuRef.current && menuRef.current.contains(target)) return
      setMenuOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  // Position the dropdown (flip above when space is tight)
  useEffect(() => {
    if (!menuOpen) return
    const update = () => {
      const el = rootRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const availBelow = window.innerHeight - r.bottom
      const right = Math.max(8, Math.floor(window.innerWidth - r.right))
      if (availBelow < 140) {
        setMenuPos({ bottom: Math.floor(window.innerHeight - r.top + 8), right })
      } else {
        setMenuPos({ top: Math.floor(r.bottom + 8), right })
      }
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!eventBus) return
    return eventBus.subscribe(CLIENT_EVENT.SESSION_EXPIRED, (detail) => {
      const reason = typeof detail?.reason === 'string' ? detail.reason : 'expired'
      if (reason === 'expired') {
        showToast('Session expired — verify wallet')
      }
    })
  }, [eventBus, showToast])

  useEffect(() => {
    if (session.verified && session.address) {
      setAddress(session.address)
      setHolder(session.isHolder)
      setVerified(true)
    } else if (!session.loading) {
      setVerified(false)
      setHolder(null)
    }
    if (typeof session.minTokens === 'number') {
      setMinTokens(session.minTokens)
    } else if (session.minTokens == null) {
      setMinTokens(null)
    }
  }, [session.address, session.isHolder, session.minTokens, session.verified, session.loading])


  const emitVerified = useCallback((addr: string, isHolderState: boolean) => {
    emitClientEvent(CLIENT_EVENT.VERIFIED, { address: addr, isHolder: isHolderState })
  }, [])

  const disconnectAll = useCallback(async () => {
    try {
      const resp = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch (err: any) {
    }
    try {
      await Promise.resolve(clearSessionCookieClient())
    } catch (err: any) {
    }
    try {
      await disconnectSolanaProviders({
        providers: {
          phantom: getProvider('phantom'),
          solflare: getProvider('solflare'),
        },
        priority: currentWallet ? [currentWallet] : undefined,
      })
    } catch (err: any) {
    }
    try { (window as any).BlobletsWorld_clearSession?.() } catch {}
    emitClientEvent(CLIENT_EVENT.LOGOUT, {})
    setAddress(null); setHolder(null); setVerified(false)
    try { clearPreferredSolWallet() } catch {}
    setCurrentWallet(null)
    showToast('Disconnected')
  }, [currentWallet, showToast])

  const connectAndVerify = useCallback(async (which: 'phantom' | 'solflare') => {
    setError(null)
    const provider = getProvider(which)
    if (!provider) { setError('Wallet not available'); return }
    try {
      const conn = await provider.connect()
      const pk = (conn?.publicKey || provider.publicKey)
      const addr = typeof pk?.toBase58 === 'function' ? pk.toBase58() : (typeof pk?.toString === 'function' ? pk.toString() : '')
      if (!addr) throw new Error('No public key')
      setAddress(addr)
      setPreferredSolWallet(which)
      setCurrentWallet(which)

      // Verify
      if (typeof provider.signMessage !== 'function') { setError('Wallet cannot sign'); return }
      setVerifying(true)
      const { message } = await fetchJSON('/api/auth/sol/nonce')
      const msg = String(message || '').replace('<YOUR_ADDRESS>', addr)
      const bytes = new TextEncoder().encode(msg)
      const signed = await provider.signMessage(bytes)
      const sigBytes = (signed && (signed as any).signature) ? (signed as any).signature as Uint8Array : (signed as Uint8Array)
      const signature = bs58.encode(sigBytes)
      const resp = await fetchJSON('/api/auth/sol/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addr, signature, message: msg }) })
      if (typeof resp?.minTokens === 'number') setMinTokens(resp.minTokens)
      const isHolder = !!resp?.isHolder
      setHolder(isHolder)
      setVerified(true)
      try { (window as any).BlobletsWorld_setMyAddress?.(addr, addr) } catch {}
      emitVerified(addr, isHolder)
      try { void getSessionManager().refresh({ force: true, reason: 'wallet_verified' }) } catch {}
      const thr = (typeof resp?.minTokens === 'number' && isFinite(resp.minTokens)) ? resp.minTokens : undefined
      const thrTxt = typeof thr === 'number' ? thr.toLocaleString() : ''
      showToast(isHolder ? 'Verified ✓' : (thrTxt ? `Need ≥ ${thrTxt}` : 'Not a holder'))
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase()
      if (msg.includes('reject') || msg.includes('cancel')) showToast('Connect cancelled')
      else showToast('Connect failed')
    } finally { setVerifying(false) }
  }, [emitVerified, showToast])

  const short = (addr?: string | null) => addr ? `${addr.slice(0,4)}…${addr.slice(-4)}` : ''
  const shortAddress = short(address)
  const minTokensText = typeof minTokens === 'number' ? minTokens.toLocaleString() : undefined

  let primaryLabel = 'Connect Wallet'
  let primaryTitle = hideTitles ? undefined : 'Connect to Phantom or Solflare'
  let primaryDisabled = false
  let statusGlyph = '⚠️'
  let statusColorClass = 'text-[#ff9de1]'
  let statusMessage = hideTitles ? 'Wallet status' : 'Connect wallet to verify gate access.'
  let walletIcon = address ? '👛' : '🔌'

  if (verifying) {
    primaryLabel = 'Verifying…'; primaryDisabled = true
    statusGlyph = '⏳'; statusColorClass = 'text-[#ffc46b]'
    statusMessage = hideTitles ? 'Verifying wallet' : 'Verifying holder status…'
    walletIcon = '⏳'
  } else if (address && !verified) {
    primaryLabel = shortAddress ? `Verify · ${shortAddress}` : 'Verify Wallet'
    statusGlyph = '⚠️'; statusColorClass = 'text-[#ffc46b]'
    statusMessage = hideTitles ? 'Verification required' : 'Wallet connected — verify holder status'
  } else if (address && verified && holder) {
    primaryLabel = shortAddress ? `Verified ✓ · ${shortAddress}` : 'Verified ✓'
    statusGlyph = '✅'; statusColorClass = 'text-[#7bffd6]'
    statusMessage = hideTitles ? 'Holder verified' : 'Wallet connected · gate satisfied.'
  } else if (address && verified && holder === false) {
    primaryLabel = minTokensText ? `Need ≥ ${minTokensText} · ${shortAddress}` : `Needs Tokens · ${shortAddress}`
    statusGlyph = '⚠️'; statusColorClass = 'text-[#ff9de1]'
    statusMessage = minTokensText ? (hideTitles ? `Need ≥ ${minTokensText}` : `Need ≥ ${minTokensText} tokens to clear the gate.`) : (hideTitles ? 'Holder threshold not met' : 'Holder threshold not met.')
  } else if (address) {
    primaryLabel = shortAddress
    statusGlyph = '⏳'; statusColorClass = 'text-[#ffc46b]'
    statusMessage = hideTitles ? 'Wallet connected' : 'Wallet connected.'
  }

  const baseRootClasses = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(148,93,255,0.45)] shadow-[0_14px_36px_rgba(18,4,36,0.5)] bg-[rgba(20,10,38,0.75)] backdrop-blur relative'
  const rootClassName = visuallyHidden ? 'sr-only' : baseRootClasses

  return (
    <div ref={rootRef} className={rootClassName}>
      {toast && !disableToasts && !menuOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] rounded-full bg-[rgba(23,10,40,0.95)] border border-[rgba(148,93,255,0.45)] px-3 py-1 text-[10px] font-pressstart text-fantasy-primary shadow-[0_14px_32px_rgba(16,4,30,0.65)]">{toast}</div>
      )}
      <HudTooltip content={statusMessage} side="bottom" align="end" className="w-full">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={verifying}
          aria-label={primaryTitle ?? statusMessage}
          className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ff7ff]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(13,4,28,0.9)]"
        >
          <span aria-hidden className="text-[15px]">{walletIcon}</span>
          <span className="font-pressstart text-[11px] text-white/90">{address ? shortAddress : 'Connect Wallet'}</span>
          <span className={`text-[12px] ${statusColorClass}`} aria-hidden>{statusGlyph}</span>
        </button>
      </HudTooltip>
      {menuOpen && createPortal(
        <div ref={menuRef} className="fixed z-[10010] min-w-[220px] rounded-2xl border border-[rgba(148,93,255,0.45)] bg-[rgba(17,8,34,0.92)] shadow-[0_28px_60px_rgba(16,4,30,0.65)] backdrop-blur" style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right }}>
          {!address ? (
            <>
              <button onClick={() => { setMenuOpen(false); connectAndVerify('phantom') }} className="w-full text-left px-3 py-2 font-pressstart pixel-small text-fantasy-primary hover:bg-[rgba(86,48,173,0.35)]">Connect Phantom</button>
              <button onClick={() => { setMenuOpen(false); connectAndVerify('solflare') }} className="w-full text-left px-3 py-2 font-pressstart pixel-small text-fantasy-primary hover:bg-[rgba(86,48,173,0.35)]">Connect Solflare</button>
            </>
          ) : (
            <>
              {!verified && (
                <button
                  disabled={verifying}
                  onClick={() => {
                    setMenuOpen(false)
                    const preferred = currentWallet || getPreferredSolWallet() || 'phantom'
                    void connectAndVerify(preferred)
                  }}
                  className="w-full text-left px-3 py-2 font-pressstart pixel-small text-fantasy-primary hover:bg-[rgba(86,48,173,0.35)] disabled:opacity-60"
                >
                  Verify wallet
                </button>
              )}
              <button onClick={() => { setMenuOpen(false); void disconnectAll() }} className="w-full text-left px-3 py-2 font-pressstart pixel-small text-fantasy-muted hover:text-fantasy-primary hover:bg-[rgba(86,48,173,0.35)]">Disconnect</button>
            </>
          )}
        </div>,
        document.body,
      )}
      {error && <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] text-[10px] text-red-300 font-pressstart">{error}</div>}
    </div>
  )
}
