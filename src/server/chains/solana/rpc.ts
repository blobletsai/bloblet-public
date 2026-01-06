import { solanaTokenDecimals } from '@/src/shared/points'
import { solanaConfig } from '@/src/config/solana'

const DEFAULT_TIMEOUT_MS = 10_000

function rpcUrl(): string {
  const url = solanaConfig.rpcUrl
  if (!url) throw new Error('SOLANA_RPC_URL missing')
  return url
}

async function fetchWithTimeout(input: string, init: any = {}, ms = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const resp = await fetch(input, { ...(init || {}), signal: ctl.signal } as any)
    return resp as unknown as Response
  } finally {
    clearTimeout(t)
  }
}

export async function rpcCall(method: string, params: any[]): Promise<any> {
  const url = rpcUrl()
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  const resp = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  if (!resp.ok) throw new Error(`rpc ${method} ${resp.status}`)
  const json = await resp.json().catch(() => null)
  if (!json || json.error) throw new Error(`rpc ${method} error`)
  return json.result
}

export async function getParsedTokenAccountsByOwner(owner: string, mint: string): Promise<any[]> {
  const result = await rpcCall('getParsedTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed' }])
  const value = Array.isArray(result?.value) ? result.value : []
  return value
}

async function getTokenAccountsByOwner(owner: string, mint: string): Promise<string[]> {
  const result = await rpcCall('getTokenAccountsByOwner', [owner, { mint }, { encoding: 'base64' }])
  const value = Array.isArray(result?.value) ? result.value : []
  const accounts: string[] = []
  for (const it of value) {
    const pubkey = String(it?.pubkey || '')
    if (pubkey) accounts.push(pubkey)
  }
  return accounts
}

async function getTokenAccountBalance(ata: string): Promise<{ amountRaw: bigint; decimals: number } | null> {
  const result = await rpcCall('getTokenAccountBalance', [ata])
  const amountStr = String(result?.value?.amount ?? '0')
  let amountRaw = 0n
  try { amountRaw = BigInt(amountStr) } catch { amountRaw = 0n }
  const decimals = Number.isFinite(result?.value?.decimals)
    ? Math.max(0, Math.floor(Number(result.value.decimals)))
    : solanaTokenDecimals()
  return { amountRaw, decimals }
}

export async function getOwnerMintBalanceRaw(
  owner: string,
  mint: string,
): Promise<{ raw: bigint; decimals: number; ata: string | null }> {
  const defaultDecimals = solanaTokenDecimals()
  let decimals = defaultDecimals
  try {
    const accounts = await getParsedTokenAccountsByOwner(owner, mint)
    let raw = 0n
    let ata: string | null = null
    for (const it of accounts) {
      const pubkey = String(it?.pubkey || '')
      const parsed = it?.account?.data?.parsed?.info
      const tokenAmount = parsed?.tokenAmount
      const amountStr = String(tokenAmount?.amount ?? '0')
      let amt = 0n
      try { amt = BigInt(amountStr) } catch { amt = 0n }
      const decCandidate = Number(tokenAmount?.decimals)
      if (Number.isFinite(decCandidate) && decCandidate >= 0) {
        decimals = Math.max(0, Math.floor(decCandidate))
      }
      raw += amt
      if (!ata && pubkey) ata = pubkey
    }
    return { raw, decimals, ata }
  } catch (err) {
    // Fallback for providers that do not support getParsedTokenAccountsByOwner
    try {
      const atas = await getTokenAccountsByOwner(owner, mint)
      let raw = 0n
      let ata: string | null = null
      for (const a of atas) {
        const bal = await getTokenAccountBalance(a)
        if (bal) {
          raw += bal.amountRaw
          decimals = bal.decimals
          if (!ata) ata = a
        }
      }
      return { raw, decimals, ata }
    } catch (fallbackErr) {
      throw fallbackErr
    }
  }
}

export async function getSignatureStatuses(signature: string): Promise<{ confirmations: number | null; confirmationStatus: string | null }> {
  const result = await rpcCall('getSignatureStatuses', [[signature], { searchTransactionHistory: true } as any])
  const value = Array.isArray(result?.value) ? result.value[0] : null
  const confirmations = typeof value?.confirmations === 'number' ? value.confirmations : null
  const confirmationStatus = value?.confirmationStatus ? String(value.confirmationStatus) : null
  return { confirmations, confirmationStatus }
}

export async function getTransaction(signature: string): Promise<any | null> {
  // Try v0/1 compatibility
  const paramsList: any[] = [
    [signature, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }],
    [signature, { maxSupportedTransactionVersion: 1, encoding: 'jsonParsed' }],
    [signature, { encoding: 'jsonParsed' }],
  ]
  for (const params of paramsList) {
    try {
      const result = await rpcCall('getTransaction', params)
      if (result) return result
    } catch {
      // try next variant
    }
  }
  return null
}
