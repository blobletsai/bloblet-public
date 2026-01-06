export interface MoralisClientOptions {
  apiKey: string
  tokenAddress: string
  chain: string
  limit?: number
  pageSize?: number
  fetchImpl?: typeof fetch
  tokenDecimals?: number
}

export interface MoralisHolderSnapshot {
  address: string
  balanceRaw: bigint
  balanceDecimals: number
}

const FNV_OFFSET = 2166136261 >>> 0

function normalizeAddress(value: string): string | null {
  const trimmed = (value || '').trim().toLowerCase()
  if (/^0x[0-9a-f]{40}$/.test(trimmed)) return trimmed
  return null
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.floor(value))
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 0n
    try {
      return BigInt(trimmed)
    } catch {
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric)) return BigInt(Math.floor(numeric))
    }
  }
  return 0n
}

/**
 * Fetches the top ERC20 token holders from Moralis.
 *
 * This helper is environment agnostic (Node or Deno) and only relies on `fetch`.
 * Both the Next.js API route and the Supabase edge function call into this helper.
 */
export async function fetchMoralisTopHolders(options: MoralisClientOptions): Promise<MoralisHolderSnapshot[]> {
  const {
    apiKey,
    tokenAddress,
    chain,
    limit = 2000,
    pageSize = 100,
    fetchImpl = fetch,
    tokenDecimals = 18,
  } = options
  if (!apiKey) throw new Error('Moralis API key is required')
  if (!tokenAddress) throw new Error('Token address is required for Moralis fetch')
  const want = Math.max(1, Math.min(Number(limit) || 2000, 2000))
  const collected = new Map<string, bigint>()
  const seenCursors = new Set<string>()
  let cursor: string | null = null
  while (collected.size < want) {
    const url = new URL(`https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/owners`)
    url.searchParams.set('limit', String(Math.max(1, Math.min(pageSize, 200))))
    if (chain) url.searchParams.set('chain', chain)
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetchImpl(url.toString(), {
      headers: {
        'X-API-Key': apiKey,
        accept: 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Moralis owners endpoint ${res.status}: ${text}`)
    }
    let body: any = null
    try {
      body = await res.json()
    } catch (err) {
      throw new Error(`Failed to parse Moralis response: ${String((err as Error)?.message || err)}`)
    }
    const items = Array.isArray(body?.result)
      ? body.result
      : Array.isArray(body?.items)
        ? body.items
        : []
    for (const raw of items as any[]) {
      const normalized = normalizeAddress(raw?.address ?? raw?.owner_address ?? '')
      if (!normalized || collected.has(normalized)) continue
      const balance = toBigInt(raw?.balance ?? raw?.balance_formatted ?? '0')
      collected.set(normalized, balance)
    }
    if (!items.length) break
    const nextCursor = String(body?.cursor || body?.next_cursor || '').trim()
    if (!nextCursor || seenCursors.has(nextCursor)) break
    seenCursors.add(nextCursor)
    cursor = nextCursor
  }
  return Array.from(collected.entries())
    .slice(0, want)
    .map(([address, balanceRaw]) => ({
      address,
      balanceRaw,
      balanceDecimals: tokenDecimals,
    }))
}

/**
 * Small deterministic hash util exported for consumers that need to stable-slot addresses.
 * Kept here because both Node and Deno callers previously inlined the same implementation.
 */
export function hashAddress32(value: string): number {
  let hash = FNV_OFFSET
  const lower = (value || '').toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    hash ^= lower.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
