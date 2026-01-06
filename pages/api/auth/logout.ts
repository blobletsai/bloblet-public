import type { NextApiRequest, NextApiResponse } from 'next'
import { clearSessionCookie, resolveSessionCookieDomain } from '@/src/server/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : undefined
    const cookieDomain = resolveSessionCookieDomain(hostHeader)
    clearSessionCookie(res, { domain: cookieDomain })
    return res.status(200).json({ ok: true })
  } catch (e: any) {
    // Always clear the cookie even on unexpected errors
    try {
      const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : undefined
      const cookieDomain = resolveSessionCookieDomain(hostHeader)
      clearSessionCookie(res, { domain: cookieDomain })
    } catch {}
    return res.status(200).json({ ok: true })
  }
}
