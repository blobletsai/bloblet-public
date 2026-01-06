export type OrderType =
  | 'rename'
  | 'prop'
  | 'clip'
  | 'persona_upgrade'
  | 'avatar_custom'
  | 'care'
  | 'reward_topup'
  | 'care_bundle'
  | 'prop_name'

export type OrderStatus = string

export type Confirmations = {
  have: number
  need: number
}

export type OrderPhase =
  | 'awaiting_payment'
  | 'confirming_payment'
  | 'generating_preview'
  | 'preview_ready'
  | 'applying'
  | 'applied'
  | 'expired'
  | 'rejected'

export type OrderHistoryItem = {
  id: number
  status: OrderStatus
  type: OrderType | null
  quote: number | null
  signature: string | null
  reason: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type OrderState = {
  orderId: number | null
  quote: number | null
  status: OrderStatus
  reason: string | null
  signature: string | null
  previewAliveUrl: string | null
  confirmations: Confirmations | null
  type: OrderType | null
  careDrop: any
  createdAt: string | null
  appliedPoints: number | null
  appliedBalance: number | null
}

export const INITIAL_STATE: OrderState = {
  orderId: null,
  quote: null,
  status: '',
  reason: null,
  signature: null,
  previewAliveUrl: null,
  confirmations: null,
  type: null,
  careDrop: null,
  createdAt: null,
  appliedPoints: null,
  appliedBalance: null,
}

export const HISTORY_LIMIT = 6

export const TERMINAL_STATUSES = new Set(['applied', 'expired', 'rejected'])

export function normalizeStatus(status: string | null | undefined): string {
  return (status || '').toLowerCase()
}

export function isTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL_STATUSES.has(normalizeStatus(status))
}
