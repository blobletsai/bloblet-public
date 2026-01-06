import type { RiskTone } from '@/src/shared/pvp'

export const RISK_TONE_AURAS: Record<
  RiskTone,
  { ring: string; fill: string; tag: string }
> = {
  good: {
    ring: 'rgba(255,109,155,0.9)',
    fill: 'rgba(255,109,155,0.24)',
    tag: '#ff6d9b',
  },
  warn: {
    ring: 'rgba(255,150,94,0.9)',
    fill: 'rgba(255,150,94,0.24)',
    tag: '#ff9660',
  },
  bad: {
    ring: 'rgba(255,84,84,0.92)',
    fill: 'rgba(255,84,84,0.24)',
    tag: '#ff5454',
  },
  neutral: {
    ring: 'rgba(215,184,255,0.88)',
    fill: 'rgba(215,184,255,0.24)',
    tag: '#d7b8ff',
  },
}

export const RISK_TONE_TEXT: Record<RiskTone, string> = {
  good: '#430b22',
  warn: '#441a08',
  bad: '#4c0707',
  neutral: '#2d064c',
}

export const SCOUT_RETICLE_COLOR = 'rgba(255,90,145,0.8)'
