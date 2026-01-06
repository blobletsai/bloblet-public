// Simple test endpoint for formations that works without Supabase
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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