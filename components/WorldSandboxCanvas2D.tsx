"use client"

import { useEffect, useRef, useState } from 'react'

type Obj = { id: number; type: string; x: number; y: number; z: number; scale: number }

export default function WorldSandboxCanvas2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [objects, setObjects] = useState<Obj[]>([])
  const objectsRef = useRef<Obj[]>([])

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

    const onResize = () => {
      const rect = cvs.parentElement?.getBoundingClientRect()
      const w = rect?.width ?? window.innerWidth
      const h = rect?.height ?? Math.min(window.innerHeight * 0.7, 700)
      cvs.width = Math.floor(w * dpr)
      cvs.height = Math.floor(h * dpr)
      cvs.style.width = `${w}px`
      cvs.style.height = `${h}px`
    }
    onResize()
    window.addEventListener('resize', onResize)

    const screenToWorld = (sx: number, sy: number) => {
      const ww = cvs.width / dpr
      const wh = cvs.height / dpr
      const wx = camX + (sx - ww / 2) / zoom
      const wy = camY + (sy - wh / 2) / zoom
      return { wx, wy }
    }

    const draw = () => {
      const w = cvs.width
      const h = cvs.height
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const ww = w / dpr, wh = h / dpr
      // Background
      ctx.fillStyle = '#0a0e15'
      ctx.fillRect(0, 0, ww, wh)

      ctx.translate(ww / 2, wh / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-camX, -camY)

      // Draw objects
      for (const o of objectsRef.current) {
        const color = o.type.startsWith('shop') ? '#5A67D8' : (o.type === 'house' ? '#718096' : (o.type === 'playground' ? '#38B2AC' : '#2F855A'))
        ctx.fillStyle = color
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.lineWidth = 1 / zoom
        ctx.beginPath()
        if (o.type === 'tree') {
          ctx.arc(o.x, o.y, 18 * o.scale, 0, Math.PI * 2)
        } else {
          const s = 12 * o.scale
          ctx.rect(o.x - s, o.y - s, s * 2, s * 2)
        }
        ctx.fill()
        ctx.stroke()
      }
    }

    const tick = () => { draw(); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)

    const onPointerDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY }
    const onPointerUp = () => { dragging = false }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      camX -= dx / zoom
      camY -= dy / zoom
      scheduleLoad()
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = cvs.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const before = screenToWorld(mx, my)
      const wheel = Math.sign(e.deltaY)
      const factor = wheel < 0 ? 1.08 : 0.92
      const next = Math.min(3.0, Math.max(0.35, zoom * factor))
      if (next === zoom) return
      zoom = next
      const after = screenToWorld(mx, my)
      camX += before.wx - after.wx
      camY += before.wy - after.wy
      scheduleLoad()
    }
    cvs.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    cvs.addEventListener('wheel', onWheel, { passive: false })

    let to: any = null
    const load = async () => {
      const ww = cvs.width / dpr
      const wh = cvs.height / dpr
      const min = screenToWorld(0, 0)
      const max = screenToWorld(ww, wh)
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return
        const url = `/api/world/objects?minX=${min.wx.toFixed(2)}&maxX=${max.wx.toFixed(2)}&minY=${min.wy.toFixed(2)}&maxY=${max.wy.toFixed(2)}`
        const res = await fetch(url)
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.objects) {
          const rows: Obj[] = data.objects.map((r: any) => ({ id: Number(r.id), type: String(r.type), x: Number(r.anchor_x||0), y: Number(r.anchor_y||0), z: Number(r.z||0), scale: Number(r.scale||1) }))
          objectsRef.current = rows
          setObjects(rows)
        }
      } catch {}
    }
    const scheduleLoad = () => { if (to) clearTimeout(to); to = setTimeout(load, 150) }
    scheduleLoad()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      cvs.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      cvs.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    objectsRef.current = objects
  }, [objects])

  return <canvas ref={canvasRef} className="w-full h-[70vh] border border-slate-800 rounded" />
}
