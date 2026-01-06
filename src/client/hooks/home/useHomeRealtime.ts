"use client"

import { useEffect } from 'react'

import { CLIENT_EVENT } from '@/src/client/events/clientEventMap'
import type { useClientEventBus } from '@/src/client/events/useClientEventBus'
import { attachChannelWithRetry } from '@/src/client/realtime/helpers'
import type { SessionState } from '@/src/client/hooks/useSession'
import { supaAnon } from '@/src/server/supa'

type ClientEventBus = ReturnType<typeof useClientEventBus>

type UseHomeRealtimeParams = {
  isOnline: boolean
  session: SessionState
  clientChainKind: 'sol'
  sharedDeadSprite: string | null
  eventBus: ClientEventBus
  setCountdownSeconds: (value: number | null) => void
  setToast: (value: string | null) => void
}

export function useHomeRealtime({
  isOnline,
  session,
  clientChainKind,
  sharedDeadSprite,
  eventBus,
  setCountdownSeconds,
  setToast,
}: UseHomeRealtimeParams) {
  useEffect(() => {
    if (!isOnline || !session.address || !session.supabaseAccessToken) return
    const supa = supaAnon()

    const cleanupUpdateChannel = attachChannelWithRetry(
      supa,
      '[Realtime] Bloblets UPDATE channel',
      () =>
        supa
          .channel('rt:bloblets:update')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bloblets', filter: `address_canonical=eq.${session.address}` }, async (payload: any) => {
            try {
              console.info('[Realtime] bloblets UPDATE payload', {
                newKeys: Object.keys(payload?.new || {}),
                oldKeys: Object.keys(payload?.old || {}),
                commit: payload?.commit_timestamp,
              })
              const chain =
                payload?.new?.chain_kind || payload?.old?.chain_kind || clientChainKind
              if (chain !== clientChainKind) {
                console.info('[Realtime] bloblets UPDATE skipped (chain mismatch)', {
                  chain,
                  expected: clientChainKind,
                })
                return
              }
              const addrRaw =
                payload?.new?.address_canonical ||
                payload?.new?.address ||
                payload?.old?.address_canonical ||
                payload?.old?.address ||
                ''
              const addr = String(addrRaw || '').trim()
              if (!addr) {
                console.warn('[Realtime] bloblets UPDATE missing address', {
                  payload,
                })
                return
              }

              const delta: any = { address: addr }
              let hasChange = false

              const oldAlive = !!(payload?.old?.is_alive)
              const newAlive = !!(payload?.new?.is_alive)
              if (oldAlive !== newAlive) {
                delta.alive = newAlive
                hasChange = true
              }

              const entityType = String(
                payload?.new?.entity_type ?? payload?.old?.entity_type ?? '',
              ).toLowerCase()
              const oldName = String(payload?.old?.name || '').trim()
              const newName = String(payload?.new?.name || '').trim()
              if (newName !== oldName) {
                delta.name = newName
                if (entityType === 'landmark') {
                  delta.landmarkName = newName
                }
                hasChange = true
              }

              const oldHandle = String(payload?.old?.social_handle || '').trim()
              const newHandle = String(payload?.new?.social_handle || '').trim()
              if (newHandle !== oldHandle) {
                delta.socialHandle = newHandle
                hasChange = true
              }

              const oldOwner = payload?.old?.last_owner ?? null
              const newOwner = payload?.new?.last_owner ?? null
              if (newOwner !== oldOwner) {
                const ownerCanonical = newOwner ? String(newOwner).trim() : null
                delta.ownerAddress = ownerCanonical
                delta.ownerAddressCased = newOwner || null
                hasChange = true
              }

              const oldRenameRaw = Number(payload?.old?.rename_count ?? NaN)
              const newRenameRaw = Number(payload?.new?.rename_count ?? NaN)
              if (Number.isFinite(newRenameRaw)) {
                if (!Number.isFinite(oldRenameRaw) || newRenameRaw !== oldRenameRaw) {
                  delta.renameCount = newRenameRaw
                  hasChange = true
                }
              }

              const oldPriceRaw = Number(payload?.old?.landmark_price_rp ?? NaN)
              const newPriceRaw = Number(payload?.new?.landmark_price_rp ?? NaN)
              if (Number.isFinite(newPriceRaw)) {
                if (!Number.isFinite(oldPriceRaw) || newPriceRaw !== oldPriceRaw) {
                  delta.landmarkPrice = newPriceRaw
                  hasChange = true
                }
              }

              const newPropId = Number(
                payload?.new?.prop_id ?? payload?.old?.prop_id ?? 0,
              )
              if (Number.isFinite(newPropId) && newPropId > 0) {
                delta.propId = newPropId
                hasChange = true
              }

              if (!hasChange) {
                console.info('[Realtime] bloblets UPDATE no meaningful changes', { address: addr })
                return
              }
              const applyDelta = (window as any).BlobletsWorld_applyDelta
              if (typeof applyDelta === 'function') {
                console.info('[Realtime] bloblets UPDATE applying delta', delta)
                applyDelta([delta])
              } else {
                console.warn('[Realtime] bloblets UPDATE missing applyDelta')
              }
            } catch (e) {
              console.warn('[Realtime] update handler error', e)
            }
          }),
    )

    const cleanupInsertChannel = attachChannelWithRetry(
      supa,
      '[Realtime] Bloblets INSERT channel',
      () =>
        supa
          .channel('rt:bloblets:insert')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bloblets', filter: `address_canonical=eq.${session.address}` }, async (payload: any) => {
            try {
              console.info('[Realtime] bloblets INSERT payload', {
                newKeys: Object.keys(payload?.new || {}),
                commit: payload?.commit_timestamp,
              })
              const chain = payload?.new?.chain_kind || clientChainKind
              if (chain !== clientChainKind) {
                console.info('[Realtime] bloblets INSERT skipped (chain mismatch)', {
                  chain,
                  expected: clientChainKind,
                })
                return
              }
              const addr = String(payload?.new?.address_canonical || payload?.new?.address || '').trim()
              if (!addr) {
                console.warn('[Realtime] bloblets INSERT missing address', payload?.new)
                return
              }
              const { data: th } = await supa
                .from('token_holders')
                .select('rank')
                .eq('chain_kind', clientChainKind)
                .eq('address_canonical', addr)
                .maybeSingle()
              const rankValueRaw = (th as any)?.rank
              const rankNumber = rankValueRaw != null ? Number(rankValueRaw) : NaN
              const rank = Number.isFinite(rankNumber) ? rankNumber : null
              console.info('[Realtime] bloblets INSERT holder lookup', {
                address: addr,
                rank,
                recordFound: !!th,
              })
              if (
                rank != null &&
                (rank <= 0 || rank > 1000)
              ) {
                console.info('[Realtime] bloblets INSERT skipped (rank out of range)', {
                  address: addr,
                  rank,
                })
                return
              }
              const { data: bl } = await supa
                .from('bloblets')
                .select('is_alive,name,social_handle,avatar_alive_url_256,size_multiplier')
                .eq('chain_kind', clientChainKind)
                .eq('address_canonical', addr)
                .maybeSingle()
              if (!bl) {
                console.warn('[Realtime] bloblets INSERT missing bloblet row after fetch', {
                  address: addr,
                })
                return
              }
              const addFn = (window as any).BlobletsWorld_addSprites
              if (typeof addFn === 'function') {
                console.info('[Realtime] bloblets INSERT adding sprite', { address: addr })
                addFn([{
                  address: addr,
                  alive: !!bl.is_alive,
                  name: bl.name || undefined,
                  socialHandle: (bl as any).social_handle || undefined,
                  aliveUrl: bl.avatar_alive_url_256 || undefined,
                  deadUrl: sharedDeadSprite || undefined,
                  size_multiplier: bl.size_multiplier || undefined,
                }])
              } else {
                console.warn('[Realtime] bloblets INSERT missing addSprites')
              }
            } catch (e) { console.warn('[Realtime] insert handler error', e) }
          }),
    )

    return () => {
      cleanupUpdateChannel()
      cleanupInsertChannel()
    }
  }, [isOnline, session.address, session.supabaseAccessToken, clientChainKind, sharedDeadSprite])

  useEffect(() => {
    if (!eventBus) return
    const unsubscribe = eventBus.subscribe(CLIENT_EVENT.VERIFIED, (detail) => {
      try {
        const addr = typeof detail?.address === 'string' ? detail.address.trim() : ''
        const isHolder = detail?.isHolder !== false
        if (!addr || !isHolder) return
        const canonical = addr
        setCountdownSeconds(null)
        const ensureSpritePromise = (async (): Promise<boolean> => {
          try {
            const addFn = (window as any).BlobletsWorld_addSprites as undefined | ((adds: Array<{ address: string; alive: boolean; name?: string; socialHandle?: string; aliveUrl?: string; deadUrl?: string; size_multiplier?: number }>) => Promise<boolean> | boolean)
            const removePlaceholder = (window as any).BlobletsWorld_removePlaceholder as undefined | (() => Promise<boolean> | boolean)
            if (typeof addFn !== 'function') return false
            const supa = supaAnon()
            const { data: bl } = await supa
              .from('bloblets')
              .select('is_alive,name,social_handle,avatar_alive_url_256,size_multiplier')
              .eq('chain_kind', clientChainKind)
              .eq('address_canonical', canonical)
              .maybeSingle()
            const newlyAdded = !bl
            if (!bl) {
              await addFn([{ address: canonical, alive: true }])
            } else {
              await addFn([{
                address: canonical,
                alive: !!(bl as any).is_alive,
                name: (bl as any).name || undefined,
                socialHandle: (bl as any).social_handle || undefined,
                aliveUrl: (bl as any).avatar_alive_url_256 || undefined,
                deadUrl: sharedDeadSprite || undefined,
                size_multiplier: (bl as any).size_multiplier || undefined,
              }])
            }
            if (typeof removePlaceholder === 'function') {
              try { await removePlaceholder() } catch {}
            }
            return newlyAdded
          } catch {
            return true
          }
        })()
        let focused = false
        try { focused = !!(window as any).BlobletsWorld_focusOn?.(canonical, { zoom: 1.2, duration: 700 }) } catch {}
        if (!focused) {
          setTimeout(async () => {
            const expectCountdown = await ensureSpritePromise.catch(() => true)
            try {
              const ok = !!(window as any).BlobletsWorld_focusOn?.(canonical, { zoom: 1.2, duration: 600 })
              if (!ok && expectCountdown) {
                setCountdownSeconds(5 * 60)
                setToast(null)
              }
            } catch {
              if (expectCountdown) {
                setCountdownSeconds(5 * 60)
                setToast(null)
              }
            }
          }, 1500)
        } else {
          ensureSpritePromise.catch(() => {})
        }
      } catch {}
    })
    return unsubscribe
  }, [eventBus, setCountdownSeconds, setToast, clientChainKind, sharedDeadSprite])

  useEffect(() => {
    if (!eventBus) return
    const handleClearSession = () => { try { (window as any).BlobletsWorld_clearSession?.() } catch {} }
    const unsubLogout = eventBus.subscribe(CLIENT_EVENT.LOGOUT, handleClearSession)
    const unsubExpired = eventBus.subscribe(CLIENT_EVENT.SESSION_EXPIRED, () => handleClearSession())
    return () => {
      unsubLogout()
      unsubExpired()
    }
  }, [eventBus])
}
