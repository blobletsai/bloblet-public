import type { NextApiRequest, NextApiResponse } from 'next'
import { assetConfig } from '@/src/config/assets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Server-side only - these URLs never exposed to client
    const aliveUrl = assetConfig.sprites.defaultAlive
    const deadUrl = assetConfig.sprites.defaultDead
    
    // Add security headers
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    
    // Return URLs securely from server
    return res.status(200).json({
      alive: aliveUrl,
      dead: deadUrl
    })
  } catch (error) {
    console.error('Sprite config error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
