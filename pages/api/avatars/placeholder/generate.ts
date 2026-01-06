import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { assetConfig } from '@/src/config/assets'
import { storageConfig } from '@/src/config/storage'
import { nbEditImage, briaRemoveBg, fetchBuffer } from '@/src/server/ai'
import { uploadPublic } from '@/src/server/storage'
import { ensurePngSize } from '@/src/server/image/canonical'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')

    // Use internal auth for testing/generation
    const secret = appConfig.secrets.cron || ''
    const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
    if (secret && hdr !== secret) return res.status(403).json({ error: 'forbidden' })

    const source = assetConfig.avatars.defaultSource
    if (!source) return res.status(400).json({ error: 'missing DEFAULT_AVATAR_SOURCE_URL' })

    // Generate placeholder with purple mystery theme
    const prompt = "mysterious silhouette version, completely dark purple shadow with glowing purple outline, large glowing white question mark symbol in center, ethereal purple mist particles, magical waiting state, keep same blob shape but as unrevealed shadow, pixel art style, retro game sprite"

    const generatedUrl = await nbEditImage(source, prompt)

    // Remove background just like custom avatars
    const cleanedUrl = await briaRemoveBg(generatedUrl)
    const buf = await fetchBuffer(cleanedUrl)
    const canonical = await ensurePngSize(buf)

    // Save as permanent placeholder asset
    const key = `avatars/placeholder_${Date.now()}.png`
    const cache = storageConfig.cacheControl
    const publicUrl = await uploadPublic({
      key,
      body: canonical,
      contentType: 'image/png',
      cacheControl: cache,
      kind: 'persist'
    })

    // Return the URL for testing/verification
    return res.status(200).json({
      ok: true,
      url: publicUrl,
      message: 'Placeholder sprite generated. Add this URL to env as PLACEHOLDER_SPRITE_URL'
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'generation failed' })
  }
}
