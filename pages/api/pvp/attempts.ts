import type { NextApiRequest, NextApiResponse } from 'next'

import { adminConfig } from '@/src/config/admin'
import { getSessionFromRequest } from '@/src/server/auth'
import { normalizeChainAddress } from '@/src/server/address'
import { resolveChainKind } from '@/src/server/chains'
import { withPgReadonlyClient } from '@/src/server/pg'
import { getCareDropConfig } from '@/src/server/gameplay/careConfig'

type Summary = {
  attempts: number
  drops: number
  rate: number
}

type NextStats = {
  effProbability: number
  bucketContribution: number
  bucketFillPercent: number
  rngPending: boolean
}

type AttemptRow = {
  created_at: string
  base_probability: number | null
  eff_probability: number | null
  roll: number | null
  awarded: boolean
  acc_before: number | null
  acc_after: number | null
  slot: 'weapon' | 'shield' | null
  item_id: number | null
  item_slug: string | null
  rng_passed: boolean
  fallback_type: string | null
}

type AttemptsResponse = {
  ok: true
  address: string
  self: boolean
  law: 'deterministic_accumulator' | 'memoryless'
  base: number
  guaranteeWithin: number | null
  next: NextStats
  window: { last24h: Summary }
  wallet: { lifetime: Summary; last: AttemptRow[] }
} | { error: string }

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function computeNextStats(base: number, lastAttempt: AttemptRow | undefined): NextStats {
  const accAfter = lastAttempt?.acc_after != null ? Number(lastAttempt.acc_after) : 0
  const bucketContribution = clamp01(accAfter)
  const effProbability = clamp01(base + bucketContribution)
  const denom = 1 - base
  const bucketFillPercent = denom > 0 ? clamp01(bucketContribution / denom) : 1
  const rngPending = Boolean(lastAttempt?.rng_passed && !lastAttempt?.awarded)
  return {
    effProbability,
    bucketContribution,
    bucketFillPercent,
    rngPending,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AttemptsResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const session = getSessionFromRequest(req)
  if (!session || !session.address) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const chainKind = resolveChainKind()
  let sessionCanonical = ''
  try {
    sessionCanonical = normalizeChainAddress(session.address, chainKind)
  } catch {
    sessionCanonical = ''
  }
  if (!sessionCanonical) {
    return res.status(400).json({ error: 'address_invalid' })
  }
  let requestedCanonical = ''
  const requestedRaw = req.query.address ? String(req.query.address) : ''
  if (requestedRaw) {
    try {
      requestedCanonical = normalizeChainAddress(requestedRaw, chainKind)
    } catch {
      requestedCanonical = ''
    }
  }
  if (!requestedCanonical) {
    requestedCanonical = sessionCanonical
  }
  const self = requestedCanonical === sessionCanonical
  const allowAll = adminConfig.allowAllAccess
  if (!self && !allowAll) {
    return res.status(403).json({ error: 'forbidden' })
  }

  const dropConfig = getCareDropConfig()
  const base = dropConfig.baseProbability
  const law = dropConfig.law

  try {
    const data = await withPgReadonlyClient(async (client) => {
      const last24h = await client.query(
        `select count(*)::int as attempts, coalesce(sum((awarded)::int),0)::int as drops
           from public.telemetry_care_loot
          where created_at > now() - interval '24 hours'`,
      )
      const a24 = Number(last24h.rows[0]?.attempts || 0)
      const d24 = Number(last24h.rows[0]?.drops || 0)
      const w24: Summary = { attempts: a24, drops: d24, rate: a24 ? d24 / a24 : 0 }

      const lifetime = await client.query(
        `select count(*)::int as attempts,
                coalesce(sum((awarded)::int),0)::int as drops
           from public.telemetry_care_loot
          where address_canonical = $1`,
        [requestedCanonical],
      )
      const al = Number(lifetime.rows[0]?.attempts || 0)
      const dl = Number(lifetime.rows[0]?.drops || 0)
      const wl: Summary = { attempts: al, drops: dl, rate: al ? dl / al : 0 }

      const recent = await client.query(
        `select created_at,
                base_probability::float as base_probability,
                eff_probability::float as eff_probability,
                roll::float as roll,
                awarded,
                acc_before::float as acc_before,
                acc_after::float as acc_after,
                slot::text as slot,
                item_id::bigint as item_id,
                item_slug::text as item_slug,
                rng_passed,
                fallback_type
           from public.telemetry_care_loot
          where address_canonical = $1
          order by created_at desc
          limit 20`,
        [requestedCanonical],
      )
      const last: AttemptRow[] = recent.rows.map((r: any) => ({
        created_at: new Date(r.created_at).toISOString(),
        base_probability: r.base_probability != null ? Number(r.base_probability) : null,
        eff_probability: r.eff_probability != null ? Number(r.eff_probability) : null,
        roll: r.roll != null ? Number(r.roll) : null,
        awarded: !!r.awarded,
        acc_before: r.acc_before != null ? Number(r.acc_before) : null,
        acc_after: r.acc_after != null ? Number(r.acc_after) : null,
        slot: r.slot === 'weapon' || r.slot === 'shield' ? r.slot : null,
        item_id: r.item_id != null ? Number(r.item_id) : null,
        item_slug: r.item_slug ?? null,
        rng_passed: r.rng_passed === true,
        fallback_type: r.fallback_type ?? null,
      }))

      return { w24, wl, last }
    })

    const nextStats = computeNextStats(base, data.last[0])

    return res.status(200).json({
      ok: true,
      address: requestedCanonical,
      self,
      law,
      base,
      guaranteeWithin: dropConfig.guaranteeWithin,
      next: nextStats,
      window: { last24h: data.w24 },
      wallet: { lifetime: data.wl, last: data.last },
    })
  } catch (e) {
    console.error('[pvp/attempts] failed', e)
    return res.status(500).json({ error: 'summary_failed' })
  }
}
