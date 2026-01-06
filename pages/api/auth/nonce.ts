import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { randomNonce, resolveSessionCookieDomain } from '@/src/server/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed')
  const nonce = randomNonce(16)
  const domain = appConfig.auth.domain || (req.headers.host as string) || ''
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const origin = `${proto}://${domain}`
  // Store nonce in a short-lived cookie for verification
  const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : undefined
  const cookieDomain = resolveSessionCookieDomain(hostHeader)
  const cookie = [`blob_nonce=${nonce}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=300']
  if (cookieDomain) cookie.push(`Domain=${cookieDomain}`)
  if (appConfig.isProduction) cookie.push('Secure')
  res.setHeader('Set-Cookie', cookie.join('; '))
  const message = [
    `Sign in to Bloblets`,
    '',
    `Domain: ${domain}`,
    `Address: <YOUR_ADDRESS>`,
    `Nonce: ${nonce}`,
  ].join('\n')
  res.status(200).json({ nonce, domain, origin, message })
}
