import type { NextApiRequest, NextApiResponse } from 'next'

import { getChallengeableMinPoints, getMinTransferPoints } from '@/src/shared/gameplay/config'
import { withPgReadonlyClient } from '@/src/server/pg'
import { getCareDropConfig } from '@/src/server/gameplay/careConfig'

type ConfigResponse = {
  minStake: number
  drop: {
    law: 'deterministic_accumulator' | 'memoryless'
    base: number
    accumEnabled: boolean
    shieldFirstBias: boolean
    guaranteeWithin: number | null
    metrics: {
      last24h: DropMetrics | null
    }
  }
}

type DropMetrics = {
  windowHours: number
  attempts: number
  drops: number
  rate: number
  deltaFromBase: number
  rngHits: number
  rngWithoutLoot: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ConfigResponse | { error: string }>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const minStake = Math.max(getChallengeableMinPoints(), getMinTransferPoints())
  const dropConfig = getCareDropConfig()
  let last24h: DropMetrics | null = null
  try {
    last24h = await fetchDropMetrics(24, dropConfig.baseProbability)
  } catch (err) {
    console.error('[pvp/config] failed to load fairness metrics', err)
    last24h = null
  }
  return res.status(200).json({
    minStake,
    drop: {
      law: dropConfig.law,
      base: dropConfig.baseProbability,
      accumEnabled: dropConfig.accumulatorEnabled,
      shieldFirstBias: dropConfig.shieldFirstBias,
      guaranteeWithin: dropConfig.guaranteeWithin,
      metrics: {
        last24h,
      },
    },
  })
}

async function fetchDropMetrics(windowHours: number, baseProbability: number): Promise<DropMetrics> {
  const hours = Math.max(1, Math.min(168, Math.floor(windowHours || 24)))
  return withPgReadonlyClient(async (client) => {
    const res = await client.query(
      `select count(*)::int as attempts,
              coalesce(sum((awarded)::int),0)::int as drops,
              coalesce(sum((rng_passed)::int),0)::int as rng_hits,
              coalesce(sum(case when rng_passed and not awarded then 1 else 0 end),0)::int as rng_pending
         from public.telemetry_care_loot
        where created_at > now() - interval '${hours} hours'`,
    )
    const attempts = Number(res.rows[0]?.attempts || 0)
    const drops = Number(res.rows[0]?.drops || 0)
    const rngHits = Number(res.rows[0]?.rng_hits || 0)
    const rngPending = Number(res.rows[0]?.rng_pending || 0)
    const rate = attempts ? drops / attempts : 0
    return {
      windowHours: hours,
      attempts,
      drops,
      rate,
      deltaFromBase: rate - baseProbability,
      rngHits,
      rngWithoutLoot: rngPending,
    }
  })
}
