// Simple scene trigger endpoint - returns counts for canvas to resolve
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { kind } = req.body

  // Validate scene kind
  if (!kind || !['welcome', 'graveyard', 'trophy'].includes(kind)) {
    return res.status(400).json({ error: 'Invalid scene kind' })
  }

  // Build payload with counts instead of mock addresses
  let payload: any = { kind }

  switch (kind) {
    case 'welcome':
      // Request 5-10 sprites for welcome message
      payload.count = 8
      break

    case 'graveyard':
      // Request 4-8 sprites for graveyard
      payload.count = 6
      break

    case 'trophy':
      // Request top 3-5 sprites for trophy scene
      payload.topCount = 5
      break
  }

  // Return the scene data for client-side handling
  return res.status(200).json({
    success: true,
    scene: payload,
    message: `${kind} scene data ready for client-side processing`
  })
}