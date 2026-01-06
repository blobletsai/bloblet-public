"use client"

export type OrderEventPayload = {
  id: number
  chainKind: string | null
  address: string | null
  type: string | null
  status: string | null
  quoteAmount: number | null
  txHash: string | null
  reason: string | null
  previewAliveUrl: string | null
  expiresAt: string | null
  confirmedAt: string | null
  appliedAt: string | null
  createdAt: string | null
  updatedAt: string
}

export type CareEventPayload = {
  address: string | null
  chainKind: string | null
  careState: any
  updatedAt: string
}

export type LedgerEventPayload = {
  id: number
  address: string | null
  reason: string | null
  deltaRaw: number | null
  delta: number | null
  balanceAfterRaw: number | null
  balanceAfter: number | null
  metadata: any
  createdAt: string | null
  decimals: number
}

export type BattleEventPayload = {
  id: number
  attacker: string | null
  defender: string | null
  attackerBooster: number | null
  defenderBooster: number | null
  attackerBase: number | null
  defenderBase: number | null
  attackerTotal: number | null
  defenderTotal: number | null
  winner: string | null
  critical: boolean
  transferPoints: number | null
  housePoints: number | null
  loot: any
  createdAt: string | null
}

export type LoadoutEventPayload = {
  address: string | null
  weaponItemId: number | null
  shieldItemId: number | null
  updatedAt: string | null
}

export type GameplayEvent =
  | { topic: 'order'; payload: OrderEventPayload; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }
  | { topic: 'care'; payload: CareEventPayload; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }
  | { topic: 'ledger'; payload: LedgerEventPayload; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }
  | { topic: 'battle'; payload: BattleEventPayload; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }
  | { topic: 'loadout'; payload: LoadoutEventPayload; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }

export type GameplayState = {
  connection: 'idle' | 'connecting' | 'open' | 'retrying' | 'error' | 'offline'
  orders: Map<number, OrderEventPayload>
  ordersByAddress: Map<string, OrderEventPayload>
  careByAddress: Map<string, CareEventPayload>
  rewardsByAddress: Map<string, LedgerEventPayload>
  battles: Map<number, BattleEventPayload>
  loadouts: Map<string, LoadoutEventPayload>
  lastEvent: GameplayEvent | null
}
