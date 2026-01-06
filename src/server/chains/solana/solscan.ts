import { solanaTokenDecimals } from '@/src/shared/points'
import { solanaConfig } from '@/src/config/solana'

export type SolscanHolderItem = {
  address: string // token account (ATA)
  owner: string   // wallet address
  amount: number  // raw units
  decimals: number
  rank: number
}

const BASE = 'https://pro-api.solscan.io/v2.0'

function resolveDecimals(value: any, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.max(0, Math.floor(num))
}

function apiKey(): string {
  const k = solanaConfig.solscanApiKey
  if (!k) throw new Error('SOLSCAN_API_KEY missing')
  return k
}

function headers() {
  return { token: apiKey() }
}

export async function fetchSolanaTopHolders(mint: string, target = 2000): Promise<SolscanHolderItem[]> {
  const defaultDecimals = solanaTokenDecimals()
  const byOwner = new Map<string, { amount: number; decimals: number }>()
  let page = 1
  const pageSize = 40
  while (byOwner.size < target) {
    const url = new URL(`${BASE}/token/holders`)
    url.searchParams.set('address', mint)
    url.searchParams.set('page', String(page))
    url.searchParams.set('page_size', String(pageSize))
    const res = await fetch(url.toString(), { headers: headers() as any })
    if (!res.ok) throw new Error(`solscan holders ${res.status}`)
    const json: any = await res.json()
    const items: any[] = json?.data?.items || []
    if (!items.length) break
    for (const it of items) {
      const owner = String(it.owner || '')
      const amt = Number(it.amount || 0)
      const dec = resolveDecimals(it.decimals, defaultDecimals)
      if (!owner) continue
      const cur = byOwner.get(owner)
      if (cur) byOwner.set(owner, { amount: cur.amount + amt, decimals: dec })
      else byOwner.set(owner, { amount: amt, decimals: dec })
      if (byOwner.size >= target) break
    }
    page++
  }
  const arr = Array.from(byOwner.entries()).map(([owner, v]) => ({ owner, amount: v.amount, decimals: v.decimals }))
  arr.sort((a,b)=> (a.amount===b.amount?0:a.amount>b.amount?-1:1))
  const out: SolscanHolderItem[] = arr.map((r, i) => ({ owner: r.owner, amount: r.amount, decimals: r.decimals, address: '', rank: i+1 }))
  return out
}

export async function fetchOwnerTokenAccounts(owner: string): Promise<any[]> {
  const url = new URL(`${BASE}/account/token-accounts`)
  url.searchParams.set('address', owner)
  url.searchParams.set('type', 'token')
  url.searchParams.set('page', '1')
  url.searchParams.set('page_size', '40')
  const res = await fetch(url.toString(), { headers: headers() as any })
  if (!res.ok) throw new Error(`solscan token-accounts ${res.status}`)
  const json: any = await res.json()
  const items: any[] = json?.data || json?.result || json?.items || []
  return items
}

export async function getOwnerMintBalanceRaw(owner: string, mint: string): Promise<{ raw: bigint; decimals: number; ata: string | null }>{
  const defaultDecimals = solanaTokenDecimals()
  const items = await fetchOwnerTokenAccounts(owner)
  const filtered = items.filter(
    (it: any) => String(it?.token_address || it?.tokenAddress || it?.mint || '').trim() === String(mint).trim(),
  )
  let raw = 0n
  let decimals = defaultDecimals
  let ata: string | null = null
  for (const it of filtered) {
    const decCandidate = resolveDecimals(it?.token_decimals ?? it?.decimals, defaultDecimals)
    decimals = decCandidate
    let amtRaw: bigint = 0n
    if (it && typeof it.tokenAmount === 'object' && it.tokenAmount && typeof it.tokenAmount.amount !== 'undefined') {
      try { amtRaw = BigInt(String(it.tokenAmount.amount)) } catch { amtRaw = 0n }
    } else if (typeof it?.amount !== 'undefined') {
      const ui = Number(it.amount)
      if (Number.isFinite(ui) && ui >= 0) {
        const scale = BigInt(10) ** BigInt(decimals)
        amtRaw = BigInt(Math.floor(ui)) * scale
      }
    }
    raw += amtRaw
    if (!ata) ata = String(it?.token_account || it?.tokenAccount || '') || null
  }
  return { raw, decimals, ata }
}
