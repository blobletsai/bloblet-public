import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { appConfig } from '@/src/config/app'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url: supabaseUrl, serviceKey: supabaseServiceKey } = appConfig.supabase
    
    if (!supabaseUrl) {
      throw new Error('supabaseUrl is required.')
    }
    if (!supabaseServiceKey) {
      throw new Error('supabaseKey is required.')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get count parameter (default 10, max 2000)
    const count = Math.min(parseInt(req.query.count as string) || 10, 2000)
    const mode = req.query.mode || 'toggle' // 'toggle', 'kill', 'revive', 'random'
    
    // Get a sample of sprites to transition
    // Focus on sprites that are likely visible (lower addresses tend to be in center)
    const { data: sprites, error: fetchError } = await supabase
      .from('bloblets')
      .select('address, is_alive')
      .order('address')
      .limit(count)
    
    if (fetchError) throw fetchError
    if (!sprites || sprites.length === 0) {
      return res.status(404).json({ error: 'No sprites found' })
    }
    
    console.log(`[Test Transitions] Processing ${sprites.length} sprites in ${mode} mode`)
    
    // Process transitions based on mode
    const updates = sprites.map(sprite => {
      let newState = sprite.is_alive
      
      switch(mode) {
        case 'toggle':
          newState = !sprite.is_alive
          break
        case 'kill':
          newState = false
          break
        case 'revive':
          newState = true
          break
        case 'random':
          newState = Math.random() > 0.5
          break
      }
      
      return {
        address: sprite.address,
        oldState: sprite.is_alive,
        newState: newState
      }
    })
    
    // Batch update all sprites at once for instant visual change
    const toUpdate = updates.filter(u => u.oldState !== u.newState)
    const toSkip = updates.filter(u => u.oldState === u.newState)
    
    const results: Array<{
      address: string
      oldState: boolean
      newState: boolean
      success: boolean
      skipped?: boolean
      error?: string
    }> = []
    
    // Add skipped results
    toSkip.forEach(u => results.push({ ...u, success: true, skipped: true }))
    
    if (toUpdate.length > 0) {
      // Group updates by new state for efficient batch updates
      const toKill = toUpdate.filter(u => !u.newState).map(u => u.address)
      const toRevive = toUpdate.filter(u => u.newState).map(u => u.address)
      
      // Batch update all sprites going to dead state
      if (toKill.length > 0) {
        const { error: killError } = await supabase
          .from('bloblets')
          .update({ is_alive: false })
          .in('address', toKill)
        
        if (killError) {
          console.error(`Failed to batch kill ${toKill.length} sprites:`, killError)
          toUpdate.filter(u => !u.newState).forEach(u => 
            results.push({ ...u, success: false, error: killError.message })
          )
        } else {
          console.log(`[Batch Transition] Killed ${toKill.length} sprites`)
          toUpdate.filter(u => !u.newState).forEach(u => 
            results.push({ ...u, success: true })
          )
        }
      }
      
      // Batch update all sprites going to alive state
      if (toRevive.length > 0) {
        const { error: reviveError } = await supabase
          .from('bloblets')
          .update({ is_alive: true })
          .in('address', toRevive)
        
        if (reviveError) {
          console.error(`Failed to batch revive ${toRevive.length} sprites:`, reviveError)
          toUpdate.filter(u => u.newState).forEach(u => 
            results.push({ ...u, success: false, error: reviveError.message })
          )
        } else {
          console.log(`[Batch Transition] Revived ${toRevive.length} sprites`)
          toUpdate.filter(u => u.newState).forEach(u => 
            results.push({ ...u, success: true })
          )
        }
      }
    }
    
    const transitioned = results.filter(r => r.success && !r.skipped).length
    const skipped = results.filter(r => r.skipped).length
    const failed = results.filter(r => !r.success).length
    
    return res.status(200).json({
      message: `Transitions complete`,
      mode,
      total: sprites.length,
      transitioned,
      skipped,
      failed,
      details: results
    })
    
  } catch (error: any) {
    console.error('Transition test error:', error)
    return res.status(500).json({ 
      error: 'Failed to process transitions',
      details: error?.message 
    })
  }
}
