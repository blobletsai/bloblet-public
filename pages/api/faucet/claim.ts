import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { rateLimiter } from '@/src/server/rateLimit'
import { requestSandboxFaucetClaim } from '@/src/server/sandbox/faucetService'
import { resolveChainKind } from '@/src/server/chains'
import { getSolanaAddressContext } from '@/src/shared/address/solana'

function getClientIp(req: NextApiRequest): string | null {
  const header = (req.headers['x-forwarded-for'] as string) || ''
  if (header) {
    const parts = header.split(',')
    if (parts.length) return parts[0]?.trim() || null
  }
  const remote = (req.socket as any)?.remoteAddress || null
  return typeof remote === 'string' ? remote : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, any>

  try {
    const session = getSessionFromRequest(req)
    if (!session || !session.address) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const bodyAddress = typeof body?.address === 'string' ? body.address : null
    const clientContext = body?.clientContext && typeof body.clientContext === 'object' ? body.clientContext : null
    const targetAddressRaw = bodyAddress?.trim() || session.address
    const chainKind = resolveChainKind()
    let sessionAddressCanonical = session.address.trim()
    let targetAddress = targetAddressRaw.trim()
    if (chainKind === 'sol') {
      try {
        const sessionCtx = getSolanaAddressContext(session.address)
        sessionAddressCanonical = sessionCtx.canonical
        targetAddress = getSolanaAddressContext(targetAddressRaw).canonical
      } catch {
        return res.status(400).json({ error: 'invalid_address' })
      }
    }
    if (!sessionAddressCanonical || !targetAddress) {
      return res.status(400).json({ error: 'invalid_address' })
    }
    if (bodyAddress && targetAddress !== sessionAddressCanonical) {
      return res.status(403).json({ error: 'address_mismatch' })
    }

    const ip = getClientIp(req)
    if (ip) {
      const ipLimit = await rateLimiter.limit(`faucet:ip:${ip}`)
      if (!ipLimit.success) {
        return res.status(429).json({ error: 'rate_limited' })
      }
    }

    const addrLimit = await rateLimiter.limit(`faucet:addr:${sessionAddressCanonical}`)
    if (!addrLimit.success) {
      return res.status(429).json({ error: 'rate_limited' })
    }

    const result = await requestSandboxFaucetClaim(targetAddress, {
      ip,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      country: typeof req.headers['x-vercel-ip-country'] === 'string' ? req.headers['x-vercel-ip-country'] : null,
      clientContext,
    })
    return res.status(200).json(result)
  } catch (err: any) {
    const message = err?.message || 'claim_failed'
    if (/invalid wallet address/i.test(message)) {
      return res.status(400).json({ error: 'invalid_address' })
    }
    console.error('[faucet/claim] failed', err)
    return res.status(500).json({ error: 'claim_failed' })
  }
}
