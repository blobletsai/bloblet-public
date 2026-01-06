import type { NextApiRequest, NextApiResponse } from 'next'

// Simple image proxy to avoid cross-origin texture failures (CORS)
// Usage: /api/proxy?u=<encoded absolute URL>
// Caches responses and forwards content-type
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const u = String(req.query.u || '')
    if (!u) return res.status(400).send('missing url')
    let url: URL
    try { url = new URL(u) } catch { return res.status(400).send('bad url') }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return res.status(400).send('unsupported protocol')
    }

    // Fetch remote asset
    const r = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return res.status(502).send(`upstream ${r.status} ${text.slice(0,256)}`)
    }

    // Copy headers
    const ct = r.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('Content-Type', ct)
    // Cache in CDN/browser; adjust as desired
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')
    // Allow embedding if needed
    res.setHeader('Access-Control-Allow-Origin', '*')

    const buf = Buffer.from(await r.arrayBuffer())
    res.status(200).send(buf)
  } catch (e: any) {
    res.status(500).send(e?.message || 'proxy failed')
  }
}

