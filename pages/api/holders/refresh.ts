import type { NextApiRequest, NextApiResponse } from 'next'

import { appConfig } from '@/src/config/app'
import { holdersConfig } from '@/src/config/holders'
import { supaAdmin } from '@/src/server/supa'
import { getChainAdapter, resolveChainKind } from '@/src/server/chains'
import {
  buildTokenRowsFromSnapshot,
  fetchPrevRankedAddresses,
  fetchExistingTokenHolders,
  fetchExistingBloblets,
  fetchActiveVariants,
  upsertTokenHolders,
  clearDropoutRanks,
  insertNewBloblets,
  updateBlobletAnchors,
  markBlobletsAlive,
  shameDropouts,
  logRefreshEvent,
  findNewAddresses,
  toRowLookup,
  toAddressList,
  filterDropouts,
  type TokenRow,
} from '@/src/server/holders/supabase'
import { pickAppearance, getDefaultSpriteUrl } from '@/src/shared/appearance'
import { simConfigFromEnv, simulateSnapshot, computeRanksPercents } from '@/src/server/simulator'
import { solanaTokenDecimals } from '@/src/shared/points'
import { gateThresholdRaw } from '@/src/server/chains/gate'
import {
  deriveHolderLayout,
  type TokenRowInput,
} from '@/src/shared/holders/layout'
import { deriveAddressKeys } from '@/src/shared/address/keys'

const ENABLE_VERCEL_REFRESH = holdersConfig.enableVercelRefresh

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const force = String(req.query?.force ?? '').trim() === '1'
    // Internal auth: require CRON_SECRET when set
    const secret = holdersConfig.cronSecret
    const isProd = appConfig.isProduction
    const SIM_MODE = !isProd && holdersConfig.sim.enabled
    // Only treat requests with cron headers as scheduled
    // Accept both Vercel Cron and Supabase-triggered marker
    const isScheduled = Boolean(req.headers['x-vercel-cron'] || req.headers['x-supabase-cron'])
    if (secret && !isScheduled) {
      const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || ''
      if (hdr !== secret) return res.status(403).json({ error: 'forbidden' })
    }
    if (!ENABLE_VERCEL_REFRESH) {
      return res.status(410).json({ error: 'holders_refresh_route_disabled', hint: 'use Supabase holders-refresh function' })
    }

    const supa = supaAdmin()
    const chainKind = resolveChainKind()
    const chain = getChainAdapter(chainKind)
    const tokenDecimals = Number.isFinite(chain.metadata.tokenDecimals)
      ? Math.max(0, Math.floor(chain.metadata.tokenDecimals))
      : solanaTokenDecimals()
    
    // Debug: Log when cron triggers
    try {
      if (isScheduled) {
        console.log('[CRON] Scheduled tick at', new Date().toISOString(), 'method=', req.method)
      } else {
        console.log('[CRON] Non-scheduled invocation', { method: req.method, ua: req.headers['user-agent'] })
      }
    } catch {}

    // Soft lock: skip if a refresh ran recently (last 180s) to avoid overlaps
    try {
      const cutoffIso = new Date(Date.now() - 180_000).toISOString()
      const { data: recent } = await supa
        .from('events')
        .select('id,created_at')
        .eq('type', 'holders_refresh')
        .gte('created_at', cutoffIso)
        .limit(1)
      if (!force && recent && recent.length) {
        return res.status(202).json({ ok: true, skipped: 'recent_refresh' })
      }
    } catch {}

    // SIM_MODE already computed above
    let tokenRows: TokenRow[]
    let simSummary: any = null

    if (SIM_MODE) {
      let cfg = simConfigFromEnv()
      // Ensure visibly large churn if not configured via env
      const wantChurn = 0.12 // ~12% per minute
      const configuredChurn = holdersConfig.sim.churnRateOverride
      if (configuredChurn == null || configuredChurn < wantChurn) {
        cfg = { ...cfg, churnRate: wantChurn }
      }
      // Advance the simulation once per minute (idempotent within minute)
      const simTick = Math.floor(Date.now() / 60000)
      // Idempotency: skip if already processed
      try {
        const { data: exists } = await supa
          .from('events')
          .select('id')
          .eq('type', 'sim_tick')
          .contains('payload', { tick: simTick })
          .maybeSingle()
        if (exists) return res.status(200).json({ ok: true, sim: { skipped: true, tick: simTick } })
      } catch {}

      const { holders, prevHolders } = simulateSnapshot(cfg, simTick)
      const withRanks = computeRanksPercents(holders)
      const nowIso = new Date().toISOString()
      tokenRows = withRanks.map((r) => {
        const canonical = String(r.address || '').trim()
        return {
          address: canonical,
          address_canonical: canonical,
          address_cased: r.address,
          chain_kind: chainKind,
          balance: r.balanceRaw.toString(),
          percent: r.percent,
          rank: r.rank,
          updated_at: nowIso,
        } as TokenRow
      })

      const curSet = new Set(tokenRows.map(r => r.address_canonical || r.address))
      const outRows: TokenRow[] = []
      for (const ph of prevHolders) {
        const canonical = String(ph.address || '').trim()
        if (!canonical) continue
        if (!curSet.has(canonical)) outRows.push({
          address: canonical,
          address_canonical: canonical,
          address_cased: ph.address,
          chain_kind: chainKind,
          balance: '0',
          percent: 0,
          rank: null,
        })
      }
      if (outRows.length) tokenRows = tokenRows.concat(outRows)

      simSummary = {
        tick: simTick,
        count: cfg.count,
        outCount: outRows.length,
        supplyRaw: cfg.supplyRaw.toString(),
      }
      // Scene triggers: compute births/deaths volume for this tick
      try {
        const curSet = new Set(holders.map(h => String(h.address || '').trim()))
        const prevSet = new Set(prevHolders.map(h => String(h.address || '').trim()))
        let births = 0, deaths = 0
        for (const a of curSet) if (a && !prevSet.has(a)) births++
        for (const a of prevSet) if (a && !curSet.has(a)) deaths++

        // Burst-driven welcome/graveyard
        const wantVolume = 100
        const inserts: any[] = []
        if (births >= wantVolume) inserts.push({ type: 'scene_trigger', payload: { kind: 'welcome' }, severity: 1 })
        if (deaths >= wantVolume) inserts.push({ type: 'scene_trigger', payload: { kind: 'graveyard' }, severity: 1 })

        // Biggest interval buyers (hero trophy): compare percents between prev and current
        const prevRanked = computeRanksPercents(prevHolders)
        const prevPct = new Map(prevRanked.map(r => [String(r.address || '').trim(), r.percent]))
        const deltas = withRanks.map(r => ({
          address: String(r.address || '').trim(),
          deltaPct: Number((r.percent - (prevPct.get(String(r.address || '').trim()) || 0)).toFixed(4))
        }))
        deltas.sort((a,b) => (b.deltaPct - a.deltaPct))
        const minDelta = holdersConfig.sim.bigBuyDeltaPct
        const topBuyers = deltas.filter(d => d.deltaPct >= minDelta).slice(0, 3)
        if (topBuyers.length > 0) inserts.push({ type: 'scene_trigger', payload: { kind: 'trophy', topBuyers }, severity: 2 })

        // Text scene removed
        if (inserts.length) await supa.from('events').insert(inserts as any)
      } catch {}
    } else {
      const nowIso = new Date().toISOString()

      // Fetch live holders from the active chain adapter
      const thrEligible = gateThresholdRaw(tokenDecimals)
      console.log('[holders/refresh] fetchTopHolders start', {
        chainKind,
        tokenDecimals,
        thrEligible: thrEligible.toString(),
      })
      const items = await chain.fetchTopHolders?.(2000)
      const fetchSummary = {
        count: items ? items.length : 0,
        sample: items ? items.slice(0, 3).map((it) => ({
          address: it.address,
          balanceRaw: it.balanceRaw.toString(),
          decimals: it.balanceDecimals,
        })) : [],
      }
      console.log('[holders/refresh] fetchTopHolders result', fetchSummary)
      try {
        await supa.from('events').insert({
          type: 'holders_refresh_debug',
          severity: 0,
          payload: {
            stage: 'fetchTopHolders',
            chain_kind: chainKind,
            count: fetchSummary.count,
            sample: fetchSummary.sample,
          },
        } as any)
      } catch {}
      if (!items) throw new Error('holder snapshot not supported for chain')
      const holders = items.map((it) => ({
        address: String(it.address || ''),
        balanceRaw: typeof it.balanceRaw === 'bigint'
          ? it.balanceRaw
          : BigInt(it.balanceRaw || 0),
      }))
      const eligibleCount = holders.filter((entry) => entry.balanceRaw >= thrEligible).length
      console.log('[holders/refresh] threshold filter', {
        totalRows: holders.length,
        eligible: eligibleCount,
        thrEligible: thrEligible.toString(),
      })
      try {
        await supa.from('events').insert({
          type: 'holders_refresh_debug',
          severity: 0,
          payload: {
            stage: 'threshold',
            chain_kind: chainKind,
            total: holders.length,
            eligible: eligibleCount,
            threshold: thrEligible.toString(),
          },
        } as any)
      } catch {}
      tokenRows = buildTokenRowsFromSnapshot(holders, {
        chainKind,
        thresholdRaw: thrEligible,
        nowIso,
        limit: 2000,
      })

      // Event triggers (prod mode): compute births/deaths vs previous snapshot and insert scene triggers
      try {
        // Build previous snapshot maps (address -> alive? and address -> balance) using token_holders table
        const { data: prevList } = await supa
          .from('token_holders')
          .select('address,balance')
          .eq('chain_kind', chainKind)
          .order('rank', { ascending: true })
          .limit(3000)
        const prevMap = new Map<string, boolean>()
        const prevBalanceMap = new Map<string, bigint>()
        const thrRaw = gateThresholdRaw(tokenDecimals)
        for (const r of prevList || []) {
          const addr = String((r as any).address || '').trim()
          const bal = BigInt(String((r as any).balance ?? '0'))
          prevMap.set(addr, bal >= thrRaw)
          prevBalanceMap.set(addr, bal)
        }
        const curSet = new Set(tokenRows.map(r => r.address))
        let births = 0, deaths = 0
        for (const r of tokenRows) {
          const prevAlive = prevMap.get(r.address)
          if (prevAlive === false) births++
        }
        for (const [addr, wasAlive] of prevMap) {
          if (wasAlive && !curSet.has(addr)) deaths++
        }
        const birthThreshold = holdersConfig.production.birthThreshold
        const deathThreshold = holdersConfig.production.deathThreshold
        const inserts: any[] = []
        if (births >= birthThreshold) inserts.push({ type: 'scene_trigger', payload: { kind: 'welcome' }, severity: 1 })
        if (deaths >= deathThreshold) inserts.push({ type: 'scene_trigger', payload: { kind: 'graveyard' }, severity: 1 })

        // Biggest interval buyers (hero trophy): compute delta vs previous snapshot
        const prevTotal = Array.from(prevBalanceMap.values()).reduce((acc, bal) => acc + bal, 0n) || 1n
        const deltas = tokenRows.map(r => {
          const prevBal = prevBalanceMap.get(r.address) || 0n
          const prevPct = Number((prevBal * 10000n) / prevTotal) / 100
          const deltaPct = Number((r.percent - prevPct).toFixed(4))
          return { address: r.address, deltaPct }
        }).sort((a,b) => (b.deltaPct - a.deltaPct))
        const minDelta = holdersConfig.production.bigBuyDeltaPct
        const topBuyers = deltas.filter(d => d.deltaPct >= minDelta).slice(0, 3)
        if (topBuyers.length > 0) inserts.push({ type: 'scene_trigger', payload: { kind: 'trophy', topBuyers }, severity: 2 })

        // Text scene removed
        if (inserts.length) await supa.from('events').insert(inserts as any)
      } catch {}
    }

    // Prepare address list; skip large IN-selects in SIM_MODE to avoid URL length limits
    const addresses = toAddressList(tokenRows)
    const layoutInputs: TokenRowInput[] = tokenRows.map((row) => ({
      address: row.address_cased || row.address,
      address_canonical: row.address_canonical || row.address,
      rank: row.rank,
    }))
    const layoutMap = deriveHolderLayout(layoutInputs)
    const rowLookup = toRowLookup(tokenRows)
    let prevRanked: string[] = []
    try {
      prevRanked = await fetchPrevRankedAddresses(supa, chainKind)
    } catch {}
    // Expire shames (until <= now) in dedicated table
    try {
      const nowIsoExpire = new Date().toISOString()
      await supa.from('shames').delete().lte('until', nowIsoExpire)
    } catch {}

    let holdersMap = new Map<string, any>()
    try {
      holdersMap = await fetchExistingTokenHolders(supa, chainKind, addresses)
    } catch {}

    let updatedCount = 0
    updatedCount = await upsertTokenHolders(supa, chainKind, tokenRows, holdersMap)

    // Snapshot reconciliation via shared helpers
    const currentSet = new Set(addresses)
    const dropoutsRankOnly = filterDropouts(prevRanked, currentSet)

    if (dropoutsRankOnly.length) {
      try {
        await clearDropoutRanks(supa, chainKind, dropoutsRankOnly)
      } catch {}
    }

    const BIRTH_ONLY = holdersConfig.sim.birthOnly

    let existingBloblets = new Map<string, any>()
    try {
      existingBloblets = await fetchExistingBloblets(supa, chainKind, addresses)
    } catch {}

    const newAddresses = findNewAddresses(tokenRows, existingBloblets)
    const newAddressSet = new Set(newAddresses)

    let variants: any[] = []
    try {
      variants = await fetchActiveVariants(supa)
    } catch {}

    if (newAddresses.length) {
      await insertNewBloblets(supa, {
        chainKind,
        newAddresses,
        layoutMap,
        rowLookup,
        variants,
        existingBloblets,
        pickAppearance,
        getDefaultSpriteUrl,
        birthOnly: BIRTH_ONLY,
      })
    }

    await updateBlobletAnchors(supa, {
      chainKind,
      layoutMap,
      rowLookup,
      existingBloblets,
      skipAddresses: newAddressSet,
    })

    try {
      await markBlobletsAlive(supa, chainKind, addresses, rowLookup)
    } catch (e) {
      console.error('[holders/refresh] revive alive update failed', e)
    }

    try {
      await shameDropouts(supa, chainKind, addresses, dropoutsRankOnly)
    } catch (e) {
      console.log('[refresh] shame window skipped:', (e as any)?.message || e)
    }

    // VISUAL TEST MODE — Automated visible flips for canvas verification
    try {
      const vmode = holdersConfig.visualTestMode
      const VISUAL_TEST_ENABLED = (vmode === 'true' || vmode === 'wave' || vmode === 'half')
      if (VISUAL_TEST_ENABLED && !SIM_MODE) {
        const nowIso = new Date().toISOString()
        const currentMinute = new Date().getMinutes()
        const parity = currentMinute % 2 // toggles pattern each minute

        // Only operate on visible canvas set (top 2000 by rank)
        const visible = tokenRows.slice(0, 2000)
        const addresses = visible.map(r => r.address)
        if (addresses.length === 0) {
          console.log('[VISUAL-TEST] No visible holders, skipping')
        } else {
          // Read current status for top 2000
          // Chunked read of current status to avoid URI too large
          const current: any[] = []
          const chunkSize2 = 150
          for (let i = 0; i < addresses.length; i += chunkSize2) {
            const chunk = addresses.slice(i, i + chunkSize2)
            const { data } = await supa
              .from('bloblets')
              .select('address, is_alive')
              .in('address', chunk)
            if (data && data.length) current.push(...data)
          }

          const byAddr = new Map<string, boolean>(
            (current || []).map((b) => [
              String((b as any).address_canonical || (b as any).address || '').trim(),
              !!(b as any).is_alive,
            ]),
          )

          const modeHalf = (vmode === 'half')
          const modeWave = (vmode === 'wave' || vmode === 'true')

          let updates: { address: string; is_alive: boolean; last_seen_at: string }[] = []

          if (modeHalf) {
            // Half/half across top 2000; alternate halves by minute parity
            // idx % 2 === parity => true, else false (or invert as you prefer)
            for (let i = 0; i < addresses.length; i++) {
              const addr = addresses[i]!
              const desired = ((i % 2) === parity) // 50/50 toggle each minute
              const cur = byAddr.get(addr)
              if (cur !== desired) updates.push({ address: addr, is_alive: desired, last_seen_at: nowIso })
            }
            console.log(`[VISUAL-TEST half] Minute parity=${parity}. Will update ${updates.length} / ${addresses.length}`)
          } else if (modeWave) {
            // 5-wave rolling segment; within the segment, alternate pattern by index + minute parity
            const waveSegment = currentMinute % 5
            const segmentSize = Math.max(1, Math.floor(addresses.length / 5))
            const startIdx = waveSegment * segmentSize
            const endIdx = Math.min((waveSegment + 1) * segmentSize, addresses.length)
            for (let i = startIdx; i < endIdx; i++) {
              const addr = addresses[i]!
              const desired = (((i - startIdx) + parity) % 2 === 0) // mix of true/false inside segment
              const cur = byAddr.get(addr)
              if (cur !== desired) updates.push({ address: addr, is_alive: desired, last_seen_at: nowIso })
            }
            console.log(`[VISUAL-TEST wave] Segment ${waveSegment + 1}/5 ranks ${startIdx + 1}-${endIdx}. Will update ${updates.length}`)
          }

          if (updates.length) {
            const BATCH = 500
            let applied = 0
            for (let i = 0; i < updates.length; i += BATCH) {
              const chunk = updates.slice(i, i + BATCH)
              const payload = chunk.map((item) => {
                const keys = deriveAddressKeys(item.address, { chainKind })
                return {
                  ...item,
                  address: keys.canonical,
                  address_canonical: keys.canonical,
                  address_cased: item.address,
                  chain_kind: chainKind,
                }
              })
              const { data: upd, error: err } = await supa
                .from('bloblets')
                .upsert(payload as any, { onConflict: 'address_canonical,chain_kind' })
                .select('address')
              if (!err && upd) applied += upd.length
            }
            console.log(`[VISUAL-TEST] Applied ${applied} updates`)
          } else {
            console.log('[VISUAL-TEST] No changes needed this minute')
          }
        }
      }
    } catch (e) {
      console.error('[VISUAL-TEST] Error:', e)
    }

    if (SIM_MODE) {
      // Record sim tick for idempotency & observability
      try { await supa.from('events').insert({ type: 'sim_tick', severity: 1, payload: simSummary } as any) } catch {}
    } else {
      // Note: We no longer mark addresses not in this batch as dead.
      // Moralis owners API can be limited; avoid offboarding valid holders.
    }

    const clearedDropouts = dropoutsRankOnly.length
    const updatedTop = updatedCount
    const updatedTotal = updatedTop + clearedDropouts
    await logRefreshEvent(supa, updatedTop, clearedDropouts)
    res.status(200).json({ ok: true, updated: updatedTotal, sim: SIM_MODE ? simSummary : undefined })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Refresh failed' })
  }
}
