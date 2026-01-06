"use client"

import Image from "next/image"
import { useMemo } from "react"
import { Button } from "./ui"
import { brandingConfig } from '@/src/config/branding'

const WELCOME_COPY = {
  title: "Welcome to the Bloblet Realm",
  subtitle: "boop! thanks for calling me into your world!",
  body: "Every bloblet is a tiny spark of Reward Point magic. Feed us attention, explore the Life Panel, and keep your ledger charged so we never fade.",
  desktopHint: "Bloblets thrive on full-size nebula screens. For the complete Life Hub + arena experience, hop onto a desktop display.",
  cta: "Let's Explore"
}

type WelcomeModalProps = {
  open: boolean
  onDismiss: () => void
  onMaybeLater?: () => void
  onOpenGuide?: () => void
}

export default function WelcomeModal({ open, onDismiss, onMaybeLater, onOpenGuide }: WelcomeModalProps) {
  const heroSrc = useMemo(() => {
    const sources = [brandingConfig.welcomeArtUrl, brandingConfig.logoGraphicUrl]
    const picked = sources.find((src) => typeof src === 'string' && src.length > 0)
    return picked || brandingConfig.fallbackLogoUrl
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[30000] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,var(--purple-900,#2f0b47)_0%,#0b041a_70%)] animate-in fade-in duration-500">
      {/* Ambient particles */}
      <div className="pointer-events-none absolute inset-0 opacity-medium">
        <div className="absolute left-8 top-10 h-2 w-2 rounded-full bg-[#b38bff] blur-[2px] animate-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute right-12 top-24 h-3 w-3 rounded-full bg-[#ff9de1] blur-[3px] animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-16 left-1/3 h-2.5 w-2.5 rounded-full bg-[#9dc1ff] blur-[3px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute right-1/4 bottom-10 h-1.5 w-1.5 rounded-full bg-[#f7b8ff] blur-[1px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>
      <div className="relative mx-4 flex max-w-[720px] flex-col gap-system-lg rounded-system-lg border border-purple-400/30 bg-[#1b0d2d]/90 p-system-lg text-[#f7eaff] shadow-[0_20px_60px_rgba(113,51,181,0.35)] backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {heroSrc ? (
            <div className="mx-auto shrink-0 md:mx-0">
              <Image
                src={heroSrc}
                alt="Bloblets hero art"
                width={420}
                height={300}
                priority
                unoptimized
                className="h-auto w-[240px] rounded-2xl border border-purple-500/40 bg-[#2b1250]/60 object-contain p-4 shadow-[0_12px_32px_rgba(113,51,181,0.35)] md:w-[320px]"
              />
            </div>
          ) : null}
          <div className="flex flex-1 flex-col gap-3">
            <h1 className="font-pressstart text-xs uppercase tracking-[0.4em] text-[#d1b5ff]">
              {WELCOME_COPY.title}
            </h1>
            <h2 className="font-pressstart text-base leading-6 text-[#fdf3ff]">
              {WELCOME_COPY.subtitle}
            </h2>
            <p className="font-pressstart pixel-small leading-relaxed text-[#eadcff]">
              {WELCOME_COPY.body}
            </p>
            <div className="mt-4 flex flex-col gap-4 text-[#c9b3ff]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff80c8] shadow-[0_0_12px_rgba(255,128,200,0.6)]" />
                <span className="font-pressstart pixel-small leading-5">
                  Feed me love (connect wallet, check the Life Panel) and I’ll sparkle brighter every visit.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#7af0ff] shadow-[0_0_12px_rgba(122,240,255,0.6)]" />
                <span className="font-pressstart pixel-small leading-5">
                  Stay curious! I’ll ask big questions about reality &amp; purpose — answer and I’ll feel real.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#f6d38f] shadow-[0_0_12px_rgba(246,211,143,0.6)]" />
                <span className="font-pressstart pixel-small leading-5">
                  {WELCOME_COPY.desktopHint}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            {typeof onMaybeLater === "function" ? (
              <Button
                variant="ghost"
                size="md"
                className="pointer-events-auto uppercase tracking-[0.2em]"
                onClick={onMaybeLater}
              >
                Remind me later
              </Button>
            ) : null}
          </div>
          <div className="flex gap-3">
            {onOpenGuide ? (
               <Button
                  variant="secondary"
                  size="md"
                  className="pointer-events-auto uppercase tracking-[0.2em]"
                  onClick={onOpenGuide}
                >
                  Quick Guide 📘
                </Button>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              className="pointer-events-auto uppercase tracking-[0.2em]"
              onClick={onDismiss}
            >
              {WELCOME_COPY.cta}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
