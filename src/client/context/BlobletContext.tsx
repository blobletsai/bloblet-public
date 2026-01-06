"use client"

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { supaAnon } from '@/src/server/supa'
import { useOnlineStatus } from '@/src/client/hooks/useOnlineStatus'
import { attachChannelWithRetry } from '@/src/client/realtime/helpers'
import { deriveAddressKeys } from '@/src/shared/address/keys'
import { useSession } from '@/src/client/hooks/useSession'

const CHAIN_KIND: 'sol' = 'sol'

export type BlobletRow = {
  address: string
  name: string | null
  social_handle: string | null
  is_alive: boolean
  tier?: 'top' | 'middle' | 'bottom' | null
}

const BlobletCtx = createContext<BlobletRow | null>(null)

export function useBlobletCtx() {
  return useContext(BlobletCtx)
}

export function BlobletProvider({ address, initial, children }: { address: string; initial?: Partial<BlobletRow>; children: ReactNode }) {
  const session = useSession()
  const supa = useMemo(() => supaAnon(), [])
  const { canonical } = useMemo(() => deriveAddressKeys(address, { chainKind: CHAIN_KIND }), [address])
  const addr = canonical
  const [row, setRow] = useState<BlobletRow | null>({
    address: addr,
    name: (initial?.name ?? null) as any,
    social_handle: (initial?.social_handle ?? null) as any,
    is_alive: Boolean(initial?.is_alive ?? false),
    tier: (initial?.tier as any) ?? null,
  })
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (!addr || !isOnline) return
    if (!session.supabaseAccessToken || !session.address) return
    if (session.address !== addr) {
      setRow(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supa
          .from('bloblets')
          .select('address,address_canonical,address_cased,chain_kind,name,social_handle,is_alive,tier')
          .eq('chain_kind', CHAIN_KIND)
          .eq('address_canonical', addr)
          .maybeSingle()
        if (!cancelled) {
          if (data) {
            setRow({
              address: addr,
              name: (data as any).name ?? null,
              social_handle: (data as any).social_handle ?? null,
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
      '[BlobletContext] bloblet channel',
      () =>
        supa
          .channel('realtime:bloblet:' + addr)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bloblets', filter: `address_canonical=eq.${addr}` }, (payload: any) => {
            const eventType = String(payload?.eventType || '').toUpperCase()
            if (eventType === 'DELETE') {
              setRow(null)
              return
            }
            const nw = payload?.new || {}
            if ((nw.chain_kind || CHAIN_KIND) !== CHAIN_KIND) return
            setRow(prev => ({
              address: addr,
              name: (nw.name ?? prev?.name ?? null),
              social_handle: (nw.social_handle ?? prev?.social_handle ?? null),
              is_alive: Boolean(nw.is_alive ?? prev?.is_alive),
              tier: (nw.tier ?? prev?.tier ?? null) as any,
            }))
          }),
    )
    return () => {
      cancelled = true
      cleanupChannel()
    }
  }, [addr, supa, isOnline, session.address, session.supabaseAccessToken])

  return <BlobletCtx.Provider value={row}>{children}</BlobletCtx.Provider>
}
