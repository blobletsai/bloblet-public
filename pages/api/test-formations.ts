// Simple test endpoint for formations that works without Supabase
import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const internalSecret = appConfig.secrets.internalApi || appConfig.secrets.cron
  if (!internalSecret && process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' })
  }
  if (internalSecret) {
    const hdr =
      (req.headers['x-internal-auth'] as string) ||
      (req.headers['x-internal-secret'] as string) ||
      ''
    if (hdr !== internalSecret) return res.status(403).json({ error: 'forbidden' })
  }

  // Allow both GET and POST for easy testing
  
  const scene = req.query.scene || req.body?.scene || 'welcome'
  
  // Simple mock response
  const mockResponses: Record<string, any> = {
    welcome: {
      success: true,
      message: 'Welcome scene would be triggered',
      scene: 'welcome',
      note: 'Open canvas at zoom >= 0.6 to see effects'
    },
    graveyard: {
      success: true,
      message: 'Graveyard scene would be triggered',
      scene: 'graveyard',
      note: 'Dead sprites form tombstone grid'
    },
    trophy: {
      success: true,
      message: 'Trophy scene would be triggered',
      scene: 'trophy',
      note: 'Top buyers form trophy shape'
    }
  }
  
  return res.status(200).json(mockResponses[scene as string] || {
    success: false,
    message: 'Unknown scene',
    availableScenes: ['welcome', 'graveyard', 'trophy']
  })
}
