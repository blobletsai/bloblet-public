/**
 * Economy, Ledger, and Treasury Types
 */

export type RewardLedgerReason =
  | 'balance_snapshot'
  | 'care_upkeep'
  | 'battle_win'
  | 'battle_loss'
  | 'treasury_cut'
  | 'swap_credit'
  | 'redeem_debit'
  | 'redeem_fee'
  | 'manual_adjustment'

export interface RewardLedgerEntry {
  id: number
  address: string
  reason: RewardLedgerReason
  delta: number
  balance_after: number | null
  battle_id?: number | null
  swap_id?: number | null
  metadata?: Record<string, any> | null
  created_at: string
}

export type TreasurySwapDirection = 'deposit' | 'withdraw'
export type TreasurySwapStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled'
export type TreasurySwapSource = 'user' | 'admin' | 'system'

export interface TreasurySwap {
  id: number
  address: string
  direction: TreasurySwapDirection
  status: TreasurySwapStatus
  source: TreasurySwapSource
  amount_points: number
  amount_tokens: number
  reference?: string | null
  tx_signature?: string | null
  tx_explorer_url?: string | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at?: string
  confirmed_at?: string | null
  failed_at?: string | null
  cancelled_at?: string | null
}
