import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Toggle 5 random sprites
    const { data: sprites, error: fetchError } = await supabase
      .from('bloblets')
      .select('address, is_alive')
      .order('address')
      .limit(5)

    if (fetchError) throw fetchError

    const updates = await Promise.all(
      sprites.map(sprite => 
        supabase
          .from('bloblets')
          .update({ is_alive: !sprite.is_alive })
          .eq('address', sprite.address)
      )
    )

    return res.status(200).json({ 
      message: 'Updated 5 sprites',
      updates: updates.map(u => ({ error: u.error, count: u.count }))
    })
  } catch (error) {
    console.error('Test update error:', error)
    return res.status(500).json({ error: 'Failed to update' })
  }
}