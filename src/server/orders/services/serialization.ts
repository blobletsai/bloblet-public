import type { SerializedOrder } from '@/src/server/orders/types'

export function serializeOrder(
  row: any | null,
  overrides: Partial<SerializedOrder> = {},
): SerializedOrder | null {
  if (!row) return null
  const status = overrides.status || String(row.status || 'pending')
  return {
    id: Number(row.id),
    type: row.type != null ? String(row.type) : null,
    status,
    quoteAmount: overrides.quoteAmount ?? Number(row.quote_amount ?? 0),
    expiresAt: overrides.expiresAt ?? (row.expires_at ? String(row.expires_at) : null),
    confirmedAt: overrides.confirmedAt ?? (row.confirmed_at ? String(row.confirmed_at) : null),
    appliedAt: overrides.appliedAt ?? (row.applied_at ? String(row.applied_at) : null),
    txHash: overrides.txHash ?? (row.tx_hash ? String(row.tx_hash) : null),
  }
}
