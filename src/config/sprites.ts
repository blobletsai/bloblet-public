/**
 * Sprite Set Configuration
 * Centralizes sprite atlas settings for random appearance selection.
 */

import { storageConfig } from './storage'

interface SpriteRandomizerConfig {
  baseUrl: string
  extension: string
  total: number
  hasCustomTotal: boolean
}

export interface SpritesConfig {
  randomizer: SpriteRandomizerConfig
}

function trim(value?: string | null): string {
  return (value || '').trim()
}

function parseTotal(raw: string | undefined, fallback = 100): number {
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(1, Math.floor(parsed))
}

const baseUrl = trim(process.env.SPRITES_BASE_URL)?.replace(/\/$/, '') || ''
const extension = trim(process.env.SPRITES_EXT) || 'png'
const totalEnv = trim(process.env.SPRITES_TOTAL)
const total = parseTotal(totalEnv, 100)

export const spritesConfig: SpritesConfig = {
  randomizer: {
    baseUrl,
    extension,
    total,
    hasCustomTotal: Boolean(totalEnv),
  },
}

export function deriveDefaultSpritePath(kind: 'alive' | 'dead'): string {
  if (spritesConfig.randomizer.baseUrl) {
    return `${spritesConfig.randomizer.baseUrl}/defaults/${kind}.${spritesConfig.randomizer.extension}`
  }
  const storageBase = storageConfig.public.base
  if (storageBase) return `${storageBase}/defaults/${kind}.png`
  return ''
}
