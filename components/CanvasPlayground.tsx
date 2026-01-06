"use client"

// Dev playground for the legacy OrganicCanvas2D renderer (not used in production homepage).
// Main site uses BlobletsCanvas and related overlays.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const OrganicCanvas = dynamic(() => import('./OrganicCanvas2D'), { ssr: false })

type Bloblet = {
  address: string
  is_alive: boolean
  tier: 'top' | 'middle' | 'bottom'
  avatar_alive_url_256: string | null
  rank: number | null
  percent: number | null
  name?: string | null
}

function hash32(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function addrFromSeed(seed: string) {
  let out = ''
  let a = hash32(seed)
  for (let i = 0; i < 10; i++) {
    a = Math.imul((a ^ 0x9e3779b9) >>> 0, 16777619) >>> 0
    const part = (a >>> 0).toString(16).padStart(8, '0')
    out += part.slice(0, 4)
  }
  return '0x' + out.slice(0, 40)
}

function makeSet(seed: number, count: number): Bloblet[] {
  const arr: Bloblet[] = []
  for (let i = 0; i < count; i++) {
    const address = addrFromSeed(`DEV|${seed}|${i}`)
    const rank = i + 1
    const tier: Bloblet['tier'] = rank <= 20 ? 'top' : rank <= 70 ? 'middle' : 'bottom'
    arr.push({ address, rank, tier, is_alive: true, avatar_alive_url_256: null, percent: null, name: null })
  }
  return arr
}

export default function CanvasPlayground() {
  const [seed, setSeed] = useState(42)
  const [count, setCount] = useState(260)
  const [simDeaths, setSimDeaths] = useState(false)
  const tickRef = useRef<number | null>(null)

  const data = useMemo(() => makeSet(seed, count), [seed, count])
  const [bloblets, setBloblets] = useState<Bloblet[]>(data)

  useEffect(() => { setBloblets(data) }, [data])

  // Simple death/rebirth simulator to exercise alive/dead visuals
  useEffect(() => {
    if (!simDeaths) { if (tickRef.current) cancelAnimationFrame(tickRef.current); tickRef.current = null; return }
    let last = performance.now()
    const step = () => {
      const now = performance.now()
      if (now - last > 1200) { // every ~1.2s
        last = now
        setBloblets(prev => {
          const arr = [...prev]
          const n = Math.max(1, Math.floor(arr.length * 0.02))
          for (let k = 0; k < n; k++) {
            const idx = Math.floor(Math.random() * arr.length)
            arr[idx] = { ...arr[idx]!, is_alive: Math.random() > 0.5 }
          }
          return arr
        })
      }
      tickRef.current = requestAnimationFrame(step)
    }
    tickRef.current = requestAnimationFrame(step)
    return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); tickRef.current = null }
  }, [simDeaths])

  const shuffle = useCallback(() => setSeed(s => s + 1), [])

  return (
    <div className="relative w-screen h-screen">
      <OrganicCanvas bloblets={bloblets} />
      <div className="absolute top-4 left-4 z-[10000] flex items-center gap-2 bg-black/50 text-white px-3 py-2 rounded">
        <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded" onClick={shuffle}>Shuffle</button>
        <label className="flex items-center gap-1 text-xs">
          Count
          <input type="number" className="w-16 bg-black/30 border border-white/20 rounded px-1 py-0.5" value={count} min={50} max={1000} step={10}
                 onChange={(e) => setCount(Math.max(50, Math.min(1000, parseInt(e.target.value||'0', 10) || 0)))} />
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={simDeaths} onChange={(e) => setSimDeaths(e.target.checked)} />
          Sim deaths
        </label>
      </div>
    </div>
  )
}
