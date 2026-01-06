"use client"

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

type HudTooltipProps = {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  className?: string
  /** Automatically hides the tooltip after this many milliseconds on touch */
  touchHideDelay?: number
}

const SIDE_CLASS_MAP: Record<NonNullable<HudTooltipProps['side']>, string> = {
  top: 'bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+10px)] left-1/2 -translate-x-1/2',
  left: 'right-[calc(100%+10px)] top-1/2 -translate-y-1/2',
  right: 'left-[calc(100%+10px)] top-1/2 -translate-y-1/2',
}

export default function HudTooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  className,
  touchHideDelay = 2200,
}: HudTooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const hideSoon = useCallback((delay = 80) => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => setOpen(false), delay)
  }, [])

  const show = () => {
    clearCloseTimer()
    setOpen(true)
  }

  const handleMouseEnter = () => show()
  const handleMouseLeave = () => hideSoon()
  const handleFocus = () => show()
  const handleBlur = () => hideSoon()

  const handleTouchStart: React.TouchEventHandler<HTMLSpanElement> = () => {
    if (open) {
      hideSoon()
      return
    }
    show()
    hideSoon(touchHideDelay)
  }

  useEffect(() => {
    const current = rootRef.current
    if (!current) return
    const handlePointer = (event: PointerEvent) => {
      if (!open) return
      const target = event.target as HTMLElement | null
      if (!target) return
      if (current.contains(target)) return
      hideSoon()
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [hideSoon, open])

  const sideClasses = SIDE_CLASS_MAP[side]
  let alignClasses = ''
  if (side === 'top' || side === 'bottom') {
    if (align === 'start') {
      alignClasses = 'left-0 translate-x-0'
    } else if (align === 'end') {
      alignClasses = 'left-auto right-0 translate-x-0'
    }
  } else {
    if (align === 'start') {
      alignClasses = 'top-0 translate-y-0'
    } else if (align === 'end') {
      alignClasses = 'top-auto bottom-0 translate-y-0'
    }
  }

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTouchStart={handleTouchStart}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute z-[10000] whitespace-nowrap rounded-full border border-[rgba(148,93,255,0.45)] bg-[rgba(20,6,44,0.95)] px-3 py-1 text-[10px] font-pressstart text-[#c7b5ff] shadow-[0_18px_40px_rgba(20,6,48,0.65)] transition-opacity duration-100 ${sideClasses} ${alignClasses}`}
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
