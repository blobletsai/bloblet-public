"use client"

import { useEffect, useMemo, useState } from 'react'
import { supaAnon } from '@/src/server/supa'
import { useOnlineStatus } from '@/src/client/hooks/useOnlineStatus'
import { attachChannelWithRetry } from '@/src/client/realtime/helpers'
import { useSession } from '@/src/client/hooks/useSession'

export type OrderRow = {
  id: number
  address: string
  address_canonical?: string | null
  address_cased?: string | null
  type: string
  params: any
  status: string
  reason?: string | null
  tx_hash: string | null
  created_at?: string
  confirmed_at?: string | null
  applied_at?: string | null
}

export function useOrderById(id: number | null) {
  const [row, setRow] = useState<OrderRow | null>(null)
  const isOnline = useOnlineStatus()
  const session = useSession()
  useEffect(() => {
    if (!id || !isOnline || !session.verified || !session.supabaseAccessToken || !session.address) return
    let cancelled = false
    const supa = supaAnon()
    ;(async () => {
      try {
        const { data } = await supa.from('orders').select('*').eq('id', id).maybeSingle()
        if (!cancelled && data) setRow(data as any)
      } catch {}
    })()
    const cleanupChannel = attachChannelWithRetry(
      supa,
      `[Realtime] order:${id}`,
      () =>
        supa
          .channel('realtime:order:' + id)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload: any) => {
            setRow(payload?.new as any)
          }),
    )
    return () => {
      cancelled = true
      cleanupChannel()
    }
  }, [id, isOnline, session.address, session.supabaseAccessToken, session.verified])
  return row
}
