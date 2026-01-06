// Trigger custom text formation via events insert
import type { NextApiRequest, NextApiResponse } from 'next'
import { supaAdmin } from '@/src/server/supa'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Text scene disabled
  return res.status(410).json({ error: 'text_scene_disabled' })
}
