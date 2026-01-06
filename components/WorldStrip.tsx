"use client"

import { useEffect, useRef, useState } from 'react'
import { loadManifest, loadSprites, pickVariantIndex, type LoadedSprites } from '@/src/client/spriteLoader'
import { SoccerEngine, FIELD } from '@/src/shared/soccerEngine'

type Vec = { x: number; y: number }
type Player = {
  id: number
  team: 0 | 1
  pos: Vec
  vel: Vec
  home: Vec
  state: 'idle' | 'chase' | 'return' | 'kick'
  animT: number
}

type GoalSide = 'left' | 'right'

function seededRand(seed: number) {
  let s = (seed >>> 0) || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff }
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }

export default function WorldStrip({ seed = 12345, className = '' }: { seed?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hud, setHud] = useState({ fps: 0, anim: 0 })
  const [score, setScore] = useState({ left: 0, right: 0 })
  const [clock, setClock] = useState(0) // seconds
  const scoreRef = useRef(score)
  const clockRef = useRef(clock)

  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { clockRef.current = clock }, [clock])

  useEffect(() => {
    const cvs = canvasRef.current!
    const ctx = cvs.getContext('2d')!
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1
    ctx.imageSmoothingEnabled = false

    // Field in logical units
    const W = FIELD.W
    const H = FIELD.H
    let goal: GoalSide | null = null

    const onResize = () => {
      const parent = cvs.parentElement
      const w = parent ? parent.clientWidth : 640
      const h = parent ? parent.clientHeight : 360
      // Only set drawing buffer size; let CSS (absolute inset-0) control display size
      cvs.width = Math.floor(w * dpr)
      cvs.height = Math.floor(h * dpr)
    }
    onResize()
    window.addEventListener('resize', onResize)

    const toScreen = (p: Vec) => {
      const ww = cvs.width / dpr
      const wh = cvs.height / dpr
      const sx = (p.x / W) * ww
      const sy = (p.y / H) * wh
      return { x: sx, y: sy }
    }

    // Engine-based sim
    const engine = new SoccerEngine(seed)
    const players = engine.players as unknown as Player[]
    for (const p of players) (p as any).animT = 0
    const ball: { pos: Vec; vel: Vec } = engine.ball as any

    // Sprite assets
    let sprites: LoadedSprites | null = null
    let variantIndex: number[] = []
    ;(async () => {
      try {
        const manifest = await loadManifest('/sprites/manifest.json')
        sprites = await loadSprites(manifest)
        // Assign deterministic variant per player
        const count = manifest.variants.length
        variantIndex = players.map((p) => pickVariantIndex(seed, count, p.id))
      } catch {}
    })()

    // Engine provides AI + physics

    // Physics step (delegates to engine)
    function step(dt: number) {
      engine.step(dt)
      for (const p of players) {
        const speed = Math.hypot(p.vel.x, p.vel.y)
        p.animT += dt * (0.5 + Math.min(1.5, speed * 0.1))
      }
      const evs = engine.consumeEvents()
      for (const e of evs) {
        if (e.type === 'goal') {
          sendActivity('goal', { side: e.side, t: e.t }).catch(() => {})
          if (e.side === 'left') {
            setScore(s => {
              const next = { ...s, right: s.right + 1 }
              scoreRef.current = next
              return next
            })
          } else {
            setScore(s => {
              const next = { ...s, left: s.left + 1 }
              scoreRef.current = next
              return next
            })
          }
        }
      }
    }

    // Drawing
    function draw() {
      const ww = cvs.width / dpr
      const wh = cvs.height / dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, ww, wh)
      // Field
      ctx.fillStyle = '#0b3d1f'
      ctx.fillRect(0, 0, ww, wh)
      ctx.strokeStyle = '#b5f5c6'
      ctx.lineWidth = 2
      ctx.strokeRect(2, 2, ww - 4, wh - 4)
      ctx.beginPath()
      ctx.moveTo(ww / 2, 2); ctx.lineTo(ww / 2, wh - 2); ctx.stroke()
      ctx.beginPath()
      ctx.arc(ww / 2, wh / 2, Math.min(ww, wh) * 0.08, 0, Math.PI * 2)
      ctx.stroke()

      // Determine animated set: near ball
      const nearR2 = (W * 0.2) ** 2
      let animCount = 0

      // Players (sprites if available; else colored dots)
      for (const p of players) {
        const scr = toScreen(p.pos)
        const near = ((p.pos.x - ball.pos.x) ** 2 + (p.pos.y - ball.pos.y) ** 2) < nearR2
        const size = Math.floor(Math.min(ww / 20, wh / 12)) // keep sprite readable
        const px = Math.round(scr.x - size / 2)
        const pyBase = Math.round(scr.y - size / 2)
        let drew = false
        if (sprites && sprites.manifest.variants.length) {
          const idx = variantIndex[p.id] ?? 0
          const url = sprites.manifest.variants[idx]?.url
          const img = url ? sprites.images.get(url) : null
          // If walk animation available and near -> pick frame
          const walk = sprites.manifest.anims?.walk
          const idle = sprites.manifest.anims?.idle
          const frameList = near && walk && walk.frames.length ? walk.frames : (idle && idle.frames.length ? [idle.frames[0]] : [])
          const fps = near && walk ? (walk.fps || 8) : 0
          let overlay: HTMLImageElement | null = null
          if (frameList.length) {
            const fidx = near && fps ? Math.floor(p.animT * fps) % frameList.length : 0
            const key = frameList[fidx] || ''
            overlay = key ? (sprites.images.get(key) || null) : null
          }
          if (img) {
            const bob = near ? Math.round(Math.sin(p.animT * 8) * Math.max(1, size * 0.06)) : 0
            const py = pyBase + bob
            ctx.drawImage(img, px, py, size, size)
            if (overlay) ctx.drawImage(overlay, px, py, size, size)
            drew = true
            if (near) animCount++
          }
        }
        if (!drew) {
          const r = Math.max(3, Math.min(8, (ww / 100) * 1.8))
          ctx.fillStyle = p.team === 0 ? '#1e90ff' : '#ff4757'
          ctx.beginPath()
          const bob = near ? Math.sin(p.animT * 8) * (r * 0.2) : 0
          ctx.arc(scr.x, scr.y + bob, r, 0, Math.PI * 2)
          ctx.fill()
          if (near) animCount++
        }
      }

      // Ball
      const b = toScreen(ball.pos)
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(2, (ww / 100) * 0.9), 0, Math.PI * 2); ctx.fill()

      setHud(prev => ({ ...prev, anim: animCount }))

      // Scoreboard + clock overlay
      const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
      const mins = Math.floor(clockRef.current / 60)
      const secs = Math.floor(clockRef.current % 60)
      const label = `${pad(mins)}:${pad(secs)}  ${scoreRef.current.left} – ${scoreRef.current.right}`
      const tw = ctx.measureText ? (ctx.measureText(label).width) : 80
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(8, 8, Math.max(90, tw + 12), 22)
      ctx.fillStyle = '#e5f6ff'
      ctx.font = '12px monospace'
      ctx.fillText(label, 14, 24)
    }

    // Loop
    let raf = 0
    let last = performance.now()
    let fpsAccum = 0, fpsFrames = 0, fpsLast = performance.now()
    const loop = () => {
      const now = performance.now()
      const dt = Math.max(0.016, Math.min(0.05, (now - last) / 1000))
      last = now
      step(dt)
      const nextClock = clockRef.current + dt
      clockRef.current = nextClock
      setClock(nextClock)
      draw()
      // FPS
      fpsAccum += 1
      fpsFrames++
      if (now - fpsLast > 500) {
        const fps = Math.round((fpsFrames * 1000) / (now - fpsLast))
        setHud(prev => ({ ...prev, fps }))
        fpsFrames = 0; fpsLast = now
      }
      raf = requestAnimationFrame(loop)
    }
    sendActivity('start', { t: Date.now() }).catch(() => {})
    raf = requestAnimationFrame(loop)

    const onClick = () => {
      // restart: reset score and clock
      const resetScore = { left: 0, right: 0 }
      scoreRef.current = resetScore
      setScore(resetScore)
      clockRef.current = 0
      setClock(0)
      engine.resetKickoff()
    }
    cvs.addEventListener('click', onClick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); cvs.removeEventListener('click', onClick) }
  }, [seed])

  return (
    <div className={`relative w-full h-full ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute top-1 right-2 text-[11px] text-white bg-black/50 px-2 py-1 rounded">FPS: {hud.fps} · Anim: {hud.anim}</div>
    </div>
  )
}

async function sendActivity(type: 'start' | 'goal', payload: any) {
  try {
    await fetch('/api/world/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    })
  } catch {}
}
