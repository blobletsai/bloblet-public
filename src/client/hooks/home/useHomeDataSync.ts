"use client"

import { useEffect } from 'react'

import { logVisibilityDebug } from '@/src/shared/pvp/visibilityDebug'
import { supaAnon } from '@/src/server/supa'
import type { HomePageProps } from '@/src/server/services/homePage'
import type { SessionState } from '@/src/client/hooks/useSession'

type UseHomeDataSyncParams = {
  bloblets: HomePageProps['bloblets']
  maskedLoadouts: HomePageProps['loadouts']
  pvpItems: HomePageProps['pvpItems']
  battles: HomePageProps['battles']
  session: SessionState
  sharedDeadSprite: string | null
  clientChainKind: 'sol'
}

export function useHomeDataSync({
  bloblets,
  maskedLoadouts,
  pvpItems,
  battles,
  session,
  sharedDeadSprite,
  clientChainKind,
}: UseHomeDataSyncParams) {
  useEffect(() => {
    if (!session.address || !session.verified || typeof window === 'undefined') return
    try { (window as any).BlobletsWorld_setMyAddress?.(session.address, session.address) } catch {}
  }, [session.address, session.verified])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const viewer = (session.address || '').trim()
    if (!viewer) return
    const mine = (maskedLoadouts || []).filter((entry) => {
      const addr = String((entry as any).bloblet_address || (entry as any).address || '').trim()
      return addr === viewer
    })
    if (!mine.length) return
    logVisibilityDebug('ssr loadout', {
      viewer,
      loadouts: mine.map((entry) => ({
        address: (entry as any).bloblet_address || (entry as any).address || null,
        weapon_item_id: (entry as any).weapon_item_id ?? null,
        shield_item_id: (entry as any).shield_item_id ?? null,
        weapon: (entry as any).weapon || null,
        shield: (entry as any).shield || null,
        masked: (entry as any).masked === true,
      })),
    })
  }, [maskedLoadouts, session.address])

  useEffect(() => {
    let cancelled = false
    const mapped = (bloblets || []).map((b) => {
      const rewardBalanceRaw = (b as any).reward_balance
      const rewardBalance =
        rewardBalanceRaw != null && Number.isFinite(Number(rewardBalanceRaw))
          ? Number(rewardBalanceRaw)
          : null
      const fallbackBalance =
        typeof b.balance === 'number' && Number.isFinite(b.balance)
          ? b.balance
          : typeof b.percent === 'number' && isFinite(b.percent)
            ? Math.max(0, b.percent)
            : (b.rank ?? 0) > 0
              ? 1 / Math.max(1, Number(b.rank))
              : 0
      return {
        address: String(b.address || ''),
        addressCased: (b as any).address_cased || b.address,
        balance: rewardBalance ?? fallbackBalance,
        rewardBalance,
        is_alive: b.is_alive === true,
        name: b.name || undefined,
        socialHandle: (b as any).social_handle || (b as any).socialHandle || undefined,
        avatar_alive_url_256: b.avatar_alive_url_256 || undefined,
        dead_url: sharedDeadSprite || undefined,
        entity_type: (b as any).entity_type || 'bloblet',
        anchor_x: (b as any).anchor_x || undefined,
        anchor_y: (b as any).anchor_y || undefined,
        z: (b as any).z || undefined,
        scale: (b as any).scale || undefined,
        prop_type: (b as any).prop_type || undefined,
        prop_id: (b as any).prop_id != null ? Number((b as any).prop_id) : null,
        rename_count:
          (b as any).rename_count != null ? Number((b as any).rename_count) : null,
        size_multiplier: (b as any).size_multiplier || undefined,
        last_owner: (b as any).last_owner || undefined,
      }
    })
    try { (window as any).BlobletsWorld_snapshotRequested = true } catch {}
    const start = performance.now()
    const tryApply = async () => {
      if (cancelled) return
      const fn = (window as any).BlobletsWorld_applySnapshot as undefined | ((h: any[]) => Promise<void> | void)
      if (typeof fn === 'function') {
        console.log('[Home] Applying SSR snapshot with', mapped.length, 'holders')
        try {
          await fn(mapped)
          console.log('[Home] SSR snapshot applied successfully')
        } catch (e) {
          console.warn('[Home] applySnapshot error', e)
        }
        return
      }
      if (performance.now() - start < 4000) {
        setTimeout(tryApply, 50)
      } else {
        console.warn('[Home] BlobletsWorld_applySnapshot not available after 4s')
      }
    }
    tryApply()
    return () => { cancelled = true }
  }, [bloblets, sharedDeadSprite])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const payload = { loadouts: maskedLoadouts || [], items: pvpItems || [] }
    const start = performance.now()
    const attempt = () => {
      if (cancelled) return
      const fn = (window as any).BlobletsWorld_applyLoadouts
      if (typeof fn === 'function') {
        try { fn(payload) } catch {}
        return
      }
      if (performance.now() - start < 4000) {
        setTimeout(attempt, 60)
      }
    }
    attempt()
    return () => { cancelled = true }
  }, [maskedLoadouts, pvpItems])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const start = performance.now()
    const attempt = () => {
      if (cancelled) return
      const fn = (window as any).BlobletsWorld_applyBattles
      if (typeof fn === 'function') {
        try { fn(battles || []) } catch {}
        return
      }
      if (performance.now() - start < 4000) {
        setTimeout(attempt, 60)
      }
    }
    attempt()
    return () => { cancelled = true }
  }, [battles])

  useEffect(() => {
    if ((bloblets || []).length > 0) return
    if (!session.supabaseAccessToken || !session.address || !session.verified) return
    let cancelled = false
    const run = async () => {
      try {
        const supa = supaAnon()
        const { data: holder } = await supa
          .from('token_holders')
          .select('address,address_cased,address_canonical,rank,percent, bloblets(is_alive,name,social_handle,tier,avatar_alive_url_256,address_cased,anchor_x,anchor_y,entity_type,prop_type,prop_id,rename_count,last_owner)')
          .eq('chain_kind', clientChainKind)
          .eq('address_canonical', session.address)
          .maybeSingle()

        const { data: balanceRow } = await supa
          .from('reward_balances_self')
          .select('address,balance')
          .maybeSingle()

        const mappedSource = holder ? [holder] : []
        const mapped = mappedSource.map((row: any) => {
          const bl = Array.isArray(row.bloblets) ? (row.bloblets[0] || {}) : (row.bloblets || {})
          const address = String(row.address_canonical || row.address || session.address || '').trim()
          const balanceCandidate = balanceRow?.balance != null ? Number(balanceRow.balance) : null
          const rewardBalance =
            balanceCandidate != null && Number.isFinite(balanceCandidate) ? balanceCandidate : null
          const fallbackBalance =
            typeof row.percent === 'number' && isFinite(row.percent)
              ? Math.max(0, row.percent)
              : (row.rank ?? 0) > 0
                ? 1 / Math.max(1, Number(row.rank))
                : 0
          return {
            address,
            addressCased: (row.address_cased || bl.address_cased || row.address) as any,
            balance: rewardBalance ?? fallbackBalance,
            rewardBalance,
            is_alive: bl.is_alive === true,
            name: bl.name || undefined,
            socialHandle: bl.social_handle || undefined,
            avatar_alive_url_256: bl.avatar_alive_url_256 || undefined,
            dead_url: sharedDeadSprite || undefined,
            anchor_x: bl.anchor_x || undefined,
            anchor_y: bl.anchor_y || undefined,
            entity_type: bl.entity_type || 'bloblet',
            prop_type: bl.prop_type || null,
            prop_id: bl.prop_id != null ? Number(bl.prop_id) : null,
            rename_count: bl.rename_count != null ? Number(bl.rename_count) : undefined,
            last_owner: bl.last_owner || null,
          }
        })
        try { (window as any).BlobletsWorld_snapshotRequested = true } catch {}
        if (!cancelled && mapped.length) {
          const fn = (window as any).BlobletsWorld_applySnapshot as undefined | ((h: any[]) => Promise<void> | void)
          if (typeof fn === 'function') {
            await fn(mapped)
            console.log('[Home] Client-side fallback snapshot applied')
          }
        }
      } catch (e) {
        console.warn('[Home] Client-side fallback fetch failed', e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [bloblets, session.address, session.supabaseAccessToken, session.verified, clientChainKind, sharedDeadSprite])

  useEffect(() => {
    try {
      const id = (window as any).__NEXT_DATA__?.buildId || 'unknown'
      console.log('[Home] Build ID:', id)
    } catch {}
  }, [])
}
