"use client"

import { useCallback, useEffect, useState } from 'react'

import { NAV_HINT_KEY } from '../constants'

export type PointerKind = 'mouse' | 'touch' | 'pen'

export type NavHintAndPointerControls = {
  showNavHint: boolean
  pointerType: PointerKind
  handleNavHintDismiss: () => void
  updatePointerType: (type: PointerKind) => void
}

export function useNavHintAndPointer(): NavHintAndPointerControls {
  const [showNavHint, setShowNavHint] = useState(false)
  const [pointerType, setPointerType] = useState<PointerKind>('mouse')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const seen = window.localStorage.getItem(NAV_HINT_KEY)
      if (!seen) {
        setShowNavHint(true)
      }
    } catch {
      setShowNavHint(true)
    }
  }, [])

  const handleNavHintDismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NAV_HINT_KEY, '1')
      } catch {
        // ignore storage errors; hint will simply reappear next visit
      }
    }
    setShowNavHint(false)
  }, [])

  const updatePointerType = useCallback((type: PointerKind) => {
    setPointerType((prev) => (prev === type ? prev : type))
  }, [])

  return {
    showNavHint,
    pointerType,
    handleNavHintDismiss,
    updatePointerType,
  }
}
