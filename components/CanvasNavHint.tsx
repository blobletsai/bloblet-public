"use client"

import { useMemo } from "react"

interface CanvasNavHintProps {
  open: boolean
  pointerType: 'mouse' | 'touch' | 'pen'
  onDismiss: () => void
}

const COPY = {
  mouse: {
    title: 'Explore The Realm',
    lines: [
      'Scroll or pinch to zoom the canvas.',
      'Click + drag to glide across the world.'
    ]
  },
  touch: {
    title: 'Explore The Realm',
    lines: [
      'Pinch with two fingers to zoom.',
      'Drag the world with two fingers to roam.'
    ]
  },
  pen: {
    title: 'Explore The Realm',
    lines: [
      'Use your pen to drag the world.',
      'Scroll or pinch to zoom when needed.'
    ]
  }
}

export default function CanvasNavHint({ open, pointerType, onDismiss }: CanvasNavHintProps) {
  const content = useMemo(() => COPY[pointerType] ?? COPY.mouse, [pointerType])

  if (!open) return null

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[25000] w-[min(90vw,460px)] -translate-x-1/2">
      <div className="relative overflow-hidden rounded-2xl border border-purple-400/30 bg-[#1b0d2d]/92 px-5 py-4 text-[#f7eaff] shadow-[0_18px_42px_rgba(113,51,181,0.28)] backdrop-blur">
        <div className="pointer-events-auto flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-3 w-3 shrink-0 rounded-full bg-[#ff80c8] shadow-[0_0_12px_rgba(255,128,200,0.7)]" />
            <h3 className="font-pressstart text-xs uppercase tracking-[0.28em] text-[#d1b5ff]">{content.title}</h3>
          </div>
          <ul className="flex flex-col gap-2">
            {content.lines.map((line, idx) => (
              <li key={idx} className="font-pressstart pixel-small text-[#eadcff]">
                {line}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button
              type="button"
              className="pointer-events-auto inline-flex items-center justify-center rounded-full border border-[#f3a8ff] bg-[#ff7fe6] px-4 py-2 font-pressstart pixel-small uppercase tracking-[0.2em] text-[#2d0a44] shadow-[0_10px_20px_rgba(255,127,230,0.3)] transition hover:brightness-110"
              onClick={onDismiss}
            >
              Got It
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-10 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-[#7af0ff]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 bottom-0 h-20 w-20 rounded-full bg-[#ff80c8]/15 blur-3xl" />
      </div>
    </div>
  )
}
