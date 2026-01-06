import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
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

    const { count = 1, buyAmount = 10 } = req.query
    const numHeroes = Math.min(parseInt(count as string) || 1, 10)
    
    console.log(`[Hero Buy Test] Simulating ${numHeroes} hero buy events with ${buyAmount}% increase`)
    
    const supa = supaAdmin()
    
    // Get random alive sprites to make them heroes
    const { data: candidates, error: fetchError } = await supa
      .from('bloblets')
      .select('address, is_alive')
      .eq('is_alive', true)
      .limit(numHeroes * 2)
    
    if (fetchError || !candidates?.length) {
      return res.status(500).json({ error: 'Failed to fetch candidates' })
    }
    
    // Randomly select heroes
    const heroes = candidates
      .sort(() => Math.random() - 0.5)
      .slice(0, numHeroes)
    
    const results = []
    
    for (const hero of heroes) {
      // Update the hero with a special marker (we'll use tier temporarily)
      const { error: updateError } = await supa
        .from('bloblets')
        .update({ 
          tier: 'top', // Mark as top tier to indicate hero
          last_seen_at: new Date().toISOString()
        })
        .eq('address', hero.address)
      
      results.push({
        address: hero.address,
        buyAmount: parseInt(buyAmount as string),
        success: !updateError,
        error: updateError?.message
      })
      
      if (!updateError) {
        console.log(`[Hero Buy] Marked ${hero.address} as hero with +${buyAmount}%`)
      }
    }
    
    return res.status(200).json({
      message: 'Hero buy events simulated',
      heroes: numHeroes,
      buyAmount: parseInt(buyAmount as string),
      results
    })
    
  } catch (error: any) {
    console.error('[Hero Buy Test] Error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
