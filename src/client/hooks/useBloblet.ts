"use client"

import { useEffect, useState } from 'react'
import { supaAnon } from '@/src/server/supa'
import { useOnlineStatus } from '@/src/client/hooks/useOnlineStatus'
import { attachChannelWithRetry } from '@/src/client/realtime/helpers'
import { deriveAddressKeys } from '@/src/shared/address/keys'
import { featuresConfig } from '@/src/config/features'
import { useSession } from '@/src/client/hooks/useSession'

const CHAIN_KIND: 'sol' = 'sol'

export type BlobletRow = {
  address: string
  name: string | null
  is_alive: boolean
  tier?: 'top' | 'middle' | 'bottom' | null
}

export function useBloblet(address: string, initial?: Partial<BlobletRow>) {
  const { canonical } = deriveAddressKeys(address, { chainKind: CHAIN_KIND })
  const addr = canonical
  const session = useSession()
  const DEBUG = featuresConfig.canvasDebug
  const [row, setRow] = useState<BlobletRow | null>(addr
    ? {
        address: addr,
        name: (initial?.name ?? null) as any,
        is_alive: Boolean(initial?.is_alive ?? false),
        tier: (initial?.tier as any) ?? null,
      }
    : null,
  )
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (!addr || !isOnline) return
    if (!session.supabaseAccessToken || !session.address) return
    if (session.address !== addr) {
      setRow(null)
      return
    }
    let cancelled = false
    const supa = supaAnon()
    ;(async () => {
      try {
        const { data } = await supa
          .from('bloblets')
          .select('address,address_canonical,address_cased,chain_kind,name,is_alive,tier')
          .eq('chain_kind', CHAIN_KIND)
          .eq('address_canonical', addr)
          .maybeSingle()
        if (DEBUG) console.info('[RT] hook initial fetch', { addr, found: !!data })
        if (!cancelled) {
          if (data) {
            setRow({
              address: addr,
              name: (data as any).name ?? null,
              is_alive: !!(data as any).is_alive,
              tier: (data as any).tier ?? null,
            })
          } else {
            setRow(null)
          }
        }
      } catch {}
    })()

    const cleanupChannel = attachChannelWithRetry(
      supa,
      `[RT] hook bloblet ${addr.slice(0, 8)}`,
      () =>
        supa
          .channel('hook-bloblet-' + addr.slice(0, 8))
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bloblets',
              filter: `address_canonical=eq.${addr}`,
            },
            (payload: any) => {
              if (DEBUG) {
                console.info('[RT] hook event', {
                  table: payload?.table,
                  event: payload?.eventType,
                  newAddr: payload?.new?.address || null,
                  oldAddr: payload?.old?.address || null,
                  keys: Object.keys(payload?.new || {}),
                  name: payload?.new?.name,
                })
              }
              const eventType = String(payload?.eventType || '').toUpperCase()
              if (eventType === 'DELETE') {
                setRow(null)
                return
              }
              const nw = payload?.new || {}
              if ((nw.chain_kind || CHAIN_KIND) !== CHAIN_KIND) return
              setRow((prev) => ({
                address: addr,
                name: nw.name ?? prev?.name ?? null,
                is_alive: Boolean(nw.is_alive ?? prev?.is_alive),
                tier: (nw.tier ?? prev?.tier ?? null) as any,
              }))
            },
          ),
      {
        onSubscribed: () => {
          if (DEBUG) {
            console.info('[RT] hook subscribed', { channel: 'hook-bloblet-' + addr.slice(0, 8), addr })
          }
        },
        onError: (status, error) => {
          if (DEBUG) {
            console.error('[RT] hook channel error', status, error)
          }
        },
      },
    )

    return () => {
      cancelled = true
      cleanupChannel()
    }
  }, [addr, DEBUG, isOnline, session.address, session.supabaseAccessToken])

  return row
}
