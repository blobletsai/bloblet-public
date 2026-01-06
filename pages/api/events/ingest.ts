import type { NextApiRequest, NextApiResponse } from 'next'
import { appConfig } from '@/src/config/app'
import { eventsConfig } from '@/src/config/events'
import { storageConfig } from '@/src/config/storage'
import { supaAdmin } from '@/src/server/supa'
import { rateLimiter } from '@/src/server/rateLimit'
import { ensureAiEnv, nbEditImage, briaRemoveBg, fetchBuffer, openaiClient } from '@/src/server/ai'
import { uploadPublic, getPublicUrl } from '@/src/server/storage'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'

const CHAIN_KIND = resolveChainKind()

async function getTopRanks() {
  const supa = supaAdmin()
  const { data } = await supa
    .from('token_holders')
    .select('address,address_canonical,rank')
    .eq('chain_kind', CHAIN_KIND)
    .order('rank', { ascending: true })
    .limit(100)
  const map = new Map<string, number>()
  for (const row of data || []) {
    const key = String((row as any).address_canonical || (row as any).address || '').trim()
    map.set(key, Number((row as any).rank))
  }
  return map
}

async function getSourceUrl() { return getPublicUrl('mascot/source.jpg') }

function buildAttireKeywords(avoid: string[], theme?: string) {
  const base = [
    'attire', 'accessory', 'motif', 'color accent', 'vibe'
  ]
  const avoidText = avoid.length ? `Avoid: ${avoid.join(', ')}` : 'Avoid: none'
  const themeLine = theme ? `Prefer theme: ${theme}` : 'Prefer cheerful, cohesive pixel look'
  return { system: `You output ONLY comma-separated keywords (5 tokens). No prose. ${avoidText}. ${themeLine}.` }
}

async function generateKeywords(avoid: string[], theme?: string) {
  const openai = openaiClient()
  const sys = buildAttireKeywords(avoid, theme).system
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini', temperature: 0.8,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: 'Return 5 tokens as: attire, accessory, motif, color accent, vibe.' },
    ],
  })
  const text = resp.choices?.[0]?.message?.content?.trim() || ''
  return text.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    // Optional internal auth: require CRON_SECRET when set to reduce attack surface
    const secret = appConfig.secrets.cron
    if (secret) {
      const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
      if (hdr !== secret) return res.status(403).json({ error: 'forbidden' })
    }
    const ip = req.headers['x-forwarded-for'] as string || 'ingestor'
    const { success } = await rateLimiter.limit(`ingest:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })

    const body = req.body || {}
    // Expected payload: { type: 'balance_change', address, prev_balance, new_balance, theme? }
    const type = String(body.type || '')
    let addressCanonical = ''
    try {
      addressCanonical = normalizeChainAddress(body.address, CHAIN_KIND)
    } catch {
      addressCanonical = ''
    }
    if (!addressCanonical) return res.status(400).json({ error: 'address_invalid' })

    const prevBal = BigInt(String(body.prev_balance ?? '0'))
    const newBal = BigInt(String(body.new_balance ?? '0'))
    const delta = newBal - prevBal
    const theme = body.theme ? String(body.theme) : undefined

    const supa = supaAdmin()
    await supa.from('events').insert({ type, payload: body, severity: 1 })

    if (type !== 'balance_change') return res.status(200).json({ ok: true })
    if (delta <= 0n) return res.status(200).json({ ok: true, note: 'sell or no change' })

    // Check thresholds
    const th = eventsConfig.buyThresholds
    let pass = false
    if (th.minAbs && delta >= BigInt(Math.floor(th.minAbs))) pass = true
    // fetch holder current percent to evaluate pct delta roughly
    const { data: holder } = await supa
      .from('token_holders')
      .select('balance,rank')
      .eq('chain_kind', CHAIN_KIND)
      .eq('address_canonical', addressCanonical)
      .maybeSingle()
    const topMap = await getTopRanks()
    const rank = Number(holder?.rank ?? topMap.get(addressCanonical) ?? 999)
    if (!pass && th.minPct && holder?.balance) {
      const old = BigInt(holder.balance)
      if (old > 0n) {
        const pct = Number((delta * 10000n) / old) / 100
        if (pct >= th.minPct) pass = true
      }
    }
    if (!pass) return res.status(200).json({ ok: true, note: 'below thresholds' })
    if (rank > th.topN) return res.status(200).json({ ok: true, note: 'not in topN' })

    // Cooldown per address
    const cdKey = `appearance:cd:${addressCanonical}`
    const cd = await rateLimiter.limit(cdKey)
    if (!cd.success) return res.status(200).json({ ok: true, note: 'cooldown' })

    // Generate new appearance
    ensureAiEnv()
    const source = await getSourceUrl()
    const avoid: string[] = []
    const parts = await generateKeywords(avoid, theme)
    const prompt = `yellow pixel cartoon mascot, add: ${parts.join(', ')}, no background, no text, no watermark`
    const nbUrl = await nbEditImage(source, prompt)
    let cleanUrl: string
    try { cleanUrl = await briaRemoveBg(nbUrl) } catch { cleanUrl = nbUrl }
    const buf = await fetchBuffer(cleanUrl)
    const key = `mascots/${addressCanonical}.png`
    const cache = storageConfig.cacheControl
    const publicUrl = await uploadPublic({ key, body: buf, contentType: 'image/png', cacheControl: cache, kind: 'persist' })
    await supa.from('bloblets').upsert({
      address: addressCanonical,
      address_canonical: addressCanonical,
      address_cased: addressCanonical,
      chain_kind: CHAIN_KIND,
      avatar_alive_url_256: publicUrl,
      last_change_at: new Date().toISOString(),
    } as any, { onConflict: 'address_canonical,chain_kind' })
    await supa.from('appearance_changes').insert({
      address: addressCanonical,
      delta: Number(delta),
      reason: 'buy',
      theme: theme || null,
      new_url: publicUrl,
    })

    return res.status(200).json({ ok: true, url: publicUrl, prompt })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'ingest failed' })
  }
}
