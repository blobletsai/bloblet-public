'use client'

import { useEffect, useMemo, useRef } from 'react'
import { RNG } from '@/src/shared/seeded'

type Props = {
  seed: string
  tier: 'top' | 'middle' | 'bottom'
  size: number
}

type PalettePair = readonly [string, string]

const PALETTES = {
  top: [
    ['#ff8a00', '#ffd200'],
    ['#00e7ff', '#00ffa3'],
    ['#ff4d6d', '#ffafcc'],
  ],
  middle: [
    ['#6ee7b7', '#3b82f6'],
    ['#a78bfa', '#f472b6'],
    ['#22d3ee', '#a3e635'],
  ],
  bottom: [
    ['#60a5fa', '#34d399'],
    ['#93c5fd', '#fcd34d'],
    ['#f472b6', '#fb7185'],
  ],
} as const satisfies Record<'top'|'middle'|'bottom', readonly PalettePair[]>

export default function GenBlob({ seed, tier, size }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const cfg = useMemo<{ bodyScale: number; squishX: number; squishY: number; palette: PalettePair; eyeStyle: number; mouthStyle: number; acc: boolean; accKind: number }>(() => {
    const rng = new RNG(seed + '::' + tier)
    const bodyScale = 0.42 + rng.next() * 0.1
    const squishX = 0.9 + rng.next() * 0.25
    const squishY = 0.9 + rng.next() * 0.25
    // Normalize readonly literal tuples to mutable [string,string] to satisfy TS
    const list: PalettePair[] = (PALETTES[tier] as readonly PalettePair[]).map(p => [p[0], p[1]] as PalettePair)
    const palette = (rng.pick(list) ?? list[0]) as PalettePair
    const eyeStyle = Math.floor(rng.range(0, 3)) // 0 round, 1 oval, 2 dot
    const mouthStyle = Math.floor(rng.range(0, 3)) // 0 smile, 1 flat, 2 o
    const acc = rng.next() < (tier==='top'?0.6: tier==='middle'?0.35:0.2) // accessory chance
    const accKind = Math.floor(rng.range(0, 3)) // 0 blush, 1 star, 2 stripe
    return { bodyScale, squishX, squishY, palette, eyeStyle, mouthStyle, acc, accKind }
  }, [seed, tier])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    c.width = Math.floor(size * dpr)
    c.height = Math.floor(size * dpr)
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const cx = size/2, cy = size/2
    const r = size * cfg.bodyScale

    // Body gradient
    const grad = ctx.createRadialGradient(cx - r*0.2, cy - r*0.2, r*0.1, cx, cy, r)
    const [c0, c1] = cfg.palette
    grad.addColorStop(0, c0)
    grad.addColorStop(1, c1)
    ctx.fillStyle = grad

    // Organic blob: ellipse with 8 control points perturbed
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(cfg.squishX, cfg.squishY)
    ctx.beginPath()
    const pts = 8
    for (let i=0; i<pts; i++) {
      const a = (i/pts) * Math.PI*2
      const rr = r * (0.75 + (i%2?0.08:-0.04))
      const x = Math.cos(a) * rr
      const y = Math.sin(a) * rr
      if (i===0) ctx.moveTo(x, y)
      else ctx.quadraticCurveTo(Math.cos(a - 0.15) * rr, Math.sin(a - 0.15) * rr, x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Eyes
    const eyeY = cy - r*0.1
    const eyeDx = r*0.18
    const eyeR = Math.max(3, r*0.07)
    ctx.fillStyle = '#101010'
    const drawEye = (x:number,y:number) => {
      ctx.save()
      if (cfg.eyeStyle===0) { // round
        ctx.beginPath(); ctx.arc(x,y,eyeR,0,Math.PI*2); ctx.fill()
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x-eyeR*0.3,y-eyeR*0.2,eyeR*0.4,0,Math.PI*2); ctx.fill()
      } else if (cfg.eyeStyle===1) { // oval
        ctx.translate(x,y); ctx.scale(1.2,0.8)
        ctx.beginPath(); ctx.arc(0,0,eyeR,0,Math.PI*2); ctx.fill()
      } else { // dot
        ctx.beginPath(); ctx.arc(x,y,eyeR*0.6,0,Math.PI*2); ctx.fill()
      }
      ctx.restore()
    }
    drawEye(cx-eyeDx, eyeY)
    drawEye(cx+eyeDx, eyeY)

    // Mouth
    ctx.strokeStyle = '#181818'; ctx.lineWidth = Math.max(1, r*0.03)
    if (cfg.mouthStyle===0) { // smile
      ctx.beginPath(); ctx.arc(cx, cy + r*0.12, r*0.12, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke()
    } else if (cfg.mouthStyle===1) { // flat
      ctx.beginPath(); ctx.moveTo(cx - r*0.10, cy + r*0.14); ctx.lineTo(cx + r*0.10, cy + r*0.14); ctx.stroke()
    } else { // o
      ctx.beginPath(); ctx.arc(cx, cy + r*0.12, r*0.06, 0, Math.PI*2); ctx.stroke()
    }

    // Accessory
    if (cfg.acc) {
      if (cfg.accKind===0) { // blush
        ctx.fillStyle = 'rgba(255,90,120,0.35)'
        ctx.beginPath(); ctx.ellipse(cx-eyeDx, cy + r*0.02, r*0.09, r*0.04, 0, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(cx+eyeDx, cy + r*0.02, r*0.09, r*0.04, 0, 0, Math.PI*2); ctx.fill()
      } else if (cfg.accKind===1) { // star
        const sx = cx + r*0.28, sy = cy - r*0.25
        ctx.fillStyle = 'rgba(255,255,200,0.9)'
        ctx.beginPath()
        for (let i=0;i<5;i++){
          const a = i * (Math.PI*2/5)
          const rx = sx + Math.cos(a) * r*0.06
          const ry = sy + Math.sin(a) * r*0.06
          if (i===0) ctx.moveTo(rx,ry)
          else ctx.lineTo(rx,ry)
        }
        ctx.closePath(); ctx.fill()
      } else { // stripe
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = r*0.05
        ctx.beginPath(); ctx.moveTo(cx - r*0.5, cy - r*0.25); ctx.lineTo(cx + r*0.5, cy - r*0.1); ctx.stroke()
      }
    }

    ctx.restore()
  }, [cfg, size])

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />
}
