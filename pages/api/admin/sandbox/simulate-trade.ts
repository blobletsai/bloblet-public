import type { NextApiRequest, NextApiResponse } from 'next'

import { adminConfig } from '@/src/config/admin'
import { simulateSandboxTrade } from '@/src/server/sandbox/tradeSimulator'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const secret = (adminConfig.secrets.cron || '').trim()
  if (secret) {
    const hdr =
      (req.headers['x-internal-auth'] as string) ||
      (req.headers['x-internal-secret'] as string) ||
      ''
    if (hdr !== secret) {
      return res.status(403).json({ error: 'forbidden' })
    }
  }

  try {
    const result = await simulateSandboxTrade({
      creditAmount: req.body?.creditAmount ? Number(req.body.creditAmount) : undefined,
      redeemAmount: req.body?.redeemAmount ? Number(req.body.redeemAmount) : undefined,
      minBalanceAfterRedeem: req.body?.reserveAmount ? Number(req.body.reserveAmount) : undefined,
    })
    return res.status(200).json({ ok: true, result })
  } catch (err: any) {
    console.error('[sandbox/simulate-trade] failed', err)
    return res.status(500).json({ error: err?.message || 'trade_sim_failed' })
  }
}
