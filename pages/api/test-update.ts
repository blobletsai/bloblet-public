import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { appConfig } from '@/src/config/app'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
