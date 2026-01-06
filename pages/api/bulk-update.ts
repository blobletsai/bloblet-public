import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { appConfig } from '@/src/config/app'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url: supabaseUrl, serviceKey: supabaseServiceKey } = appConfig.supabase

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const count = parseInt(req.query.count as string) || 100

  try {
    // Get random sprites to toggle
    const { data: sprites, error: fetchError } = await supabase
      .from('bloblets')
      .select('address, is_alive')
      .order('random()', { nullsFirst: false })
      .limit(count)

    if (fetchError) throw fetchError

    // Toggle them all at once
    const addresses = sprites.map(s => s.address)
    const aliveAddresses = sprites.filter(s => s.is_alive).map(s => s.address)
    const deadAddresses = sprites.filter(s => !s.is_alive).map(s => s.address)

    // Update alive ones to dead
    let updatedCount = 0
    if (aliveAddresses.length > 0) {
      const { count: aliveUpdated } = await supabase
        .from('bloblets')
        .update({ is_alive: false })
        .in('address', aliveAddresses)
      updatedCount += aliveUpdated || 0
    }

    // Update dead ones to alive
    if (deadAddresses.length > 0) {
      const { count: deadUpdated } = await supabase
        .from('bloblets')
        .update({ is_alive: true })
        .in('address', deadAddresses)
      updatedCount += deadUpdated || 0
    }

    return res.status(200).json({ 
      message: `Toggled ${sprites.length} sprites`,
      alive_to_dead: aliveAddresses.length,
      dead_to_alive: deadAddresses.length,
      total_updated: updatedCount
    })
  } catch (error) {
    console.error('Bulk update error:', error)
    return res.status(500).json({ error: 'Failed to update' })
  }
}
