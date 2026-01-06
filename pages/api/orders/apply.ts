import type { NextApiRequest, NextApiResponse } from 'next'

import { supaAdmin } from '@/src/server/supa'
import { ensureAiEnv, nbEditImage, qwenEditImage, briaRemoveBg, fetchBuffer } from '@/src/server/ai'
import { uploadPublic, getPublicUrl } from '@/src/server/storage'
import { resolveChainKind } from '@/src/server/chains'
import { ensurePngSize } from '@/src/server/image/canonical'
import { appConfig } from '@/src/config/app'
import { storageConfig } from '@/src/config/storage'
import { assetConfig } from '@/src/config/assets'
import { ordersConfig } from '@/src/config/orders'

const CANONICAL_SIZE = assetConfig.avatars.canonicalSize
const WORKER_MAX_RETRIES = ordersConfig.worker.maxRetries
const WORKER_RETRY_DELAY_MS = ordersConfig.worker.retryDelayMs
const APPLY_BASE_URL = appConfig.urls.internalApiBase
const APPLY_SECRET = appConfig.secrets.internalApi

function normalizeErrorMessage(err: any): string {
  if (!err) return 'unknown error'
  const raw = typeof err === 'string' ? err : (err as Error)?.message || String(err)
  return raw.length > 240 ? `${raw.slice(0, 237)}...` : raw
}

function triggerSelf(orderId: number, delayMs = 0) {
  if (!APPLY_BASE_URL || !APPLY_SECRET || !Number.isFinite(orderId) || orderId <= 0) return
  const base = APPLY_BASE_URL.replace(/\/$/, '')
  const url = `${base}/api/orders/apply`
  const payload = JSON.stringify({ orderId })
  const fire = () => {
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-auth': APPLY_SECRET,
      },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }
  if (delayMs > 0) {
    const timer = setTimeout(fire, delayMs)
    if (typeof timer === 'object' && typeof (timer as any).unref === 'function') {
      ;(timer as any).unref()
    }
    return
  }
  fire()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    // Internal auth: require CRON_SECRET header for manual trigger
    const secret = appConfig.secrets.cron
    const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
    // In production, always require a secret; in non-prod allow if unset for local testing
    if ((appConfig.isProduction && !secret) || (secret && hdr !== secret)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    const supa = supaAdmin()
    const chainKind = resolveChainKind()

    // Process a single order id (simple + robust)
    const id = Number((req.body as any)?.orderId || (req.query as any)?.orderId)
    if (!id) return res.status(400).json({ error: 'missing orderId' })
    console.log('[orders.apply] start', { id })
    const { data: o, error } = await supa
      .from('orders')
      .select('*')
      .eq('chain_kind', chainKind)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!o) return res.status(404).json({ error: 'order not found' })
    const statusCurrent = String((o as any).status || '').toLowerCase()
    console.log('[orders.apply] loaded', {
      id,
      status: statusCurrent,
      retry_count: (o as any).retry_count ?? null,
      preview_alive: Boolean((o as any).preview_alive_url),
    })
    const runnableStatuses = new Set(['confirmed', 'queued', 'generating', 'alive_ready'])
    if (!runnableStatuses.has(statusCurrent)) {
      console.log('[orders.apply] skip (status not runnable)', { id, status: (o as any).status })
      return res.status(200).json({ applied: 0 })
    }

    const orderType = String((o as any).type || '')
    if (orderType === 'reward_topup') {
      console.log('[orders.apply] skip reward_topup (handled during confirmation)', { id })
      return res.status(200).json({ applied: 0 })
    }

    ensureAiEnv()
    let applied = 0
    {
      const addressStored = String((o as any).address || (o as any).address_canonical || '').trim()
      const addressCanonical =
        String((o as any).address_canonical || addressStored || '').trim() || addressStored
      const addressCased =
        String((o as any).address_cased || addressStored || (o as any).address_canonical || '').trim() ||
        addressCanonical
      const type = orderType
      const params = (o as any).params || {}

      try {
        console.log('[orders.apply] processing', { id, address: addressCanonical, type })
        // Atomic claim: move confirmed -> generating; skip if already claimed by another worker
        let claimedRow: any | null = null
        try {
          const { data: claimed, error: claimErr } = await supa
            .from('orders')
            .update({ status: 'generating', last_error: null })
            .eq('id', id)
            .eq('chain_kind', chainKind)
            .in('status', ['queued', 'confirmed', 'alive_ready', 'generating'])
            .select(
              'id,status,type,params,quote_amount,address,address_canonical,address_cased,chain_kind,preview_alive_url,retry_count,last_error,alive_ready_at',
            )
            .maybeSingle()
          if (claimErr) throw claimErr
          if (!claimed) {
            console.log('[orders.apply] skip (not claimed)', { id })
            return res.status(200).json({ applied: 0 })
          }
          claimedRow = claimed
          console.log('[orders.apply] claimed', {
            id,
            status: claimed.status,
            retry_count: claimed.retry_count ?? null,
            alive_ready_at: claimed.alive_ready_at ?? null,
            has_alive_preview: Boolean(claimed.preview_alive_url),
          })
        } catch (claimErr: any) {
          console.error('[orders.apply] claim error', { id, err: claimErr?.message || String(claimErr) })
          return res.status(200).json({ applied: 0 })
        }
        if (type === 'rename') {
          const name = String(params?.name || '').slice(0, 32)
          await supa.from('bloblets').upsert({
            address: addressCased,
            address_cased: addressCased,
            address_canonical: addressCanonical,
            chain_kind: chainKind,
            name,
          } as any, { onConflict: 'address' })
          await supa
            .from('orders')
            .update({ status: 'applied', applied_at: new Date().toISOString() })
            .eq('id', id)
            .eq('chain_kind', chainKind)
          applied++
          console.log('[orders.apply] done', { applied })
          return res.status(200).json({ applied })
        }

        if (type === 'prop') {
          // Generate an overlay prop via NB + Bria
          const kws: string[] = Array.isArray(params?.keywords) ? params.keywords : []
          const basePrompt = 'pixel art prop, centered, no background, high-contrast edges, PNG, no text, no watermark'
          const prompt = kws.length ? `${basePrompt}, ${kws.join(', ')}` : basePrompt
          // Use neutral mascot source as base for i2i
          const srcUrl = getPublicUrl('mascot/source.jpg')
          console.log('[orders.apply] prop nbEdit start', { id })
          const nbUrl = await nbEditImage(srcUrl, prompt)
          console.log('[orders.apply] prop nbEdit ok', { id, nbUrl })
          let cleanUrl: string
          try { console.log('[orders.apply] prop bria start', { id }); cleanUrl = await briaRemoveBg(nbUrl); console.log('[orders.apply] prop bria ok', { id, cleanUrl }) } catch { cleanUrl = nbUrl }
          const buf = await fetchBuffer(cleanUrl)
          const key = `props/orders/${id}_${Date.now()}.png`
          const cache = storageConfig.cacheControl
          const pubUrl = await uploadPublic({ key, body: buf, contentType: 'image/png', cacheControl: cache, kind: 'persist' })
          const ttl = ordersConfig.worker.propTtlSec
          const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()
          await supa.from('bloblets').insert({ type: 'order', image_url: pubUrl, anchor_x: 0, anchor_y: 0, z: 0, scale: 1, expires_at: expiresAt })
          await supa
            .from('orders')
            .update({ status: 'applied', applied_at: new Date().toISOString() })
            .eq('id', id)
            .eq('chain_kind', chainKind)
          applied++
          console.log('[orders.apply] done', { applied })
          return res.status(200).json({ applied })
        }

        if (type === 'persona_upgrade') {
          // Apply persona overrides onto bloblet row and generate a single alive sprite
          const traits = String(params?.traits || '')
          let spriteUrl: string | null = null
          try {
            const { getPublicUrl } = await import('@/src/server/storage')
            const sourceOverride = assetConfig.avatars.defaultSource
            const sourceUrl = sourceOverride || getPublicUrl('mascot/source.jpg')
            const basePrompt =
              'STRICT EDIT of the provided input mascot image (yellow pixel blob), preserve EXACT silhouette and proportions, preserve face, 8-bit pixel art, 1-px pure black outline, same yellow body hue, crisp nearest-neighbor pixels, transparent background, high-contrast edges, no background, no text, no watermark'
            const prompt = traits ? `${basePrompt}; add: ${traits}` : basePrompt
            console.log('[orders.apply] persona nbEdit start', { id })
            const nbUrl = await nbEditImage(sourceUrl, prompt)
            console.log('[orders.apply] persona nbEdit ok', { id, nbUrl })
            let cleanUrl: string
            try {
              console.log('[orders.apply] persona bria start', { id })
              cleanUrl = await briaRemoveBg(nbUrl)
              console.log('[orders.apply] persona bria ok', { id, cleanUrl })
            } catch {
              cleanUrl = nbUrl
            }
            const buf = await fetchBuffer(cleanUrl)
            const aliveCanonical = await ensurePngSize(buf, CANONICAL_SIZE)
            const key = `avatars/${addressCanonical}/custom_${Date.now()}.png`
            const cache = storageConfig.cacheControl
            spriteUrl = await uploadPublic({
              key,
              body: aliveCanonical,
              contentType: 'image/png',
              cacheControl: cache,
              kind: 'persist',
            })
          } catch (e) {
            // Fallback: keep existing sprite
            const { data: bl0 } = await supa
              .from('bloblets')
              .select('avatar_alive_url_256')
              .eq('chain_kind', chainKind)
              .eq('address_canonical', addressCanonical)
              .maybeSingle()
            spriteUrl = (bl0 as any)?.avatar_alive_url_256 || null
          }
          await supa
            .from('bloblets')
            .upsert(
              {
                address: addressCased,
                address_cased: addressCased,
                address_canonical: addressCanonical,
                chain_kind: chainKind,
                persona: { traits } as any,
                avatar_alive_url_256: spriteUrl,
                is_custom: true,
              } as any,
              { onConflict: 'address' },
            )
          await supa
            .from('orders')
            .update({ status: 'applied', applied_at: new Date().toISOString() })
            .eq('id', id)
            .eq('chain_kind', chainKind)
          applied++
          console.log('[orders.apply] done', { applied })
          return res.status(200).json({ applied })
        }

        if (type === 'avatar_custom') {
          ensureAiEnv()
          const activeOrder = claimedRow || o
          const paramsRaw = (activeOrder as any).params || {}
          const promptRaw = String(paramsRaw?.promptRaw || '').trim()
          const stylePresetRaw = String(paramsRaw?.stylePreset || '').trim().toLowerCase()
          const allowedPresets = new Set(['cinematic', 'painterly', 'comic', 'cyberpunk', 'noir', 'none', ''])
          const stylePreset = allowedPresets.has(stylePresetRaw) ? (stylePresetRaw || null) : null

          const NEG =
            'text, watermark, signature, extra limbs, deformed face, mutated, blurry, low-res, artifacts, background, scene, 3D, photorealism'
          const STYLE_PROMPTS: Record<string, string> = {
            cinematic: 'Apply cinematic pixel-art lighting with rich highlights and dramatic shadows.',
            painterly: 'Layer painterly pixel-art textures with varied dithering and brush-like clusters.',
            comic: 'Use bold comic-style outlines and saturated shading with halftone-inspired dithering.',
            cyberpunk: 'Integrate neon accents, futuristic accessories, and a cyberpunk pixel-art palette.',
            noir: 'Adopt a noir pixel-art palette with high-contrast monochrome and crimson highlights.',
          }

          const themePrompt = promptRaw
            ? `Incorporate the theme "${promptRaw}" by adding noticeable accessories, props, or color palette changes that clearly communicate this concept while preserving the character silhouette.`
            : 'Keep the mascot polished while preserving the original color palette and silhouette.'
          const stylePrompt = stylePreset && STYLE_PROMPTS[stylePreset] ? STYLE_PROMPTS[stylePreset] : null

          const { getPublicUrl } = await import('@/src/server/storage')
          const mascotRef =
            assetConfig.sprites.defaultAlive ||
            assetConfig.avatars.defaultSource ||
            getPublicUrl('mascot/source_mascot_nobg.png')

          const aliveBase =
            'STRICT EDIT of the provided input mascot image (yellow pixel blob), preserve EXACT silhouette and proportions, preserve face, 8-bit pixel art, 1-px pure black outline, same yellow body hue, crisp nearest-neighbor pixels, transparent background, high-contrast edges, no background, no text, no watermark'
          const alivePrompt = [aliveBase, themePrompt, stylePrompt].filter(Boolean).join('; ')

          const cache = storageConfig.cacheControl
          const baseKey = `sprites/${addressCanonical}/${id}`
          const currentRetries = Number((activeOrder as any).retry_count || 0)

          let previewAlive =
            typeof (activeOrder as any).preview_alive_url === 'string' && (activeOrder as any).preview_alive_url.length
              ? String((activeOrder as any).preview_alive_url)
              : null
          let aliveReadyIso =
            typeof (activeOrder as any).alive_ready_at === 'string' && (activeOrder as any).alive_ready_at.length
              ? String((activeOrder as any).alive_ready_at)
              : null

          let stage: 'init' | 'alive' = 'init'

          try {
            if (!previewAlive || !aliveReadyIso) {
              if (!promptRaw) throw new Error('Missing prompt')
              stage = 'alive'
              console.log('[orders.apply] avatar alive nb start', { id })
              const aliveUrl0 = await nbEditImage(mascotRef, alivePrompt)
              console.log('[orders.apply] avatar alive nb ok', { id, aliveUrl0 })
              let aliveClean: string
              try {
                console.log('[orders.apply] avatar alive bria start', { id })
                aliveClean = await briaRemoveBg(aliveUrl0)
                console.log('[orders.apply] avatar alive bria ok', { id, aliveClean })
              } catch {
                aliveClean = aliveUrl0
              }
              const aliveBuf = await fetchBuffer(aliveClean)
              const aliveCanonical = await ensurePngSize(aliveBuf, CANONICAL_SIZE)
              const aliveKey = `${baseKey}/alive.png`
              previewAlive = await uploadPublic({
                key: aliveKey,
                body: aliveCanonical,
                contentType: 'image/png',
                cacheControl: cache,
                kind: 'persist',
              })
              aliveReadyIso = new Date().toISOString()
              await supa
                .from('orders')
                .update({
                  preview_alive_url: previewAlive,
                  alive_ready_at: aliveReadyIso,
                  status: 'alive_ready',
                  retry_count: 0,
                  last_error: null,
                  reason: null,
                })
                .eq('id', id)
                .eq('chain_kind', chainKind)
            } else {
              const ensuredAliveIso = aliveReadyIso ?? new Date().toISOString()
              aliveReadyIso = ensuredAliveIso
              await supa
                .from('orders')
                .update({
                  status: 'alive_ready',
                  last_error: null,
                  reason: null,
                  alive_ready_at: ensuredAliveIso,
                })
                .eq('id', id)
                .eq('chain_kind', chainKind)
            }

            console.log('[orders.apply] avatar pipeline done', {
              id,
              status: 'alive_ready',
              alive_ready_at: aliveReadyIso,
            })
            return res.status(200).json({
              status: 'alive_ready',
              preview_alive_url: previewAlive,
            })
          } catch (err: any) {
            const message = normalizeErrorMessage(err)
            const nextRetry = currentRetries + 1
            const aliveDone = Boolean(previewAlive && aliveReadyIso)
            let nextStatus: string
            if (nextRetry >= WORKER_MAX_RETRIES) {
              nextStatus = 'rejected'
            } else if (aliveDone) {
              nextStatus = 'alive_ready'
            } else {
              nextStatus = 'queued'
            }

            const updatePayload: Record<string, any> = {
              status: nextStatus,
              retry_count: Math.min(nextRetry, WORKER_MAX_RETRIES),
              last_error: message,
            }
            if (nextStatus === 'rejected') {
              updatePayload.reason = message
            }
            await supa
              .from('orders')
              .update(updatePayload)
              .eq('id', id)
              .eq('chain_kind', chainKind)

            console.error('[orders.apply] avatar worker error', {
              id,
              stage,
              retry: currentRetries,
              nextStatus,
              err: message,
            })

            if (nextRetry < WORKER_MAX_RETRIES) {
              triggerSelf(id, WORKER_RETRY_DELAY_MS)
            }

            return res.status(200).json({ applied: 0, error: message, status: nextStatus })
          }
        }

        // Unsupported types for now
        console.warn('[orders.apply] unsupported type', { id, type })
        await supa
          .from('orders')
          .update({ status: 'rejected', reason: 'unsupported type' })
          .eq('id', id)
          .eq('chain_kind', chainKind)
        return res.status(200).json({ applied: 0 })
      } catch (e: any) {
        console.error('[orders.apply] error', { id, type, err: e?.message || String(e) })
        await supa
          .from('orders')
          .update({ status: 'rejected', reason: e?.message || 'apply failed' })
          .eq('id', id)
          .eq('chain_kind', chainKind)
        return res.status(200).json({ applied: 0 })
      }
    }
  } catch (e: any) {
    console.error('[orders.apply] fatal', { err: e?.message || String(e) })
    return res.status(500).json({ error: e?.message || 'apply failed' })
  }
}
