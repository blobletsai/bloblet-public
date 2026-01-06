import { Bloblet } from '@/src/types/domain/bloblet'

export type HubTab = 'life' | 'persona' | 'loadout' | 'opponents' | 'rewards'

export type DockPanelId = 'stats' | 'ledger' | 'arena' | 'assets'

// Deprecated: Use Bloblet instead. Keeping alias for transition if needed.
export type Holder = Bloblet

export type HolderMetaEntry = {
  balance: number | null
  name?: string | null
  addressCased?: string | null
  aliveUrl?: string | null
  deadUrl?: string | null
}

export interface WorldProp {
  id: number
  type: string
  image_url: string
  anchor_x: number | null
  anchor_y: number | null
  z: number | null
  scale: number | null
  expires_at: string | null
  name?: string | null
  last_owner?: string | null
}

export interface Frame {
  canvas: HTMLCanvasElement
  w: number
  h: number
  scale: number
}

export interface Slot {
  x: number
  y: number
  tier: number
  r: number
}

export type SpriteMode = 'entry' | 'glide' | 'idle'

export interface Sprite {
  address: string
  tier: number
  alive: boolean
  tx: number
  ty: number
  r: number
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  alpha: number
  scaleBump: number
  phase: number
  speed: number
  bobAmp: number
  entryDelay: number
  mode: SpriteMode
  gStart?: number
  gDur?: number
  fromX?: number
  fromY?: number
  fromScale?: number
  name?: string
  socialHandle?: string
  sizeMultiplier?: number
  aliveKey?: string
  deadKey?: string
  highlightScale?: number
  entityType?: 'landmark' | 'bloblet'
  landmarkId?: number | null
  landmarkType?: string | null
  landmarkName?: string | null
  renameCount?: number
  ownerAddress?: string | null
  ownerAddressCased?: string | null
  landmarkPrice?: number | null
}
