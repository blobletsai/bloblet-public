"use client"

import { assetConfig } from '@/src/config/assets'
import type { HolderMetaEntry } from './types'

const DEFAULT_ALIVE_SPRITE = assetConfig.sprites.defaultAlive
const DEFAULT_DEAD_SPRITE = assetConfig.sprites.defaultDead

const sanitize = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed.length ? trimmed : null
}

export type AvatarResolution = {
  alive: string | null
  dead: string | null
  hasCustom: boolean
}

export const defaultAvatars = {
  alive: DEFAULT_ALIVE_SPRITE || null,
  dead: DEFAULT_DEAD_SPRITE || DEFAULT_ALIVE_SPRITE || null,
}

export function resolveHolderAvatar(
  holderMeta: Record<string, HolderMetaEntry>,
  address: string | null | undefined,
): AvatarResolution {
  const key = String(address || '').trim()
  const meta = key ? holderMeta[key] : undefined
  const alive = sanitize(meta?.aliveUrl) ?? defaultAvatars.alive
  const fallbackDead = defaultAvatars.dead ?? defaultAvatars.alive ?? null
  const dead = sanitize(meta?.deadUrl) ?? fallbackDead
  const hasCustom = !!sanitize(meta?.aliveUrl) || !!sanitize(meta?.deadUrl)
  return { alive, dead, hasCustom }
}
