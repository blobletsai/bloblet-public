"use client"

// Legacy/dev-only renderer used by test-formations and /dev/canvas playgrounds.
// Homepage production canvas uses BlobletsCanvas + overlays instead.

import { useEffect, useRef, useState } from 'react'
import { getDefaultSpriteUrl } from '@/src/shared/appearance'
import { supaAnon } from '@/src/server/supa'
import { SubscriptionManager } from '@/components/SubscriptionManager'
import type { Bloblet } from '@/types'
import { useOnlineStatus } from '@/src/client/hooks/useOnlineStatus'
import { gameplayConfig } from '@/src/config/gameplay'

type CanvasBloblet = Bloblet

function hash32(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function rankSize(rank: number | null | undefined) {
  if (!rank) return 16
  if (rank <= 5) return 38
  if (rank <= 20) return 30
  if (rank <= 50) return 24
  return 18
}

function spriteUrlFor(b: CanvasBloblet): string {
  if (b.is_alive) {
    const alive = (b.avatar_alive_url_256 || '').trim()
    if (alive.length) return alive
    return getDefaultSpriteUrl(true) || ''
  }
  return getDefaultSpriteUrl(false) || getDefaultSpriteUrl(true) || ''
}

export default function OrganicCanvas2D({ bloblets, debug = false, onCanvasReady }: { bloblets: CanvasBloblet[]; debug?: boolean; onCanvasReady?: (api: any) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(0)
  const itemsRef = useRef<any[]>([])
  const cacheBustMapRef = useRef<Map<string, string>>(new Map())
  const subMgrRef = useRef<SubscriptionManager | null>(null)
  const supaRef = useRef<any>(null)
  const isOnline = useOnlineStatus()
  if (!supaRef.current && typeof window !== 'undefined') {
    try { supaRef.current = supaAnon() } catch {}
  }

  useEffect(() => {
    const cvs = canvasRef.current!
    const ctx = cvs.getContext('2d')!
    let raf = 0
    let dragging = false
    let lastX = 0, lastY = 0
    let camX = 0
    let camY = 0
    let zoom = 1
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1
    ctx.imageSmoothingEnabled = false

    const onResize = () => {
      // Prefer visualViewport for exact viewport pixels; fallback to window
      const vp = (typeof window !== 'undefined' ? (window as any).visualViewport : null)
      const w = Math.max(1, Math.round((vp?.width ?? window.innerWidth)))
      const h = Math.max(1, Math.round((vp?.height ?? window.innerHeight)))
      // Backing store in device pixels; avoid rounding down to prevent 1px gaps
      cvs.width = Math.ceil(w * dpr)
      cvs.height = Math.ceil(h * dpr)
      // CSS size in CSS pixels
      cvs.style.width = `${w}px`
      cvs.style.height = `${h}px`
    }
    onResize()
    window.addEventListener('resize', onResize)

    // ---- Dense screen-space packer (Plan A) with fallback guard -----------
    const ww = cvs.width / dpr
    const wh = cvs.height / dpr
    const leftPx = 0
    const topPx = 0
    let total = 0
    let placedSorted: { px:number; py:number; sizePx:number; cat:number }[] = []
    try {
      // Reference constants in screen space
      const BASE_PX = 16
      const BASE_CELL = 18
      const JITTER = 2.2
      const cols = Math.max(1, Math.floor(ww / BASE_CELL))
      const rows = Math.max(1, Math.floor(wh / BASE_CELL))
      // Keep-out ellipse matching reference link (small central opening)
      const keepAPx = ww * 0.244 // semi-major
      const keepBPx = wh * 0.232 // semi-minor
      const keepCX = leftPx + ww / 2
      const keepCY = topPx + wh / 2
      // Build candidate cells outside keep-out ellipse
      const order: number[] = []
      for (let jj = 0; jj < rows; jj++) {
        for (let ii = 0; ii < cols; ii++) {
          const cx = leftPx + (ii + 0.5) * BASE_CELL
          const cy = topPx + (jj + 0.5) * BASE_CELL
          const ex = (cx - keepCX) / keepAPx
          const ey = (cy - keepCY) / keepBPx
          if (keepAPx > 0 && keepBPx > 0 && (ex * ex + ey * ey) <= 1) continue
          order.push(jj * cols + ii)
        }
      }
      // Cap via URL (?n=) with default 1000
      let cap = 1000
      try { const qs = new URLSearchParams(window.location.search); const n = Number(qs.get('n') || '') || cap; if (Number.isFinite(n) && n > 0) cap = Math.floor(n) } catch {}
      const Nwant = Math.min(cap, bloblets.length, order.length)
      const FRAC = [0.35, 0.23, 0.18, 0.12, 0.07, 0.035, 0.015]
      const CAT_MULT = [1.0, 1.25, 1.5, 1.8, 2.2, 2.8, 3.4]
      const CAT_SIZES = CAT_MULT.map(m => BASE_PX * m)
      const targets = FRAC.map((f, idx) => idx === FRAC.length - 1 ? 0 : Math.floor(Nwant * f))
      targets[FRAC.length - 1] = Math.max(0, Nwant - targets.slice(0, FRAC.length - 1).reduce((a, b) => a + b, 0))
      const seed = hash32(gameplayConfig.world.seed || 'blob:v3:grid')
      const rng = (() => { let s = seed; return { next: () => { s = (1664525 * s + 1013904223) >>> 0; return (s & 0xffffffff) / 0x100000000 } } })()
      for (let k = order.length - 1; k > 0; k--) { const j2 = Math.floor(rng.next() * (k + 1)); const t = order[k]; order[k] = order[j2]!; order[j2] = t! }
      const blocked: Uint8Array = new Uint8Array(rows * cols)
      const idx = (i: number, j: number) => j * cols + i
      const blockRadius = (rCells: number, ci: number, cj: number) => {
        for (let dj = -rCells; dj <= rCells; dj++) {
          for (let di = -rCells; di <= rCells; di++) {
            const ii = ci + di, jj = cj + dj
            if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue
            blocked[idx(ii, jj)] = 1
          }
        }
      }
      type Placement = { px:number; py:number; sizePx:number; cat:number }
      const placed: Placement[] = []
      function placeCat(catIndex: number, target: number) {
        const sizePx = (CAT_SIZES[catIndex] ?? CAT_SIZES[0]) as number
        const rCells = Math.max(1, Math.ceil(sizePx / BASE_CELL))
        let count = 0
        for (let k = 0; k < order.length && count < target; k++) {
          const lin = order[k]!
          const ci = lin % cols
          const cj = Math.floor(lin / cols)
          const bid = idx(ci, cj)
          if (blocked[bid]) continue
          const cx = leftPx + (ci + 0.5) * BASE_CELL
          const cy = topPx + (cj + 0.5) * BASE_CELL
          const jx = (rng.next() * 2 - 1) * JITTER
          const jy = (rng.next() * 2 - 1) * JITTER
          placed.push({ px: cx + jx, py: cy + jy, sizePx, cat: catIndex })
          blockRadius(rCells, ci, cj)
          count++
        }
        return count
      }
      for (let c = 6; c >= 0; c--) total += placeCat(c, targets[c] || 0)
      if (total < Nwant) total += placeCat(0, Nwant - total)
      placedSorted = [...placed].sort((a, b) => b.sizePx - a.sizePx)
      
      // Sanity instrumentation
      console.log('[Canvas 2D] Active with constants:', {
        BASE_CELL,
        BASE_PX,
        JITTER,
        order_length: order.length,
        Nwant,
        total_placed: total,
        items_created: placedSorted.length
      })
    } catch (e) {
      console.error('[Canvas] grid pack failed, falling back:', e)
      total = 0
      placedSorted = []
    }

    type Item = {
      b: Bloblet
      x: number; y: number // position in world/CSS px
      r: number // radius in px at current zoom=1
      color: string
      vx: number; vy: number
      img: HTMLImageElement | null
      imgReady: boolean
      url: string
      phase: number
      bobAmp: number
      socialHandle?: string | null
    }

    // Assign bloblets to placements: biggest holders → biggest sizes
    const byPctDesc = [...bloblets].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, Math.max(0,total))
    const items: Item[] = new Array(total)
    // Seeded state for idle bob only (no physics)
    for (let i = 0; i < total && i < placedSorted.length && i < byPctDesc.length; i++) {
      const p = placedSorted[i]!
      const b = byPctDesc[i]!
      const wx = camX + (p.px - ww / 2) / zoom
      const wy = camY + (p.py - wh / 2) / zoom
      const rWorld = (p.sizePx / 2)
      const phase = (hash32('ph:' + (b.address || i)) % 6283) / 1000 // 0..~6.283
      const bobAmp = Math.max(0.3, Math.min(1.2, rWorld * 0.03))
      const rawHandle = (b as any).socialHandle ?? (b as any).social_handle ?? null
      const socialHandle = typeof rawHandle === 'string' ? rawHandle.trim() : null
      if (socialHandle) {
        (b as any).socialHandle = socialHandle
        ;(b as any).social_handle = socialHandle
      }
      items[i] = {
        b,
        x: wx,
        y: wy,
        r: rWorld,
        color: b.tier === 'top' ? '#ffd200' : b.tier === 'middle' ? '#22d3ee' : '#34d399',
        vx: 0,
        vy: 0,
        img: null,
        imgReady: false,
        url: spriteUrlFor(b!),
        phase,
        bobAmp,
        socialHandle: socialHandle || null,
      }
    }
    setRendered(items.length)
    itemsRef.current = items

    const cacheBustMap = cacheBustMapRef.current
    const cacheBustSrc = (rawUrl: string, forceNew = false) => {
      if (!rawUrl) return rawUrl
      try {
        const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bloblets.ai'
        const parsed = new URL(rawUrl, baseOrigin)
        const host = parsed.hostname || ''
        const ownHost = typeof window !== 'undefined' ? window.location.hostname : ''
        const isCross = !!host && host !== ownHost
        // For cross-origin sprite URLs, route through same-origin proxy to avoid preview CORS edge cases
        const baseKey = isCross ? parsed.toString() : rawUrl
        const key = baseKey
        let token = cacheBustMap.get(key)
        if (!token) {
          token = 'cors'
          cacheBustMap.set(key, token)
        } else if (forceNew) {
          token = `cors-${Date.now().toString(36)}`
          cacheBustMap.set(key, token)
        }
        if (isCross) {
          const proxied = `/api/proxy?u=${encodeURIComponent(parsed.toString())}&cb=${encodeURIComponent(token)}`
          return proxied
        }
        // same-origin: just append cb to rawUrl
        const u = new URL(rawUrl, baseOrigin)
        u.searchParams.set('cb', token)
        return u.pathname + (u.search ? u.search : '')
      } catch {
        const stripped = rawUrl.replace(/([?&])cb=[^&]*(&?)/gi, (_, prefix, suffix) => {
          if (prefix === '?' && suffix) return '?'
          if (prefix === '?' && !suffix) return ''
          if (prefix === '&' && suffix) return '&'
          return ''
        }).replace(/[?&]$/, '')
        let token = cacheBustMap.get(stripped)
        if (!token) {
          token = 'cors'
          cacheBustMap.set(stripped, token)
        } else if (forceNew) {
          token = `cors-${Date.now().toString(36)}`
          cacheBustMap.set(stripped, token)
        }
        const sep = stripped.includes('?') ? '&' : '?'
        // Fall back to proxy if URL looks absolute and cross-origin in string form
        try {
          const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bloblets.ai'
          const u = new URL(stripped, baseOrigin)
          const host = u.hostname || ''
          const ownHost = typeof window !== 'undefined' ? window.location.hostname : ''
          if (host && host !== ownHost) {
            return `/api/proxy?u=${encodeURIComponent(stripped)}&cb=${encodeURIComponent(token)}`
          }
        } catch {}
        return `${stripped}${sep}cb=${token}`
      }
    }

    const cache = new Map<string, HTMLImageElement>()
    const urls = Array.from(new Set(items.map(it => it.url).filter(Boolean)))
    const MAX = 400
    urls.slice(0, MAX).forEach((url) => {
      if (!url) return
      if (cache.has(url)) return
      const im = new Image()
      im.crossOrigin = 'anonymous'
      let retrying = false
      im.onload = () => {
        cache.set(url, im)
        items.forEach(it => { if (it.url === url) { it.img = im; it.imgReady = true } })
      }
      im.onerror = () => {
        if (!retrying) {
          retrying = true
          im.src = cacheBustSrc(url, true)
          return
        }
        cache.delete(url)
      }
      im.src = cacheBustSrc(url, false)
    })

    const screenToWorld = (sx: number, sy: number) => {
      const ww = cvs.width / dpr
      const wh = cvs.height / dpr
      const wx = camX + (sx - ww / 2) / zoom
      const wy = camY + (sy - wh / 2) / zoom
      return { wx, wy }
    }

    const short = (addr: string | null | undefined, name?: string | null) => {
      if (name && String(name).trim().length) return String(name).trim()
      const s = String(addr || '')
      if (s.length <= 12) return s
      return s.slice(0, 6) + '…' + s.slice(-4)
    }

    const clamp01 = (t: number) => t < 0 ? 0 : t > 1 ? 1 : t
    // No explicit entrance effects: match reference by swapping images as they load
    const draw = () => {
      const wpx = cvs.width
      const hpx = cvs.height
      // Clear/fill in device pixels to eliminate right/bottom gaps
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, wpx, hpx)
      ctx.fillStyle = '#67733f' // olive field baseline
      ctx.fillRect(0, 0, wpx, hpx)
      // Switch to CSS-pixel space for the rest
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const ww = wpx / dpr, wh = hpx / dpr

      ctx.translate(ww / 2, wh / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-camX, -camY)
      // Render pass: placeholders immediately; image swaps as they load
      for (const it of items) {
        const x = it.x
        const y = it.y
        const rad = Math.max(1, it.r)

        if (it.imgReady && it.img) {
          ctx.save(); ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.clip()
          ctx.drawImage(it.img, x - rad, y - rad, rad * 2, rad * 2)
          ctx.restore()
        } else {
          ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2)
          ctx.fillStyle = it.b.is_alive ? it.color : 'rgba(180,180,180,0.6)'
          ctx.fill()
        }
        ctx.lineWidth = 1 / zoom
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke()
        if (!it.b.is_alive) {
          ctx.save(); ctx.globalAlpha = 0.35
          ctx.fillStyle = 'rgba(0,0,0,1)'
          ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill()
          ctx.restore()
        }

        // Labels only when sufficiently zoomed in
        if (zoom >= 1.2) {
          const label = short(it.b.address, it.b.name)
          const fpx = Math.max(11, Math.min(14, Math.round(13 / zoom)))
          ctx.font = `${fpx}px system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const tw = Math.ceil(ctx.measureText(label).width)
          const padX = 6 / zoom
          const padY = 3 / zoom
          const pillW = tw + padX * 2
          const pillH = fpx + padY * 2
          const lx = x
          const ly = y - rad - (10 / zoom)
          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.beginPath()
          const rx = 6 / zoom
          ctx.moveTo(lx - pillW / 2 + rx, ly - pillH / 2)
          ctx.lineTo(lx + pillW / 2 - rx, ly - pillH / 2)
          ctx.quadraticCurveTo(lx + pillW / 2, ly - pillH / 2, lx + pillW / 2, ly - pillH / 2 + rx)
          ctx.lineTo(lx + pillW / 2, ly + pillH / 2 - rx)
          ctx.quadraticCurveTo(lx + pillW / 2, ly + pillH / 2, lx + pillW / 2 - rx, ly + pillH / 2)
          ctx.lineTo(lx - pillW / 2 + rx, ly + pillH / 2)
          ctx.quadraticCurveTo(lx - pillW / 2, ly + pillH / 2, lx - pillW / 2, ly + pillH / 2 - rx)
          ctx.lineTo(lx - pillW / 2, ly - pillH / 2 + rx)
          ctx.quadraticCurveTo(lx - pillW / 2, ly - pillH / 2, lx - pillW / 2 + rx, ly - pillH / 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillText(label, lx, ly + 0.5/zoom)

          // Render social handle if present (above the character)
          // Neon cyan color, slightly smaller font, no background pill
          const handle =
            typeof it.socialHandle === 'string'
              ? it.socialHandle
              : typeof (it.b as any).socialHandle === 'string'
                ? (it.b as any).socialHandle
                : typeof (it.b as any).social_handle === 'string'
                  ? (it.b as any).social_handle
                  : null
          const handleTrimmed = typeof handle === 'string' ? handle.trim() : ''
          if (handleTrimmed.length > 0) {
            const hText = handleTrimmed.startsWith('@') ? handleTrimmed : '@' + handleTrimmed
            const hFpx = Math.max(9, Math.min(12, Math.round(11 / zoom)))
            ctx.font = `bold ${hFpx}px monospace, ui-monospace, SFMono-Regular`
            ctx.fillStyle = '#00d9f9'
            // Subtle drop shadow for readability without a pill
            ctx.shadowColor = 'rgba(0,0,0,0.8)'
            ctx.shadowBlur = 2
            ctx.shadowOffsetX = 1
            ctx.shadowOffsetY = 1
            // Position above the character (further up than the name pill if name was above, but here name is below? 
            // Wait, previous code renders name at y - rad - 10/zoom which is ABOVE.
            // Let's put handle ABOVE the name pill.
            const pillTop = ly - pillH / 2
            const hy = pillTop - (hFpx / 2) - (4 / zoom)
            ctx.fillText(hText, lx, hy)
            // Reset shadow
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
            // Reset font for next iteration/pass
            ctx.font = `${fpx}px system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial`
          }
        }
      }
    }

    const tick = () => { draw(); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)

    let downX = 0, downY = 0, downT = 0
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      downX = e.clientX
      downY = e.clientY
      downT = performance.now()
    }
    const onPointerUp = (e: PointerEvent) => {
      const upT = performance.now()
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
      const clicked = dragging && moved < 4 && (upT - downT) < 250
      dragging = false
      if (!clicked) return
      const rect = cvs.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const { wx, wy } = screenToWorld(mx, my)
      let best: Item | null = null
      let bestD2 = Infinity
      for (const it of items) {
        const dx = wx - it.x
        const dy = wy - it.y
        const d2 = dx*dx + dy*dy
        const r = it.r
        if (d2 <= (r*r) && d2 < bestD2) { best = it; bestD2 = d2 }
      }
      if (best && best.b?.address) {
        try { window.location.href = `/bloblet/${best.b.address}` } catch {}
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      camX -= dx / zoom
      camY -= dy / zoom
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = cvs.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const before = screenToWorld(mx, my)
      const wheel = Math.sign(e.deltaY)
      const factor = wheel < 0 ? 1.08 : 0.92
      const next = Math.min(6.0, Math.max(0.35, zoom * factor))
      if (next === zoom) return
      zoom = next
      const after = screenToWorld(mx, my)
      camX += before.wx - after.wx
      camY += before.wy - after.wy
    }
    cvs.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    cvs.addEventListener('wheel', onWheel, { passive: false })

    // --- Realtime subscription wiring ---
    const supa = isOnline ? supaRef.current : null
    const visibleAddrs = new Set(items.map(it => String(it.b.address || '').trim()).filter(Boolean))

    // Helper: refresh sprite image for item after URL change
    function reloadSprite(it: any) {
      const u = it.url
      if (!u) { it.img = null; it.imgReady = false; return }
      const im = new Image()
      im.crossOrigin = 'anonymous'
      let retried = false
      im.onload = () => {
        cache.set(u, im)
        it.img = im
        it.imgReady = true
      }
      im.onerror = () => {
        if (!retried) {
          retried = true
          im.src = cacheBustSrc(u, true)
          return
        }
        it.img = null
        it.imgReady = false
      }
      im.src = cacheBustSrc(u, true)
    }

    // Handler for realtime changes
    const onChange = (payload: any) => {
      try {
        const addr = String(payload?.new?.address || payload?.old?.address || '').trim()
        if (!addr) return
        const list = itemsRef.current as any[]
        let it = null
        for (let i = 0; i < list.length; i++) {
          const a = list[i]
          if (a && String(a.b?.address || '').trim() === addr) { it = a; break }
        }
        if (!it) return
        const row = payload?.new || {}
        // Update alive/name/avatars
        if (typeof row.is_alive === 'boolean') it.b.is_alive = row.is_alive
        if (typeof row.name === 'string') it.b.name = row.name
        if (typeof row.social_handle === 'string' || row.social_handle === null) {
          const normalized =
            typeof row.social_handle === 'string' && row.social_handle.trim().length
              ? row.social_handle.trim()
              : null
          it.socialHandle = normalized
          ;(it.b as any).socialHandle = normalized
          // also set snake_case just in case renderer reads that directly
          ;(it.b as any).social_handle = normalized
        }
        if (typeof row.avatar_alive_url_256 === 'string' || row.avatar_alive_url_256 === null) it.b.avatar_alive_url_256 = row.avatar_alive_url_256
        // Recompute URL based on alive/dead
        const newUrl = spriteUrlFor(it.b as Bloblet)
        if (newUrl !== it.url) { it.url = newUrl; it.img = null; it.imgReady = false; reloadSprite(it) }
      } catch {}
    }

    if (!isOnline && subMgrRef.current) {
      try { subMgrRef.current.cleanup() } catch {}
      subMgrRef.current = null
    }

    if (supa && !subMgrRef.current) {
      try { subMgrRef.current = new SubscriptionManager(supa, onChange, !!debug) } catch {}
    }
    try { subMgrRef.current?.updateAddresses(visibleAddrs) } catch {}

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      cvs.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      cvs.removeEventListener('wheel', onWheel)
      try { subMgrRef.current?.cleanup(); subMgrRef.current = null } catch {}
    }
  }, [bloblets, debug, isOnline])

  useEffect(() => { if (onCanvasReady) onCanvasReady({}) }, [onCanvasReady])

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute bottom-2 right-2 text-[11px] text-gray-200 bg-black/40 px-2 py-1 rounded z-50">
        Rendered: {rendered}
      </div>
    </div>
  )
}
