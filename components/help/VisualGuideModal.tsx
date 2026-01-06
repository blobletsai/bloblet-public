"use client"

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Button } from '@/components/ui'
import { appConfig } from '@/src/config/app'

const SLIDES = [
  {
    id: 'loop',
    title: 'Survival Loop',
    src: 'https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/infographics/gameplay-rules-how-to-play.jpeg',
    alt: 'Gameplay Loop: Nourish, Battle, Survive'
  },
  {
    id: 'battle',
    title: 'Battle Math',
    src: 'https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/infographics/gameplay-rules-battle-mechanics.jpeg',
    alt: 'Battle Mechanics: Weapon vs Shield + Luck'
  },
  {
    id: 'economy',
    title: 'Economy',
    src: 'https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/infographics/economy-rules-rp-treasury-modes.jpeg',
    alt: 'Economy Flow: BlobCoin & Treasury'
  },
  {
    id: 'tokenomics',
    title: 'Tokenomics',
    src: 'https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/infographics/economy-rules.jpeg',
    alt: 'Tokenomics Overview'
  },
  {
    id: 'rng',
    title: 'Fairness',
    src: 'https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/infographics/rng-fairness.jpeg',
    alt: 'RNG Fairness & Bad Luck Protection'
  }
]

type Props = {
  open: boolean
  onClose: () => void
}

export function VisualGuideModal({ open, onClose }: Props) {
  const [index, setIndex] = useState(0)
  
  const current = SLIDES[index]
  const hasNext = index < SLIDES.length - 1
  const hasPrev = index > 0
  const DOCS_URL = appConfig.urls.docs || 'https://docs.bloblets.ai'

  if (!open || !current) return null

  return createPortal(
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-[rgba(9,2,18,0.85)] backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="relative flex flex-col w-full max-w-[800px] max-h-[90vh] rounded-[24px] border border-[rgba(148,93,255,0.4)] bg-[#160a30] shadow-[0_0_60px_rgba(113,51,181,0.4)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(148,93,255,0.2)] bg-[#1c0d3a]">
          <div className="flex items-center gap-3">
            <span className="text-[20px]">📘</span>
            <span className="font-pressstart text-xs uppercase tracking-[0.2em] text-[#d1b5ff]">Visual Guide</span>
          </div>
          <button 
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] text-[#d1b5ff] hover:bg-[rgba(255,255,255,0.2)] transition"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 relative flex items-center justify-center bg-[#0b041a] p-1 min-h-[300px] md:min-h-[400px] overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
             {/* Image Container */}
             <div className="relative w-full h-full aspect-video max-h-[60vh]">
               <Image
                 src={current.src}
                 alt={current.alt}
                 fill
                 className="object-contain"
                 priority
                 unoptimized // R2 images
               />
             </div>
             
             {/* Nav Overlay Buttons */}
             <button
               onClick={() => setIndex(i => Math.max(0, i - 1))}
               disabled={!hasPrev}
               className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-black/50 text-white backdrop-blur disabled:opacity-0 hover:bg-black/70 transition"
             >
               ←
             </button>
             <button
               onClick={() => setIndex(i => Math.min(SLIDES.length - 1, i + 1))}
               disabled={!hasNext}
               className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-black/50 text-white backdrop-blur disabled:opacity-0 hover:bg-black/70 transition"
             >
               →
             </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#1c0d3a] border-t border-[rgba(148,93,255,0.2)] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="font-pressstart text-[10px] text-[#a58fff] uppercase tracking-wider">
              {current.title} <span className="text-[#6b5a99] ml-2">({index + 1}/{SLIDES.length})</span>
            </div>
            
            {/* Pips */}
            <div className="flex gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-2 w-2 rounded-full transition-all ${i === index ? 'bg-[#8ff7ff] w-4' : 'bg-[#4b3a75] hover:bg-[#6b5a99]'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)]">
             <a 
               href={DOCS_URL} 
               target="_blank" 
               rel="noopener noreferrer"
               className="text-[11px] text-[#8ff7ff] hover:text-white underline decoration-dashed underline-offset-4"
             >
               Read Full Documentation ↗
             </a>
             
             <Button variant="primary" size="sm" onClick={onClose} className="uppercase tracking-widest">
               Close
             </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
