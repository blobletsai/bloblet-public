"use client"

import { useCallback, useEffect, useState, memo } from 'react'
import type { PersonaBloblet, PersonaSession } from '@/src/client/persona/types'

type PersonaSocialHandleCardProps = {
  bloblet: PersonaBloblet | null
  session: PersonaSession
  onRefresh: () => Promise<void> | void
}

const PersonaSocialHandleCardComponent: React.FC<PersonaSocialHandleCardProps> = ({
  bloblet,
  session,
  onRefresh,
}) => {
  const [handle, setHandle] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setHandle(bloblet?.socialHandle ?? '')
  }, [bloblet?.socialHandle])

  const handleSave = useCallback(async () => {
    if (!session.address) {
      setError('Connect wallet first.')
      return
    }
    
    const trimmed = handle.trim()
    if (trimmed.length > 32) {
      setError('Handle too long (max 32 characters).')
      return
    }
    
    setSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      const resp = await fetch('/api/player/update-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: trimmed }),
      })
      
      const json = await resp.json().catch(() => null)
      
      if (!resp.ok) {
        setError(json?.error || 'Update failed.')
        return
      }

      setNotice('Social handle updated.')
      await onRefresh()
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [handle, onRefresh, session.address])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[rgba(148,93,255,0.25)] bg-[rgba(8,2,30,0.55)] p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] uppercase tracking-[0.1em] text-fantasy-muted">
              Social Handle
            </label>
            <span className="text-[10px] text-[#7dffcf]">FREE</span>
          </div>
          <p className="text-[10px] text-fantasy-muted/80">
            Displayed above your character. Use your Twitter/X or Discord handle so others can find you.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 select-none">@</span>
            <input
              type="text"
              maxLength={32}
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value)
                setError(null)
                setNotice(null)
              }}
              placeholder="username"
              className="w-full rounded-lg border border-[rgba(140,105,255,0.35)] bg-[rgba(4,0,20,0.65)] py-2 pl-7 pr-3 text-sm text-white placeholder-white/20"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-fantasy text-[11px] px-6"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save Handle'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[18px] border border-red-400/40 bg-red-900/40 px-4 py-3 text-[11px] text-red-100">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-[18px] border border-[rgba(125,255,207,0.35)] bg-[rgba(32,96,72,0.45)] px-4 py-3 text-[11px] text-[#7dffcf]">
          {notice}
        </div>
      )}
    </div>
  )
}

export const PersonaSocialHandleCard = memo(PersonaSocialHandleCardComponent)
