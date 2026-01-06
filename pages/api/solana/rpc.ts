import type { NextApiRequest, NextApiResponse } from 'next'

import { solanaConfig } from '@/src/config/solana'

const ALLOW = new Set([
  'getLatestBlockhash',
  'getSignatureStatuses',
  'sendTransaction',
  'getMinimumBalanceForRentExemption',
  'getAccountInfo',
])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    const upstream = solanaConfig.rpcUrl
    if (!upstream) return res.status(500).json({ error: 'rpc_not_configured' })
    const body = req.body || {}
    // Basic shape validation
    const method = String(body?.method || '')
    if (!method || !ALLOW.has(method)) return res.status(400).json({ error: 'method_not_allowed' })
    const resp = await fetch(upstream, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const txt = await resp.text()
    res.status(resp.status).setHeader('content-type', 'application/json').send(txt)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'rpc failed' })
  }
}
