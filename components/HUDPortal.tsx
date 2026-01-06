"use client"

import { createPortal } from 'react-dom'
import { useEffect, useState, type ReactNode } from 'react'

export default function HUDPortal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(
    <div className={`fixed top-4 left-4 z-[9999] pointer-events-auto ${className}`}>{children}</div>,
    document.body
  )
}

