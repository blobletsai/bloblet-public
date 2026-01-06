import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChainAdapter } from '@/src/server/chains/types'

export interface ConfirmOrderParams {
  readonly supa: SupabaseClient
  readonly chainKind: string
  readonly chain: ChainAdapter
  readonly orderId: number
  readonly txHash: string
  readonly internal?: boolean
  readonly sessionAddressKey?: string | null
}

export interface ConfirmOrderResult {
  statusCode: number
  body: any
}

export type SerializedOrder = {
  id: number
  type: string | null
  status: string
  quoteAmount: number
  expiresAt: string | null
  confirmedAt: string | null
  appliedAt: string | null
  txHash: string | null
}

export type OrderLogContext = {
  orderId: number
  txHash: string
  chainKind: string
  type: string
  internal: boolean
}
