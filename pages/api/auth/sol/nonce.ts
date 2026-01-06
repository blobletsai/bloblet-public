import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { randomNonce } from '@/src/server/auth'
import { getChainAdapter } from '@/src/server/chains'

const ADDRESS_PLACEHOLDER = '<YOUR_ADDRESS>'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed')

  const nonce = randomNonce(16)
  const domain = appConfig.auth.domain || (req.headers.host as string) || ''
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const origin = `${proto}://${domain}`

  const cookie = [`blob_nonce=${nonce}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=300']
  if (appConfig.isProduction) cookie.push('Secure')
  res.setHeader('Set-Cookie', cookie.join('; '))

  const chain = getChainAdapter('sol')
  const message = chain.buildAuthMessage({ address: ADDRESS_PLACEHOLDER, domain, origin, nonce })
  res.status(200).json({ nonce, domain, origin, message })
}
