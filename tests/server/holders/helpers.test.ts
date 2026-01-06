import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchMoralisTopHolders } from '@/src/server/holders/moralis'
import {
  upsertTokenHolders,
  clearDropoutRanks,
  insertNewBloblets,
  updateBlobletAnchors,
  markBlobletsAlive,
  shameDropouts,
  logRefreshEvent,
  pruneExpiredDeadHolders,
} from '@/src/server/holders/supabase'

const originalFetch = global.fetch

describe('holders helpers', () => {
  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    }
    vi.restoreAllMocks()
  })

  it('fetchMoralisTopHolders dedupes owners and normalises balances', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        result: [
          { owner_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', balance: '10' },
          { owner_address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', balance: '5' },
          { owner_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', balance: 12 },
        ],
      }),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse as any)

    const holders = await fetchMoralisTopHolders({
      apiKey: 'test-key',
      tokenAddress: '0x1111111111111111111111111111111111111111',
      chain: 'bsc',
      limit: 10,
      pageSize: 100,
      tokenDecimals: 18,
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(holders).toEqual([
      expect.objectContaining({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', balanceRaw: 10n }),
      expect.objectContaining({ address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', balanceRaw: 12n }),
    ])
  })

  describe('supabase snapshot helpers', () => {
    function createTableMock() {
      const chain: any = {}
      chain.upsert = vi.fn().mockReturnValue(Promise.resolve({ error: null }))
      chain.update = vi.fn().mockReturnValue(chain)
      chain.delete = vi.fn().mockReturnValue(chain)
      chain.insert = vi.fn().mockReturnValue(chain)
      chain.select = vi.fn().mockReturnValue(Promise.resolve({ data: [] }))
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.in = vi.fn().mockReturnValue(chain)
      chain.order = vi.fn().mockReturnValue(chain)
      chain.limit = vi.fn().mockReturnValue(chain)
      chain.not = vi.fn().mockReturnValue(chain)
      chain.lte = vi.fn().mockReturnValue(chain)
      chain.lt = vi.fn().mockReturnValue(chain)
      chain.or = vi.fn().mockReturnValue(chain)
      return chain
    }

    function createSupabaseStub() {
      const tables = new Map<string, ReturnType<typeof createTableMock>>()
      return {
        from(table: string) {
          if (!tables.has(table)) {
            tables.set(table, createTableMock())
          }
          return tables.get(table)!
        },
        tables,
      }
    }

    const sampleRows = [
      {
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        address_canonical: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        address_cased: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
        chain_kind: 'sol',
        balance: '10',
        percent: 60,
        rank: 1,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      {
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        address_canonical: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        address_cased: '0xbBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        chain_kind: 'sol',
        balance: '5',
        percent: 40,
        rank: 2,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ]

    it('upserts only changed token_holders rows', async () => {
      const supa = createSupabaseStub()
      const existing = new Map([
        [
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          {
            address: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
            rank: 1,
            percent: 50,
            balance: '9',
          },
        ],
        [
          '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          {
            address: '0xbBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            rank: 2,
            percent: 40,
            balance: '5',
          },
        ],
      ])

      const changed = await upsertTokenHolders(supa as any, 'sol', sampleRows as any, existing as any)
      const upsertCalls = supa.tables.get('token_holders')!.upsert.mock.calls
      expect(changed).toBe(1)
      expect(upsertCalls).toHaveLength(1)
      expect(upsertCalls[0][0]).toEqual([
        expect.objectContaining({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', percent: 60 }),
      ])
    })

    it('chunks dropout rank clears', async () => {
      const supa = createSupabaseStub()
      const dropouts = Array.from({ length: 450 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`)
      await clearDropoutRanks(supa as any, 'sol', dropouts)
      const updateCalls = supa.tables.get('token_holders')!.update.mock.calls
      expect(updateCalls).toHaveLength(3)
      expect(updateCalls[0][0]).toEqual({ rank: null, percent: 0 })
    })

    it('inserts new bloblets with appearance and variant defaults', async () => {
      const supa = createSupabaseStub()
      const existingBloblets = new Map<string, { anchor_x: number | null; anchor_y: number | null; tier: string | null; is_custom?: boolean }>()
      const newAddresses = ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']
      const layoutMap = new Map([
        ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { tier: 'top' as const, anchorX: 10, anchorY: 20 }],
        ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', { tier: 'middle' as const, anchorX: 30, anchorY: 40 }],
      ])
      const rowLookup = new Map(sampleRows.map((row) => [row.address_canonical!, row]))
      const variants = [
        { id: 1, alive_url: 'alive.png', dead_url: 'dead.png', alive_url_256: 'alive-256.png', dead_url_256: null, is_custom: false },
      ]

      await insertNewBloblets(supa as any, {
        chainKind: 'sol',
        newAddresses,
        layoutMap,
        rowLookup,
        variants,
        existingBloblets,
        pickAppearance: () => ({ id: 99, url: 'appearance.png' }),
        getDefaultSpriteUrl: () => 'default.png',
        birthOnly: false,
      })

      const blobletsCalls = supa.tables.get('bloblets')!.upsert.mock.calls
      expect(blobletsCalls).toHaveLength(1)
      expect(blobletsCalls[0][0]).toHaveLength(2)
      expect(blobletsCalls[0][0][0]).toMatchObject({
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        address_canonical: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        appearance_id: 99,
        avatar_alive_url_256: 'alive-256.png',
      })
    })

    it('marks bloblets alive and shames dropouts', async () => {
      const supa = createSupabaseStub()
      const addresses = sampleRows.map((row) => row.address_canonical!)
      const rowLookup = new Map(sampleRows.map((row) => [row.address_canonical!, row]))
      await markBlobletsAlive(supa as any, 'sol', addresses, rowLookup)
      expect(supa.tables.get('bloblets')!.upsert).toHaveBeenCalled()

      supa.tables.get('bloblets')!.upsert.mockClear()
      const dropouts = ['0xcccccccccccccccccccccccccccccccccccccccc']
      await shameDropouts(supa as any, 'sol', addresses, dropouts)
      expect(supa.tables.get('shames')!.delete).toHaveBeenCalled()
      expect(supa.tables.get('shames')!.insert).toHaveBeenCalled()
      expect(supa.tables.get('bloblets')!.update).toHaveBeenCalled()
    })

    it('updates anchors when stored coordinates are invalid or zeroed', async () => {
      const supa = createSupabaseStub()
      const layoutMap = new Map([
        ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { tier: 'top' as const, anchorX: 50, anchorY: 60 }],
      ])
      const rowLookup = new Map(sampleRows.map((row) => [row.address_canonical!, row]))
      const existingBloblets = new Map<string, any>([
        [
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          { anchor_x: 0, anchor_y: null, tier: 'top', is_custom: false },
        ],
      ])
      await updateBlobletAnchors(supa as any, {
        chainKind: 'sol',
        layoutMap,
        rowLookup,
        existingBloblets,
      })
      const upsertCalls = supa.tables.get('bloblets')!.upsert.mock.calls
      expect(upsertCalls).toHaveLength(1)
      expect(upsertCalls[0][0][0]).toMatchObject({
        address_canonical: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        anchor_x: 50,
        anchor_y: 60,
      })
    })

    it('logs refresh summary without throwing', async () => {
      const supa = createSupabaseStub()
      await logRefreshEvent(supa as any, 5, 2)
      expect(supa.tables.get('events')!.insert).toHaveBeenCalled()
    })
    it('ignores custom sprite variants when assigning defaults', async () => {
      const supa = createSupabaseStub()
      const existingBloblets = new Map<string, { anchor_x: number | null; anchor_y: number | null; tier: string | null; is_custom?: boolean }>()
      const newAddresses = ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']
      const layoutMap = new Map([
        ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { tier: 'top' as const, anchorX: 10, anchorY: 20 }],
      ])
      const rowLookup = new Map(sampleRows.map((row) => [row.address_canonical!, row]))
      const variants = [
        { id: 1, alive_url: 'custom.png', alive_url_256: 'custom-256.png', is_custom: true },
        { id: 2, alive_url: 'default.png', alive_url_256: 'default-256.png', is_custom: false },
      ]

      await insertNewBloblets(supa as any, {
        chainKind: 'sol',
        newAddresses,
        layoutMap,
        rowLookup,
        variants,
        existingBloblets,
        pickAppearance: () => ({ id: 50, url: 'fallback.png' }),
        getDefaultSpriteUrl: () => 'shared-default.png',
        birthOnly: false,
      })

      const blobletsCalls = supa.tables.get('bloblets')!.upsert.mock.calls
      expect(blobletsCalls).toHaveLength(1)
      expect(blobletsCalls[0][0][0]).toMatchObject({
        assigned_variant_id: 2,
        avatar_alive_url_256: 'default-256.png',
      })
    })

    function createPruneSupabaseFixture() {
      const store: Record<string, any[]> = {
        bloblets: [
          { address_canonical: 'dead-1', chain_kind: 'sol', is_alive: false, last_seen_at: '2025-01-01T10:30:00.000Z' },
          { address_canonical: 'fresh-dead', chain_kind: 'sol', is_alive: false, last_seen_at: '2025-01-01T11:45:00.000Z' },
          { address_canonical: 'alive', chain_kind: 'sol', is_alive: true, last_seen_at: '2025-01-01T11:55:00.000Z' },
          {
            address_canonical: 'landmark_42',
            chain_kind: 'sol',
            is_alive: false,
            entity_type: 'landmark',
            last_seen_at: '2025-01-01T09:00:00.000Z',
          },
        ],
        token_holders: [
          { address: 'dead-1', address_canonical: 'dead-1', chain_kind: 'sol', updated_at: '2025-01-01T10:30:00.000Z' },
          { address: 'alive', address_canonical: 'alive', chain_kind: 'sol', updated_at: '2025-01-01T11:55:00.000Z' },
        ],
        shames: [
          { address_canonical: 'dead-1', chain_kind: 'sol', until: '2025-01-01T11:30:00.000Z' },
        ],
        reward_balances: [
          { address: 'dead-1', balance_raw: 125 },
          { address: 'alive', balance_raw: 0 },
        ],
      }
      return {
        tables: store,
        from(table: string) {
          if (!store[table]) store[table] = []
          return createQueryBuilder(table, store)
        },
      }
    }

    function createQueryBuilder(table: string, store: Record<string, any[]>) {
      const filters: ((row: any) => boolean)[] = []
      const orClauses: ((row: any) => boolean)[] = []
      let mode: 'select' | 'delete' = 'select'

      const evaluateExpression = (row: any, expr: string) => {
        const segments = expr.split('.').filter(Boolean)
        const column = segments[0]
        const operator = segments[1]
        const value = segments.slice(2).join('.')
        if (!column || !operator) return false
        if (operator === 'is' && value === 'null') {
          return row?.[column] == null
        }
        if (operator === 'eq') {
          return String(row?.[column]) === value
        }
        return false
      }

      const createOrMatcher = (clause: string) => {
        const subclauses = clause.split(',').map((part) => part.trim()).filter(Boolean)
        return (row: any) => subclauses.some((expr) => evaluateExpression(row, expr))
      }

      const matchesFilters = (row: any) => {
        const baseMatches = filters.every((fn) => fn(row))
        if (!baseMatches) return false
        if (!orClauses.length) return true
        return orClauses.every((fn) => fn(row))
      }

      return {
        eq(column: string, value: any) {
          filters.push((row) => row?.[column] === value)
          return this
        },
        lt(column: string, value: string) {
          const cutoff = Date.parse(value)
          filters.push((row) => Date.parse(row?.[column]) < cutoff)
          return this
        },
        or(clause: string) {
          orClauses.push(createOrMatcher(clause))
          return this
        },
        in(column: string, values: string[]) {
          const set = new Set(values.map((v) => String(v)))
          filters.push((row) => set.has(String(row?.[column])))
          return this
        },
        select(columns?: string, options?: { count?: string; head?: boolean }) {
          const rows = store[table].filter((row) => matchesFilters(row))
          if (options?.head) {
            return Promise.resolve({ data: null, count: rows.length })
          }
          if (mode === 'delete') {
            store[table] = store[table].filter((row) => !rows.includes(row))
            return Promise.resolve({ data: projectColumns(rows, columns) })
          }
          return Promise.resolve({ data: projectColumns(rows, columns) })
        },
        delete() {
          mode = 'delete'
          return this
        },
      }
    }

    function projectColumns(rows: any[], columns?: string) {
      if (!columns || columns === '*') {
        return rows.map((row) => ({ ...row }))
      }
      const selected = columns.split(',').map((part) => part.trim()).filter(Boolean)
      return rows.map((row) => {
        const obj: Record<string, any> = {}
        for (const col of selected) {
          obj[col] = row?.[col]
        }
        return obj
      })
    }

    it('prunes expired dead holders based on grace window', async () => {
      const supa = createPruneSupabaseFixture()
      const result = await pruneExpiredDeadHolders(supa as any, {
        chainKind: 'sol',
        graceMinutes: 60,
        nowIso: '2025-01-01T12:00:00.000Z',
        punishDeadWallets: true,
        treasuryAddress: 'treasury-wallet',
      })
      expect(result.addresses).toEqual(['dead-1'])
      expect(supa.tables.bloblets).toHaveLength(3)
      expect(supa.tables.token_holders).toHaveLength(1)
      expect(supa.tables.shames).toHaveLength(0)
      expect(supa.tables.bloblets.some((row) => row.address_canonical === 'landmark_42')).toBe(true)
      expect(result.penalizedWallets).toBe(1)
      expect(result.confiscatedTotalRaw).toBe(125)
    })

    it('supports dry-run pruning without mutating tables', async () => {
      const supa = createPruneSupabaseFixture()
      const result = await pruneExpiredDeadHolders(supa as any, {
        chainKind: 'sol',
        graceMinutes: 60,
        nowIso: '2025-01-01T12:00:00.000Z',
        dryRun: true,
        punishDeadWallets: true,
        treasuryAddress: 'treasury-wallet',
      })
      expect(result.addresses).toEqual(['dead-1'])
      expect(supa.tables.bloblets).toHaveLength(4)
      expect(result.tokenHoldersDeleted).toBe(1)
      expect(result.shamesDeleted).toBe(1)
      expect(result.addresses).not.toContain('landmark_42')
      expect(result.penalizedWallets).toBe(1)
      expect(result.confiscatedTotalRaw).toBe(125)
    })

    it('skips punishment metadata when disabled', async () => {
      const supa = createPruneSupabaseFixture()
      const result = await pruneExpiredDeadHolders(supa as any, {
        chainKind: 'sol',
        graceMinutes: 60,
        nowIso: '2025-01-01T12:00:00.000Z',
        punishDeadWallets: false,
        treasuryAddress: 'treasury-wallet',
      })
      expect(result.penalizedWallets).toBe(0)
      expect(result.confiscatedTotalRaw).toBe(0)
    })
  })
})
