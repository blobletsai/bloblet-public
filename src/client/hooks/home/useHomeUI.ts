"use client"

import { useCallback, useEffect, useState } from 'react'

import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import { subscribeClientEvent } from '@/src/client/events/useClientEventBus'

const STORAGE_KEY = 'bloblet:welcomeSeen:v1'
const CANVAS_TIMEOUT_MESSAGE = 'It has been 30 seconds and the canvas is still blank — please refresh the page to reload it.'

export type HomeUIState = {
  toast: string | null
  countdownSeconds: number | null
  showWelcome: boolean
  isMobileLayout: boolean
  faucetOpen: boolean
}

export type HomeUIControls = {
  setToast: (value: string | null) => void
  setCountdownSeconds: (value: number | null) => void
  dismissWelcome: () => void
  remindLater: () => void
  toggleFaucet: () => void
  openFaucet: () => void
  closeFaucet: () => void
  clearToast: () => void
}

export function useHomeUI(): HomeUIState & HomeUIControls {
  const [toast, setToast] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [faucetOpen, setFaucetOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let timer: number | null = null
    let ready = false
    let active = true

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const showTimeoutToast = () => {
      if (!active || ready) return
      setToast((prev) => {
        if (prev && prev !== CANVAS_TIMEOUT_MESSAGE) return prev
        return CANVAS_TIMEOUT_MESSAGE
      })
    }

    const startTimer = () => {
      if (!active) return
      if (typeof document !== 'undefined' && document.hidden) {
        clearTimer()
        return
      }
      ready = false
      clearTimer()
      timer = window.setTimeout(showTimeoutToast, 30000)
    }

    const handleReady = () => {
      if (!active) return
      ready = true
      clearTimer()
      setToast((prev) => (prev === CANVAS_TIMEOUT_MESSAGE ? null : prev))
    }

    const handleVisibility = () => {
      if (!active) return
      if (typeof document !== 'undefined' && document.hidden) {
        clearTimer()
      } else {
        startTimer()
      }
    }

    const unsubscribeCanvas = subscribeClientEvent(CLIENT_EVENT.CANVAS_READY, handleReady)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }
    startTimer()

    return () => {
      active = false
      clearTimer()
      try {
        unsubscribeCanvas()
      } catch {}
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
    }
  }, [])

  useEffect(() => {
    if (isMobileLayout && faucetOpen) {
      setFaucetOpen(false)
    }
  }, [isMobileLayout, faucetOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const coarse = window.matchMedia('(pointer: coarse)')
    const narrow = window.matchMedia('(max-width: 900px)')

    const compute = () => setIsMobileLayout(coarse.matches || narrow.matches)

    compute()
    const handler = () => compute()

    if (typeof coarse.addEventListener === 'function') coarse.addEventListener('change', handler)
    else coarse.addListener(handler)

    if (typeof narrow.addEventListener === 'function') narrow.addEventListener('change', handler)
    else narrow.addListener(handler)

    window.addEventListener('resize', handler)
    return () => {
      if (typeof coarse.removeEventListener === 'function') coarse.removeEventListener('change', handler)
      else coarse.removeListener(handler)
      if (typeof narrow.removeEventListener === 'function') narrow.removeEventListener('change', handler)
      else narrow.removeListener(handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      const deferred = window.sessionStorage.getItem(`${STORAGE_KEY}:session-dismissed`)
      setShowWelcome(!deferred)
    }
  }, [])

  useEffect(() => {
    if (countdownSeconds === null || countdownSeconds <= 0) return

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setToast("🎉 Your bloblet is ready!\n1. Refresh the page\n2. Reconnect your wallet to see it")
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [countdownSeconds])

  const dismissWelcome = useCallback(() => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
      try { window.sessionStorage.removeItem(`${STORAGE_KEY}:session-dismissed`) } catch {}
      try { (window as any).BlobletsWorld_replayEntry?.() } catch {}
    }
    setShowWelcome(false)
  }, [])

  const remindLater = useCallback(() => {
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.setItem(`${STORAGE_KEY}:session-dismissed`, '1') } catch {}
      try { (window as any).BlobletsWorld_replayEntry?.() } catch {}
    }
    setShowWelcome(false)
  }, [])

  const toggleFaucet = useCallback(() => setFaucetOpen((prev) => !prev), [])
  const openFaucet = useCallback(() => setFaucetOpen(true), [])
  const closeFaucet = useCallback(() => setFaucetOpen(false), [])
  const clearToast = useCallback(() => {
    setToast(null)
    setCountdownSeconds(null)
  }, [])

  return {
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
  }
}
