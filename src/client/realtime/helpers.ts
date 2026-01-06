"use client"

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { featuresConfig } from '@/src/config/features'

export type ChannelRetryOptions = {
  onSubscribed?: () => void
  onError?: (status: string, error: unknown) => void
}

/**
 * Subscribes to a Supabase realtime channel and automatically retries when the channel
 * errors, times out, or closes. Retries are paused while the browser is offline.
 */
export function attachChannelWithRetry(
  supabase: SupabaseClient,
  label: string,
  buildChannel: () => RealtimeChannel,
  options: ChannelRetryOptions = {},
): () => void {
  let channel: RealtimeChannel | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let onlineHandler: (() => void) | null = null
  let visHandler: (() => void) | null = null
  let unsubscribed = false

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const clearOnlineHandler = () => {
    if (onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', onlineHandler)
      onlineHandler = null
    }
  }

  const clearChannel = () => {
    if (!channel) return
    try {
      void supabase.removeChannel(channel)
    } catch {}
    try {
      void channel.unsubscribe?.()
    } catch {}
    channel = null
  }

  const scheduleRetry = () => {
    if (unsubscribed) return
    clearRetryTimer()
    clearOnlineHandler()
    // Defer while hidden
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (!visHandler && typeof document !== 'undefined') {
        visHandler = () => {
          if (document.visibilityState === 'visible') {
            if (visHandler) document.removeEventListener('visibilitychange', visHandler)
            visHandler = null
            subscribe()
          }
        }
        document.addEventListener('visibilitychange', visHandler)
      }
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (typeof window !== 'undefined' && !onlineHandler) {
        onlineHandler = () => {
          onlineHandler = null
          if (unsubscribed) return
          subscribe()
        }
        window.addEventListener('online', onlineHandler)
      }
      return
    }

    retryTimer = setTimeout(() => {
      retryTimer = null
      if (unsubscribed) return
      subscribe()
    }, 2000)
  }

  const subscribe = () => {
    if (unsubscribed) return
    clearOnlineHandler()
    clearChannel()
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      scheduleRetry()
      return
    }
    channel = buildChannel()
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        options.onSubscribed?.()
        if (featuresConfig.realtimeDebug) {
          console.info(`${label} SUBSCRIBED`, {
            online: typeof navigator === 'undefined' ? true : navigator.onLine,
          })
        }
        return
      }
      if (status === 'CHANNEL_ERROR') {
        console.error(`${label} CHANNEL_ERROR`, error)
        options.onError?.(status, error)
        scheduleRetry()
      } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
        if (featuresConfig.realtimeDebug) {
          console.warn(`${label} ${status.toLowerCase()}`)
        }
        options.onError?.(status, error)
        scheduleRetry()
      } else {
        if (featuresConfig.realtimeDebug) {
          console.log(`${label} status`, status)
        }
      }
    })
  }

  subscribe()

  return () => {
    unsubscribed = true
    clearRetryTimer()
    clearOnlineHandler()
    if (visHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visHandler)
      visHandler = null
    }
    clearChannel()
  }
}
