export type PersonaFocusBlobletPayload = {
  address: string
  addressCanonical: string
  name: string | null
  worldX?: number
  worldY?: number
}

export type PersonaFocusLandmarkPayload = {
  propId: number | null
  propType: string | null
  name: string | null
  renameCount: number
  ownerAddress: string | null
  ownerAddressCased: string | null
  address?: string | null
  addressCanonical?: string | null
  worldX?: number
  worldY?: number
  radius?: number
  lastPrice?: number | null
}

export type PersonaPricingPayload = {
  base?: number | null
  step?: number | null
  premiumPct?: number | null
}

export type BattleAlertType = 'energize_required' | 'balance_insufficient' | 'stake_warning' | 'generic'
export type BattleAlertPhase = 'show' | 'dismiss' | 'action'

export type BattleAlertPayload = {
  phase: BattleAlertPhase
  type: BattleAlertType
  opponent: string | null
  id: string
}

export type StakeDebugPayload = {
  address: string
  balance: number | null
  minStake: number | null
  stakeReady: boolean
  balanceKnown: boolean
  timestamp?: number | null
}

export type FaucetEventPayload = {
  address: string
  faucetClaimStatus?: 'fulfilled' | 'already_claimed' | string | null
  blobletLoaded?: boolean
  emittedAt?: number
}

export type PlayerStatusRefreshedPayload = {
  reason?: string | null
  at?: number | null
}

export type ClientEventMap = {
  'persona:focus-bloblet': PersonaFocusBlobletPayload
  'persona:focus-landmark': PersonaFocusLandmarkPayload
  'persona:close': Record<string, never>
  'persona:open-topup': Record<string, never>
  'persona:landmark-pricing': PersonaPricingPayload
  'blob:order_applied': { type?: string | null; propId?: number | null; orderId?: number | null }
  'blob:order_preview': { alive?: string | null }
  'blob:verified': { address?: string | null; isHolder?: boolean | null }
  'blob:logout': Record<string, never>
  'blob:session-expired': { reason?: string | null }
  'blob:session-valid': { address?: string | null; expiresAt?: string | null }
  'blob:energize_applied': { action?: string | null }
  'blob:battle_alert': BattleAlertPayload
  'blob:faucet': FaucetEventPayload
  'blob:sprites_updated': Record<string, never>
  'blob:player_status_refreshed': PlayerStatusRefreshedPayload
  'blob:stake_debug': StakeDebugPayload
  'blob:canvas_ready': Record<string, never>
}

export type ClientEventName = keyof ClientEventMap

export const CLIENT_EVENT = {
  PERSONA_FOCUS_BLOBLET: 'persona:focus-bloblet',
  PERSONA_FOCUS_LANDMARK: 'persona:focus-landmark',
  PERSONA_CLOSE: 'persona:close',
  PERSONA_OPEN_TOPUP: 'persona:open-topup',
  PERSONA_PRICING: 'persona:landmark-pricing',
  ORDER_APPLIED: 'blob:order_applied',
  ORDER_PREVIEW: 'blob:order_preview',
  VERIFIED: 'blob:verified',
  LOGOUT: 'blob:logout',
  SESSION_EXPIRED: 'blob:session-expired',
  SESSION_VALID: 'blob:session-valid',
  ENERGIZE_APPLIED: 'blob:energize_applied',
  BATTLE_ALERT: 'blob:battle_alert',
  FAUCET: 'blob:faucet',
  SPRITES_UPDATED: 'blob:sprites_updated',
  PLAYER_STATUS_REFRESHED: 'blob:player_status_refreshed',
  STAKE_DEBUG: 'blob:stake_debug',
  CANVAS_READY: 'blob:canvas_ready',
} as const

export type KnownClientEventValue = typeof CLIENT_EVENT[keyof typeof CLIENT_EVENT]

export type ClientEventPayload<Name extends string = ClientEventName> =
  Name extends keyof ClientEventMap ? ClientEventMap[Name] : Record<string, any>
