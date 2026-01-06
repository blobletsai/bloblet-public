import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { assetConfig } from '@/src/config/assets'
import { storageConfig } from '@/src/config/storage'
import { briaRemoveBg, fetchBuffer } from '@/src/server/ai'
import { uploadPublic } from '@/src/server/storage'
import { supaAdmin } from '@/src/server/supa'
import { ensurePngSize } from '@/src/server/image/canonical'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    const secret = appConfig.secrets.cron || ''
    const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
    if (secret && hdr !== secret) return res.status(403).json({ error: 'forbidden' })

    const source = assetConfig.avatars.defaultSource
    if (!source) return res.status(400).json({ error: 'missing DEFAULT_AVATAR_SOURCE_URL' })

    // Run background removal via Bria, then upload to R2/Supabase
    const cleanedUrl = await briaRemoveBg(source)
    const buf = await fetchBuffer(cleanedUrl)
    const canonical = await ensurePngSize(buf)
    const key = `avatars/base_${Date.now()}.png`
    const cache = storageConfig.cacheControl
    const publicUrl = await uploadPublic({ key, body: canonical, contentType: 'image/png', cacheControl: cache, kind: 'persist' })

    // Optional: update all non-custom bloblets to this new base
    if (req.query.apply === '1') {
      const supa = supaAdmin()
      await supa
        .from('bloblets')
        .update({ avatar_alive_url_256: publicUrl, is_custom: false } as any)
        .eq('is_custom', false)
    }

    return res.status(200).json({ ok: true, url: publicUrl })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'process failed' })
  }
}
