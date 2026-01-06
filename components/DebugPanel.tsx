"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { featuresConfig } from '@/src/config/features'

function getFlag(name: string) {
  try { return new URLSearchParams(window.location.search).get(name) } catch { return null }
}

function setQuery(next: Record<string,string|undefined|null>) {
  try {
    const u = new URL(window.location.href)
    const qs = u.searchParams
    Object.entries(next).forEach(([k,v]) => {
      if (v === undefined || v === null || v === '') qs.delete(k)
      else qs.set(k, String(v))
    })
    // Update without full reload so state can continue; PixiStage reads flags on runScene
    window.history.replaceState({}, '', u.toString())
  } catch {}
}

export default function DebugPanel() {
  const enabled = useMemo(() => {
    try { const qs = new URLSearchParams(window.location.search); if (qs.get('debug') === '1') return true } catch {}
    return featuresConfig.worldDebug
  }, [])
  const [text, setText] = useState<string>('')

  if (!enabled) return null

  const run = (kind: 'welcome'|'graveyard'|'trophy') => {
    try {
      const hs: any = (window as any).__HomeStage
      hs?.runScene?.(kind)
    } catch (e) { console.warn('runScene failed', e) }
  }

  return (
    <div style={{ position:'fixed', right: 12, top: 12, zIndex: 99999, fontFamily:'ui-sans-serif', color:'#e5e7eb' }}>
      <div style={{ background:'#0b0c12', border:'1px solid #1f2937', borderRadius:8, padding:12, width: 280 }}>
        <div style={{ fontWeight:700, marginBottom:8 }}>Debug Panel</div>
        <div style={{ fontSize:12, opacity:0.8, marginBottom:8 }}>FX disabled</div>
        <div style={{ fontSize:12, opacity:0.9, marginTop:12 }}>Scenes</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:6 }}>
          <button onClick={() => run('welcome')} style={{ padding:'6px 8px', background:'#065f46', borderRadius:6 }}>Welcome</button>
          <button onClick={() => run('graveyard')} style={{ padding:'6px 8px', background:'#4c1d95', borderRadius:6 }}>Graveyard</button>
          <button onClick={() => run('trophy')} style={{ padding:'6px 8px', background:'#a16207', borderRadius:6 }}>Trophy</button>
        </div>
      </div>
    </div>
  )
}
