'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import GenBlob from '@/components/GenBlob'
import { featuresConfig } from '@/src/config/features'

type Bloblet = {
  address: string
  is_alive: boolean
  tier: 'top' | 'middle' | 'bottom'
  avatar_alive_url_256: string | null
  rank: number | null
  percent: number | null
}

type Props = {
  bloblets: Bloblet[]
}

function hash32(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rankSize(rank: number | null) {
  if (!rank) return 72
  if (rank <= 5) return 140
  if (rank <= 20) return 110
  if (rank <= 50) return 90
  return 72
}

// Polar ring by tier; returns {x,y} in [0,1] relative coords
function positionFor(address: string, tier: Bloblet['tier']) {
  const h = hash32(address)
  const angle = (h % 3600) / 10 // 0..360
  // radius band by tier
  let rMin = 0.2
  let rMax = 0.3
  if (tier === 'top') {
    rMin = 0.15
    rMax = 0.28
  } else if (tier === 'middle') {
    rMin = 0.3
    rMax = 0.45
  } else {
    rMin = 0.5
    rMax = 0.7
  }
  const rFrac = (h >>> 8) % 1000 / 1000
  const r = rMin + (rMax - rMin) * rFrac
  const rad = (angle * Math.PI) / 180
  const cx = 0.5
  const cy = 0.5
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export default function BlobletCanvas({ bloblets }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Bloblet | null>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [layout, setLayout] = useState<any[]>([])

  // Compute a smooth spiral/ring layout with simple collision avoidance
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    const cx = w / 2
    const cy = h / 2
    const golden = Math.PI * (3 - Math.sqrt(5)) // ~2.39996
    const byRank = [...bloblets].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    const placed: any[] = []

    function ringFor(tier: Bloblet['tier']) {
      if (tier === 'top') return { rMin: Math.min(w, h) * 0.10, rMax: Math.min(w, h) * 0.22 }
      if (tier === 'middle') return { rMin: Math.min(w, h) * 0.24, rMax: Math.min(w, h) * 0.40 }
      return { rMin: Math.min(w, h) * 0.42, rMax: Math.min(w, h) * 0.70 }
    }

    for (const b of byRank) {
      const size = rankSize(b.rank)
      const { rMin, rMax } = ringFor(b.tier)
      const seed = hash32(b.address)
      let ang = (seed % 3600) / 10 * (Math.PI / 180)
      let rFrac = ((seed >>> 8) % 1000) / 1000
      let r = rMin + (rMax - rMin) * rFrac
      let x = cx + r * Math.cos(ang)
      let y = cy + r * Math.sin(ang)
      let tries = 0
      const margin = 6
      while (tries < 80) {
        let ok = true
        for (const p of placed) {
          const dx = x - p.x
          const dy = y - p.y
          const dist = Math.hypot(dx, dy)
          const need = (size + p.size) / 2 + margin
          if (dist < need) { ok = false; break }
        }
        if (ok) break
        // Try a new point along the ring/spiral
        ang += golden
        r = Math.min(rMax, r + 4)
        x = cx + r * Math.cos(ang)
        y = cy + r * Math.sin(ang)
        tries++
      }
      placed.push({ ...b, x, y, size })
    }
    setLayout(placed)
  }, [bloblets])

  useEffect(() => {
    if (!active || !containerRef.current) return
    const it = layout.find(i => i.address === active.address)
    if (!it) return
    setAnchor({ x: it.x, y: it.y })
  }, [active, layout])

  // Weather and ambient animation state
  const weatherRef = useRef<{ kind: 'clear'|'clouds'|'rain'|'storm'|'snow'; t:number; nextAt:number }>({ kind:'clear', t:0, nextAt: 0 })
  const weatherCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    const step = (time: number) => {
      const wstate = weatherRef.current
      if (wstate.nextAt === 0) wstate.nextAt = time + 15000 + Math.random()*15000
      if (time > wstate.nextAt) {
        const kinds = ['clear','clouds','rain','storm','snow'] as const
        const idx = Math.floor(Math.random() * kinds.length)
        const nextKind = kinds[idx] ?? 'clear'
        wstate.kind = nextKind
        wstate.nextAt = time + 20000 + Math.random()*20000
      }
      wstate.t = time

      // draw
      const cvs = weatherCanvasRef.current
      if (cvs) {
        const ctx = cvs.getContext('2d')!
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
        const rect = cvs.getBoundingClientRect()
        const W = (cvs.width = Math.floor(rect.width * dpr))
        const H = (cvs.height = Math.floor(rect.height * dpr))
        ctx.scale(dpr,dpr)
        ctx.clearRect(0,0,rect.width,rect.height)
        const t = time/1000

        if (wstate.kind==='clouds' || wstate.kind==='storm' || wstate.kind==='rain') {
          // simple drifting clouds
          ctx.globalAlpha = 0.12
          for (let i=0;i<10;i++){
            const x = ((t*8 + i*120) % (rect.width+200)) - 100
            const y = 40 + (i%5)*50
            ctx.beginPath()
            ctx.fillStyle = '#cbd5e1'
            ctx.ellipse(x, y, 60, 28, 0, 0, Math.PI*2); ctx.fill()
          }
          ctx.globalAlpha = 1
        }
        if (wstate.kind==='rain' || wstate.kind==='storm') {
          // rain streaks
          ctx.strokeStyle = 'rgba(180,210,255,0.6)'
          ctx.lineWidth = 1
          const count = Math.floor(rect.width * 0.4)
          for (let i=0;i<count;i++){
            const rx = (i*37 + (t*200)%rect.width) % rect.width
            const ry = (i*91 + (t*400)%rect.height) % rect.height
            ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx+4, ry+10); ctx.stroke()
          }
          if (wstate.kind==='storm' && Math.random()<0.01) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0,0,rect.width,rect.height)
          }
        }
        if (wstate.kind==='snow') {
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          const count = Math.floor(rect.width * 0.15)
          for (let i=0;i<count;i++){
            const rx = (i*53 + (t*20)%rect.width) % rect.width
            const ry = (i*97 + (t*30)%rect.height) % rect.height
            ctx.beginPath(); ctx.arc(rx, ry, 1.5, 0, Math.PI*2); ctx.fill()
          }
        }
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[75vh] md:h-[78vh] rounded-xl overflow-hidden border border-slate-700"
      style={{
        backgroundImage: `url(/background.jpeg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Soft overlay tint */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-teal-900/20 to-slate-900/30 pointer-events-none" />

      {layout.map((b) => (
        <button
          key={b.address}
          onClick={() => setActive(b)}
          className="absolute group"
          style={{ left: b.x - b.size / 2, top: b.y - b.size / 2, width: b.size, height: b.size, zIndex: Math.round(b.y) }}
          aria-label="Open chat"
        >
          <div className={`rounded-full overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-black/30 ${b.is_alive ? '' : 'opacity-60 grayscale'} blob-bob`}>
            {featuresConfig.generativeBlobs || !b.avatar_alive_url_256 ? (
              <GenBlob seed={b.address} tier={b.tier} size={b.size} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.avatar_alive_url_256} alt="bloblet" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-200 bg-black/50 px-1 py-0.5 rounded">
            #{b.rank ?? '-'}
          </div>
        </button>
      ))}

      {/* Weather overlay canvas */}
      <canvas ref={weatherCanvasRef} className="absolute inset-0 pointer-events-none" />

      {active && anchor && (
        <div className="fixed inset-0 z-50" onClick={() => setActive(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute w-[min(90vw,520px)] max-h-[70vh]"
            style={{ left: Math.max(16, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1200) - 540, anchor.x + 12)), top: Math.max(16, Math.min((typeof window !== 'undefined' ? window.innerHeight : 800) - 420, anchor.y - 20)) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-md overflow-hidden bg-black/30">
                  {active.avatar_alive_url_256 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={active.avatar_alive_url_256} alt="bloblet" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="text-sm text-gray-300">
                  <div>Tier: {active.tier}</div>
                  <div>Rank {active.rank ?? '-'} · {active.percent?.toFixed(2) ?? '-'}%</div>
                </div>
                <button className="ml-auto text-xs text-gray-400 hover:text-white" onClick={() => setActive(null)}>Close</button>
              </div>
              <div className="rounded-2xl border border-[rgba(148,93,255,0.35)] bg-[rgba(18,6,46,0.85)] px-4 py-3 text-[12px] text-fantasy-muted">
                Direct chat with bloblets has been retired. Keep exploring the world or visit the My Assets hub to manage cosmetics.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
