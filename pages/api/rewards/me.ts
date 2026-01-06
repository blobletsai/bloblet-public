import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { getRewardSnapshot, REWARD_LEDGER_ENABLED } from '@/src/server/rewards'
import { getSolanaAddressContext } from '@/src/shared/address/solana'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    if (!REWARD_LEDGER_ENABLED) {
      return res.status(503).json({ error: 'ledger_disabled' })
    }

    const session = getSessionFromRequest(req)
    if (!session || !session.address) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    let address: string
    try {
      address = getSolanaAddressContext(session.address).canonical
    } catch {
      return res.status(400).json({ error: 'invalid_address' })
    }

    const snapshot = await getRewardSnapshot(address)

    return res.status(200).json(snapshot)
  } catch (err: any) {
    console.error('[rewards/me] failed', err)
    return res.status(500).json({ error: 'internal_error' })
  }
}
