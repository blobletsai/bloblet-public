"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { featuresConfig } from '@/src/config/features'

type Audience = 'player' | 'team'
type ChatTurn = { role: 'user' | 'assistant'; content: string }

type Props = {
  audience?: Audience
  bottomOffset?: number
  staticPosition?: boolean
}

const STORAGE_KEY = 'help_conversation_id'
const OPEN_KEY = 'help_widget_open'
const SHOW_SOURCES = featuresConfig.helpShowSources
const ONE_SHOT_MODE = featuresConfig.helpOneShot

export const ChatWidget: React.FC<Props> = ({ audience = 'player', bottomOffset = 24, staticPosition = false }) => {
  const oneShot = ONE_SHOT_MODE
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const panelStyle = useMemo(() => ({ bottom: `${bottomOffset}px` }), [bottomOffset])
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Instrumentation: mount/unmount stamps to diagnose remounts during realtime updates
  useEffect(() => {
    try { console.debug('[HelpWidget] mount') } catch {}
    return () => { try { console.debug('[HelpWidget] unmount') } catch {} }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedConv = oneShot ? null : window.localStorage.getItem(STORAGE_KEY)
    const savedOpen = window.localStorage.getItem(OPEN_KEY)
    if (savedConv) setConversationId(savedConv)
    if (savedOpen === '1') setOpen(true)
  }, [oneShot])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [open, turns])

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return
    setError(null)
    setLoading(true)
    try { console.debug('[HelpWidget] send:start', { len: msg.length }) } catch {}
    setTurns((t) => [...t, { role: 'user', content: msg }])
    setInput('')
    try {
      const t0 = Date.now()
      const res = await fetch('/api/help/chat_vstore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ conversationId: oneShot ? null : conversationId, audience, message: msg }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || (json as any).error) {
        throw new Error((json as any).detail || (json as any).error || 'failed')
      }
      // Strip any model-emitted Sources line and render only mapped public sources from API
      const raw = String(json.reply || '')
      const cleaned = raw.replace(/\n?\s*Sources:\s*[\s\S]*$/i, '').trimEnd()
      const mappedSources: string[] = Array.isArray((json as any).sources) ? (json as any).sources : []
      const reply = SHOW_SOURCES && mappedSources.length ? `${cleaned}\nSources: ${mappedSources.slice(0, 2).join(', ')}` : cleaned
      try {
        const u = (json as any).usage || {}
        console.debug('[HelpWidget] send:ok', { elapsedMs: Date.now() - t0, it: u.input_tokens || 0, ot: u.output_tokens || 0 })
      } catch {}
      const nextId = String(json.conversationId || '')
      setConversationId(oneShot ? null : (nextId || null))
      if (!oneShot && typeof window !== 'undefined' && nextId) window.localStorage.setItem(STORAGE_KEY, nextId)
      setTurns((t) => [...t, { role: 'assistant', content: reply }])
    } catch (e: any) {
      try { console.debug('[HelpWidget] send:fail', { message: e?.message || String(e) }) } catch {}
      setError(e?.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={staticPosition ? 'relative' : ''}>
      {/* Floating bubble */}
      <button
        type="button"
        className={`${staticPosition ? 'relative' : 'fixed right-6'} z-40 grid h-12 w-12 place-items-center rounded-full border border-[rgba(148,93,255,0.45)] bg-[rgba(16,6,40,0.95)] text-[16px] text-[#d7caff] shadow-[0_18px_48px_rgba(12,2,28,0.6)] hover:bg-[rgba(26,10,62,0.95)]`}
        style={staticPosition ? {} : panelStyle}
        onClick={() => setOpen((v) => !v)}
        title="Help"
        aria-label="Help"
      >
        {open ? '×' : '?'}
      </button>

      {/* Panel */}
      {open ? (
        <div
          className={`${staticPosition ? 'absolute right-0 bottom-14' : 'fixed right-6'} z-40 w-[360px] max-w-[calc(100vw-48px)] rounded-[20px] border border-[rgba(148,93,255,0.45)] bg-[rgba(16,6,40,0.98)] shadow-[0_28px_72px_rgba(12,2,28,0.65)]`}
          style={staticPosition ? {} : { bottom: `${bottomOffset + 56}px` }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="font-pressstart pixel-tiny uppercase tracking-[0.2em] text-[#8ff7ff]">{oneShot ? 'Quick Help (one‑shot)' : 'Help'}</div>
            <button type="button" className="btn-fantasy-ghost px-2 py-0.5" onClick={() => setOpen(false)}>×</button>
          </div>
          <div ref={scrollerRef} className="max-h-[360px] overflow-y-auto px-4 py-2 text-[12px] text-white/90">
            {turns.length === 0 ? (
              <div className="text-[#c7b5ff]">Ask a question about gameplay, rewards, Nourish, or personalization{oneShot ? ' — one question at a time.' : '.'}</div>
            ) : (
              turns.map((t, i) => (
                <div key={i} className={`mt-2 ${t.role === 'user' ? 'text-[#ffe780]' : 'text-white/90'}`}>
                  {t.role === 'assistant' ? <MessageRender text={t.content} /> : <div>{t.content}</div>}
                </div>
              ))
            )}
            {error ? (
              <div className="mt-2 rounded-[12px] border border-red-400/40 bg-red-900/40 px-2 py-1 text-red-100">{error}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 border-t border-[rgba(148,93,255,0.3)] px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }}
              placeholder="Type your question…"
              className="flex-1 rounded-[12px] border border-[rgba(148,93,255,0.35)] bg-[rgba(28,12,72,0.8)] px-3 py-2 text-[12px] text-white outline-none"
            />
            <button type="button" className="btn-fantasy px-3 py-2 text-[12px]" onClick={send} disabled={loading}>{loading ? '…' : 'Send'}</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MessageRender({ text }: { text: string }) {
  try {
    const lines = String(text || '').split(/\r?\n/)
    const bulletLines = lines.filter((l) => /^\s*[-*]\s+/.test(l))
    const srcLine = lines.find((l) => /^\s*Sources:/i.test(l)) || ''
    if (bulletLines.length >= 2) {
      const bullets = bulletLines.map((l) => l.replace(/^\s*[-*]\s+/, ''))
      const links = srcLine.replace(/^\s*Sources:\s*/i, '').split(/,\s*/).filter(Boolean)
      return (
        <div>
          <ul className="list-disc pl-5">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          {links.length ? (
            <div className="mt-1 text-[11px] text-[#aee]">
              Sources:{' '}
              {links.slice(0, 2).map((u, i) => (
                <a key={i} className="underline mr-2" href={u} target="_blank" rel="noopener noreferrer">{u}</a>
              ))}
            </div>
          ) : null}
        </div>
      )
    }
    // Fallback: preserve newlines for plain paragraphs
    return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
  } catch {
    return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
  }
}
