import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { appConfig } from '@/src/config/app'

const mocks = vi.hoisted(() => ({
  rewardLedgerEnabled: true,
  applyLedgerEntries: vi.fn(),
  roundPoints: vi.fn((value: number) => value),
  withPgClient: vi.fn(),
}))

vi.mock('@/src/server/rewards', () => ({
  get REWARD_LEDGER_ENABLED() {
    return mocks.rewardLedgerEnabled
  },
  applyLedgerEntries: mocks.applyLedgerEntries,
  roundPoints: mocks.roundPoints,
}))

vi.mock('@/src/server/pg', () => ({
  withPgClient: mocks.withPgClient,
}))

import {
  applyPropNameOrder,
  applyRenameOrder,
  applyRewardTopupOrder,
  confirmCareOrder,
  confirmGenericOrder,
  confirmUnsupportedBundle,
} from '@/src/server/orders/services/apply'

type QueryResponse = { data: any; error: any }

function createQueryBuilder(
  response: QueryResponse = { data: null, error: null },
  overrides: Partial<{
    onUpdate: (payload: any) => void
    onInsert: (payload: any) => void
    onUpsert: (payload: any, options?: any) => void
  }> = {},
) {
  const builder: any = {}
  builder.select = vi.fn(() => builder)
  builder.update = vi.fn((payload: any) => {
    overrides.onUpdate?.(payload)
    return builder
  })
  builder.insert = vi.fn(async (payload: any) => {
    overrides.onInsert?.(payload)
    return { data: null, error: null }
  })
  builder.upsert = vi.fn(async (payload: any, options?: any) => {
    overrides.onUpsert?.(payload, options)
    return { data: null, error: null }
  })
  builder.eq = vi.fn(() => builder)
  builder.neq = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(async () => response)
  builder.single = vi.fn(async () => response)
  builder.then = (resolve: any, reject?: any) => Promise.resolve(response).then(resolve, reject)
  builder.catch = (reject: any) => Promise.resolve(response).catch(reject)
  return builder
}

const ORIGINAL_CRON_SECRET = <CRON_SECRET>
const ORIGINAL_INTERNAL_API_BASE = appConfig.urls.internalApiBase

beforeEach(() => {
  mocks.rewardLedgerEnabled = true
  mocks.applyLedgerEntries.mockReset()
  mocks.roundPoints.mockReset().mockImplementation((value: number) => value)
  mocks.withPgClient.mockReset().mockImplementation(async (fn) => fn(createPgClient()))
  appConfig.secrets.cron = ''
  appConfig.urls.internalApiBase = ''
})

afterEach(() => {
  appConfig.secrets.cron = ORIGINAL_CRON_SECRET
  appConfig.urls.internalApiBase = ORIGINAL_INTERNAL_API_BASE
})

function createPgClient(rowCount = 1) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.startsWith('update public.orders')) {
        return { rowCount }
      }
      return {}
    }),
  }
}

describe('applyRenameOrder', () => {
  const baseArgs = {
    order: { params: { name: 'Bloblet' } },
    orderId: 11,
    txHash: '0xhash',
    addressCased: '0xAB',
    addressCanonical: '0xab',
    log: {
      orderId: 11,
      txHash: '0xhash',
      chainKind: 'sol',
      type: 'rename',
      internal: false,
    },
  }

  it('applies rename and updates order status', async () => {
    const tokenUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
    const blobletUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
    const orderBuilder = createQueryBuilder({ data: { id: 11 }, error: null })

    const supa: any = {
      from: (table: string) => {
        if (table === 'token_holders') return { upsert: tokenUpsert }
        if (table === 'bloblets') return { upsert: blobletUpsert }
        if (table === 'orders') return orderBuilder
        throw new Error(`Unexpected table ${table}`)
      },
    }

    const result = await applyRenameOrder({
      ...baseArgs,
      supa,
      chain: { metadata: { kind: 'sol' } } as any,
    })

    expect(result.statusCode).toBe(200)
    expect(tokenUpsert).toHaveBeenCalledTimes(1)
    expect(blobletUpsert).toHaveBeenCalledTimes(1)
    expect(orderBuilder.update).toHaveBeenCalled()
  })

  it('returns error when bloblet upsert fails', async () => {
    const supa: any = {
      from: (table: string) => {
        if (table === 'token_holders') return { upsert: vi.fn().mockResolvedValue({}) }
        if (table === 'bloblets') return { upsert: vi.fn().mockRejectedValue(new Error('fail')) }
        if (table === 'orders') return createQueryBuilder()
        throw new Error(`Unexpected table ${table}`)
      },
    }

    const result = await applyRenameOrder({
      ...baseArgs,
      supa,
      chain: { metadata: { kind: 'sol' } } as any,
    })

    expect(result.statusCode).toBe(500)
    expect(result.body).toEqual({ error: 'apply rename failed' })
  })
})

describe('applyPropNameOrder', () => {
  const baseArgs = {
    order: { params: { propId: 5, name: 'New Name', renameCount: 2 }, quote_amount: 10 },
    orderId: 5,
    txHash: '0xabc',
    addressCased: '0xAB',
    log: {
      orderId: 5,
      txHash: '0xabc',
      chainKind: 'sol',
      type: 'prop_name',
      internal: false,
    },
  }

  it('returns price_changed when rename count mismatches', async () => {
    let blobletCall = 0
    const supa: any = {
      from: (table: string) => {
        if (table === 'bloblets') {
          blobletCall += 1
          if (blobletCall === 1) {
            return createQueryBuilder({ data: { rename_count: 0 }, error: null })
          }
        }
        if (table === 'orders') return createQueryBuilder()
        if (table === 'asset_name_history') return { insert: vi.fn().mockResolvedValue({}) }
        throw new Error(`Unexpected table ${table}`)
      },
    }

    const result = await applyPropNameOrder({
      ...baseArgs,
      supa,
    })

    expect(result.statusCode).toBe(409)
    expect(result.body).toEqual({ error: 'price_changed' })
  })

  it('updates landmark name and records history', async () => {
    let blobletCall = 0
    const historyInsert = vi.fn().mockResolvedValue({})
    const updatePayloads: any[] = []
    const supa: any = {
      from: (table: string) => {
        if (table === 'bloblets') {
          blobletCall += 1
          if (blobletCall === 1) {
            return createQueryBuilder({ data: { rename_count: 2 }, error: null })
          }
          return createQueryBuilder(
            { data: { prop_id: 5 }, error: null },
            { onUpdate: (payload) => updatePayloads.push(payload) },
          )
        }
        if (table === 'asset_name_history') {
          return { insert: historyInsert }
        }
        if (table === 'orders') return createQueryBuilder({ data: { id: 5 }, error: null })
        throw new Error(`Unexpected table ${table}`)
      },
    }

    const result = await applyPropNameOrder({
      ...baseArgs,
      supa,
    })

    expect(result.statusCode).toBe(200)
    expect(updatePayloads[0]).toMatchObject({ name: 'New Name' })
    expect(historyInsert).toHaveBeenCalledTimes(1)
  })
})

describe('applyRewardTopupOrder', () => {
  const baseArgs = {
    order: { quote_amount: 12 },
    orderId: 8,
    txHash: '0xreward',
    addressCased: '0xAB',
    addressCanonical: '0xab',
    log: {
      orderId: 8,
      txHash: '0xreward',
      chainKind: 'sol',
      type: 'reward_topup',
      internal: false,
    },
  }

  it('returns error when reward ledger disabled', async () => {
    mocks.rewardLedgerEnabled = false

    const result = await applyRewardTopupOrder({
      ...baseArgs,
      supa: {} as any,
      chain: { metadata: { kind: 'sol' } } as any,
    })

    expect(result.statusCode).toBe(503)
    expect(result.body).toEqual({ error: 'reward_ledger_disabled' })
  })

  it('applies ledger credit and updates order', async () => {
    mocks.rewardLedgerEnabled = true
    mocks.applyLedgerEntries.mockResolvedValue(new Map([[baseArgs.addressCanonical, 25]]))

    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith('update public.orders')) {
          return { rowCount: 1 }
        }
        return {}
      }),
    }
    mocks.withPgClient.mockImplementation(async (fn) => fn(client))

    const result = await applyRewardTopupOrder({
      ...baseArgs,
      supa: {} as any,
      chain: { metadata: { kind: 'sol' } } as any,
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.pointsCredited).toBe(12)
    expect(result.body.balanceAfter).toBe(25)
    expect(mocks.applyLedgerEntries).toHaveBeenCalledWith(
      client,
      expect.any(Array),
      expect.objectContaining({ updateTokenHolders: true }),
    )
  })

  it('returns conflict when order update does not modify rows', async () => {
    mocks.rewardLedgerEnabled = true
    mocks.applyLedgerEntries.mockResolvedValue(new Map())
    mocks.withPgClient.mockImplementation(async (fn) => fn(createPgClient(0)))

    const result = await applyRewardTopupOrder({
      ...baseArgs,
      supa: {} as any,
      chain: { metadata: { kind: 'sol' } } as any,
    })

    expect(result.statusCode).toBe(409)
    expect(result.body).toEqual({ error: 'order_conflict' })
  })
})

describe('confirmCareOrder', () => {
  const baseArgs = {
    order: { id: 3, status: 'pending' },
    orderId: 3,
    txHash: '0xcare',
    log: {
      orderId: 3,
      txHash: '0xcare',
      chainKind: 'sol',
      type: 'care',
      internal: false,
    },
  }

  it('confirms care order when still pending', async () => {
    const supa: any = {
      from: (table: string) => {
        if (table === 'orders') {
          return createQueryBuilder({ data: { id: 3 }, error: null })
        }
        throw new Error(`Unexpected table ${table}`)
      },
    }

    const result = await confirmCareOrder({
      ...baseArgs,
      supa,
    })

    expect(result.statusCode).toBe(200)
    expect(result.body.status).toBe('confirmed')
  })

  it('returns conflict when order already processed', async () => {
    const supa: any = {
      from: () => createQueryBuilder({ data: null, error: null }),
    }

    const result = await confirmCareOrder({
      ...baseArgs,
      supa,
    })

    expect(result.statusCode).toBe(409)
    expect(result.body).toEqual({ error: 'order_not_pending' })
  })
})

describe('confirmGenericOrder', () => {
  it('confirms order and triggers async apply', async () => {
    const updates: any[] = []
    const supa: any = {
      from: (table: string) => {
        if (table === 'orders') {
          return createQueryBuilder(
            { data: { id: 4 }, error: null },
            { onUpdate: (payload) => updates.push(payload) },
          )
        }
        throw new Error(`Unexpected table ${table}`)
      },
    }

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any)

    appConfig.secrets.cron = 'secret'
    appConfig.urls.internalApiBase = 'https://internal.example'

    const result = await confirmGenericOrder({
      supa,
      order: { id: 4 },
      orderId: 4,
      txHash: '0xgeneric',
      log: {
        orderId: 4,
        txHash: '0xgeneric',
        chainKind: 'sol',
        type: 'care',
        internal: false,
      },
    })

    expect(result.statusCode).toBe(200)
    expect(updates[0]).toMatchObject({ status: 'confirmed' })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://internal.example/api/orders/apply',
      expect.objectContaining({ method: 'POST' }),
    )

    fetchSpy.mockRestore()
  })
})

describe('confirmUnsupportedBundle', () => {
  it('returns 410 for legacy bundle path', async () => {
    const result = await confirmUnsupportedBundle({
      orderId: 1,
      txHash: '0xbundle',
      chainKind: 'sol',
      type: 'care_bundle',
      internal: false,
    })

    expect(result.statusCode).toBe(410)
    expect(result.body).toEqual({ error: 'bundle_not_supported' })
  })
})
