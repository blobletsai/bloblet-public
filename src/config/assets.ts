/**
 * Asset Configuration
 * Centralizes sprite/avatar default URLs and placeholder assets.
 */

import { storageConfig } from './storage'

interface SpriteAssetConfig {
  defaultAlive: string
  defaultDead: string
  placeholder: string
}

interface AvatarAssetConfig {
  defaultSource: string
  placeholder: string
  canonicalSize: number
}

export interface AssetConfig {
  sprites: SpriteAssetConfig
  avatars: AvatarAssetConfig
}

function trim(value?: string | null): string {
  return (value || '').trim()
}

const DEFAULT_ALIVE_FALLBACK = '/branding/bloblets-mascot-logo.png'

function deriveFromStorage(kind: 'alive' | 'dead'): string {
  const base = storageConfig.public.base
  if (!base) return ''
  return `${base}/defaults/${kind}.png`
}

const explicitAlive = trim(process.env.NEXT_PUBLIC_DEFAULT_SPRITE_URL ?? process.env.DEFAULT_SPRITE_URL)
const explicitDead = trim(process.env.NEXT_PUBLIC_DEFAULT_DEAD_SPRITE_URL ?? process.env.DEFAULT_DEAD_SPRITE_URL)
const alive = explicitAlive || deriveFromStorage('alive') || DEFAULT_ALIVE_FALLBACK
const dead = explicitDead || deriveFromStorage('dead') || alive
const placeholder =
  trim(process.env.NEXT_PUBLIC_PLACEHOLDER_SPRITE_URL ?? process.env.PLACEHOLDER_SPRITE_URL) || alive
const canonicalSize = Math.max(1, Number(process.env.CANONICAL_SPRITE_SIZE || 256))

export const assetConfig: AssetConfig = {
  sprites: {
    defaultAlive: alive,
    defaultDead: dead,
    placeholder,
  },
  avatars: {
    defaultSource: trim(process.env.DEFAULT_AVATAR_SOURCE_URL),
    placeholder,
    canonicalSize,
  },
}
