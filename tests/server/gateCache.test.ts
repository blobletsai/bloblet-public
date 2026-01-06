import { describe, expect, it, beforeEach, afterEach } from 'vitest'

import { __setGateCacheTtlMsForTests } from '@/src/config/chains'
import { economyConfig } from '@/src/config/economy'
import { getCachedGateBalance, refreshGateBalance } from '@/src/server/chains/gateCache'

const SOL_CHAIN = 'sol'
const HOLDER_ADDRESS = '6Ukvh9UpAJZmomrZnauD1ynjUTduVdJN9WewtG6P5e8o'
const STALE_ADDRESS = '9XQe1VJtD9ZQv8dGgxShypHbKyjtZHeme7a7WZnPRm1J'
const NEW_ADDRESS = '7sYpDB6fPA7G7WWdD9n1VWeNseyX2VVaodui6w7dPfnk'

type TableMap = Record<string, any[]>

type SupabaseStub = {
  client: {
    from(table: string): any
  }
  tables: TableMap
}

function createSupabaseStub(initial?: Partial<TableMap>): SupabaseStub {
  const tables: TableMap = {
    token_holders: [],
    bloblets: [],
    ...(initial ?? {}),
  }
  class TableQuery {
    private filters: { column: string; value: any }[] = []
    constructor(private table: string) {}
    select() {
      return this
    }
    eq(column: string, value: any) {
      this.filters.push({ column, value })
      return this
    }
    async maybeSingle() {
      const rows = tables[this.table] || []
      const match = rows.find((row) =>
        this.filters.every(({ column, value }) => {
          if (!(column in row)) return false
          return row[column] === value
        }),
      )
      return { data: match ?? null, error: null }
    }
    async upsert(payload: any) {
      const rows = tables[this.table]
      const entries = Array.isArray(payload) ? payload : [payload]
      for (const entry of entries) {
        const key = entry.address_canonical ?? entry.address
        const chain = entry.chain_kind ?? SOL_CHAIN
        const idx = rows.findIndex(
          (row) => (row.address_canonical ?? row.address) === key && (row.chain_kind ?? SOL_CHAIN) === chain,
        )
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...entry }
        } else {
          rows.push({ ...entry })
        }
      }
      return { data: entries, error: null }
    }
  }
  return {
    tables,
    client: {
      from(table: string) {
        if (!tables[table]) tables[table] = []
        return new TableQuery(table)
      },
    },
  }
}

describe('gateCache helpers', () => {
  const originalGateMin = economyConfig.gate.minTokens

  beforeEach(() => {
    __setGateCacheTtlMsForTests(3_600_000)
    economyConfig.gate.minTokens = 1
  })

  afterEach(() => {
    __setGateCacheTtlMsForTests(null)
    economyConfig.gate.minTokens = originalGateMin
  })

  it('returns fresh cache snapshots when Supabase has a recent row', async () => {
    const updatedAt = new Date().toISOString()
    const supa = createSupabaseStub({
      token_holders: [
        {
          address: HOLDER_ADDRESS,
          address_canonical: HOLDER_ADDRESS,
          chain_kind: SOL_CHAIN,
          balance: '5000000',
          updated_at: updatedAt,
        },
      ],
    })
    const snapshot = await getCachedGateBalance(HOLDER_ADDRESS, { client: supa.client })
    expect(snapshot).toBeTruthy()
    expect(snapshot?.stale).toBe(false)
    expect(snapshot?.tokenBalance).toBeGreaterThan(0)
    expect(snapshot?.isHolder).toBe(true)
  })

  it('marks cache snapshots as stale when TTL expires', async () => {
    __setGateCacheTtlMsForTests(1000)
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const supa = createSupabaseStub({
      token_holders: [
        {
          address: STALE_ADDRESS,
          address_canonical: STALE_ADDRESS,
          chain_kind: SOL_CHAIN,
          balance: '0',
          updated_at: old,
        },
      ],
    })
    const snapshot = await getCachedGateBalance(STALE_ADDRESS, { client: supa.client })
    expect(snapshot).toBeTruthy()
    expect(snapshot?.stale).toBe(true)
    expect(snapshot?.isHolder).toBe(false)
  })

  it('refreshes the cache and writes token_holders + bloblets rows', async () => {
    const supa = createSupabaseStub()
    const refreshed = await refreshGateBalance(NEW_ADDRESS, {
      client: supa.client,
      balance: { raw: 5000000n, decimals: 6 },
    })
    expect(refreshed).not.toBeNull()
    expect(refreshed?.tokenBalance).toBeGreaterThan(0)
    expect(refreshed?.stale).toBe(false)
    const tokenRows = supa.tables.token_holders
    const blobRows = supa.tables.bloblets
    expect(tokenRows).toHaveLength(1)
    expect(blobRows).toHaveLength(1)
    expect(blobRows[0].is_alive).toBe(true)
    expect(tokenRows[0].balance).toBe('5000000')
  })
})
