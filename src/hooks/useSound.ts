"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { SOUND_ASSETS, type SoundKey } from '@/src/config/sounds'

// Global state for mute preference (simple singleton pattern for now)
let globalMute = false
const listeners = new Set<(muted: boolean) => void>()

const setGlobalMute = (muted: boolean) => {
  globalMute = muted
  if (typeof window !== 'undefined') {
    localStorage.setItem('bloblets_sound_muted', muted ? 'true' : 'false')
  }
  listeners.forEach(l => l(muted))
}

export function useSound() {
  const [muted, setMuted] = useState(globalMute)
  const audioCache = useRef<Map<SoundKey, HTMLAudioElement>>(new Map())

  useEffect(() => {
    // Sync with local storage on mount
    const stored = localStorage.getItem('bloblets_sound_muted')
    if (stored !== null) {
      const isMuted = stored === 'true'
      if (isMuted !== globalMute) setGlobalMute(isMuted)
    }

    const listener = (m: boolean) => {
      setMuted(m)
      // Mute/Unmute active audio instantly
      audioCache.current.forEach(audio => {
        audio.muted = m
      })
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  // Preload sounds
  useEffect(() => {
    Object.keys(SOUND_ASSETS).forEach((key) => {
      const k = key as SoundKey
      if (!audioCache.current.has(k)) {
        const audio = new Audio(SOUND_ASSETS[k])
        audio.volume = 0.4 // Default volume 40%
        
        // Special handling for background ambience loop
        if (k === 'bg_ambience') {
          audio.loop = true
        }
        
        audioCache.current.set(k, audio)
      }
    })
  }, [])

  const play = useCallback((key: SoundKey, volume = 0.4) => {
    const audio = audioCache.current.get(key) ?? new Audio(SOUND_ASSETS[key])
    if (!audioCache.current.has(key)) {
        if (key === 'bg_ambience') audio.loop = true
        audioCache.current.set(key, audio)
    }

    // If muted, we still "play" it but muted, or just return?
    // For SFX, we return. For loops (bg_ambience), we might want to start it so it's running when unmuted.
    // But simplest is to rely on audio.muted state.
    audio.muted = muted
    audio.volume = volume

    // Clone node allows overlapping sounds (rapid clicks)
    // But for loops like bg_ambience we MUST use the cached instance
    if (key !== 'bg_ambience') {
       audio.currentTime = 0
    }
    
    // Avoid re-playing if already playing loop
    if (key === 'bg_ambience' && !audio.paused) return

    audio.play().catch(() => {
      // Ignore autoplay errors (user hasn't interacted yet)
    })
  }, [muted])

  const toggleMute = useCallback(() => {
    setGlobalMute(!globalMute)
  }, [])

  return {
    play,
    muted,
    toggleMute,
    sounds: SOUND_ASSETS
  }
}