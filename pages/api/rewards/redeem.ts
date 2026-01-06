import type { NextApiRequest, NextApiResponse } from 'next'

import { rewardsConfig } from '@/src/config/rewards'
import { getSessionFromRequest } from '@/src/server/auth'
import { rateLimiter } from '@/src/server/rateLimit'
import { withPgClient } from '@/src/server/pg'
import {
  REWARD_LEDGER_ENABLED,
  fetchRewardBalances,
  applyLedgerEntries,
  normalizeRewardDisplay,
  roundPoints,
} from '@/src/server/rewards'
import { getSolanaAddressContext } from '@/src/shared/address/solana'
import type { RewardLedgerEntryInput } from '@/src/server/rewards'

const ONE_MINUTE_MS = 60 * 1000

function normalizeAddress(address: string) {
  try {
    return getSolanaAddressContext(String(address || '')).canonical
  } catch {
    return ''
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!REWARD_LEDGER_ENABLED) {
      return res.status(503).json({ error: 'reward ledger disabled' })
    }
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')

    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ error: 'unauthorized' })

    const ip = (req.headers['x-forwarded-for'] as string) || 'rewards'
    const { success } = await rateLimiter.limit(`rewards:redeem:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })

    const body = req.body || {}
    const amountInput = Number(body.amount)
    if (!Number.isFinite(amountInput) || amountInput <= 0) {
      return res.status(400).json({ error: 'invalid_amount' })
    }

    const requestedNormalized = roundPoints(amountInput)
    const rawAmount = requestedNormalized
    if (rawAmount <= 0) return res.status(400).json({ error: 'invalid_amount' })

    const minPointsNormalized = roundPoints(rewardsConfig.redeem.minPoints)
    const minPointsRaw = minPointsNormalized
    if (rawAmount < minPointsRaw) {
      return res.status(400).json({ error: 'below_min', min: normalizeRewardDisplay(minPointsRaw) })
    }

    const floorNormalized = rewardsConfig.redeem.inPlayFloorPoints
    const floorRaw = floorNormalized > 0 ? roundPoints(floorNormalized) : 0

    const cooldownMin = rewardsConfig.redeem.cooldownMinutes
    const dailyCapBps = rewardsConfig.redeem.dailyCapBps
    const winLockMin = rewardsConfig.redeem.winLockMinutes

    const address = normalizeAddress(sess.address)
    const destination = normalizeAddress(String(body.destination || sess.address))
    if (!address || !destination) {
      return res.status(400).json({ error: 'invalid_address' })
    }

    const reference = String(body.reference || '').trim() || null

    const result = await withPgClient(async (client) => {
      await client.query('BEGIN')
      try {
        const balances = await fetchRewardBalances(client, [address], { lockRows: true })
        const snapshot = balances.get(address)
        const currentBalance = snapshot?.currentBalance ?? 0

        const availableAfterFloor = Math.max(0, currentBalance - floorRaw)
        if (rawAmount > availableAfterFloor) {
          throw Object.assign(new Error('insufficient_available'), { status: 400 })
        }

        if (cooldownMin > 0) {
          const latestRes = await client.query(
            `select created_at from public.treasury_swaps
              where address = $1 and direction = 'withdraw'
              order by created_at desc
              limit 1`,
            [address]
          )
          if (latestRes.rows.length) {
            const createdAt = Date.parse(latestRes.rows[0].created_at)
            if (Number.isFinite(createdAt) && createdAt > Date.now() - cooldownMin * ONE_MINUTE_MS) {
              throw Object.assign(new Error('cooldown_active'), { status: 429 })
            }
          }
        }

        if (dailyCapBps > 0) {
          const capCutoff = new Date(Date.now() - 24 * 60 * ONE_MINUTE_MS).toISOString()
          const sumRes = await client.query(
            `select coalesce(sum(amount_points), 0) as total
               from public.treasury_swaps
              where address = $1
                and direction = 'withdraw'
                and created_at >= $2`,
            [address, capCutoff]
          )
          const redeemedRaw = Number(sumRes.rows[0]?.total || 0)
          const capRaw = Math.max(0, Math.floor(currentBalance * (dailyCapBps / 10_000)))
          if (redeemedRaw + rawAmount > capRaw) {
            throw Object.assign(new Error('daily_cap'), { status: 400, cap: normalizeRewardDisplay(capRaw) })
          }
        }

        if (winLockMin > 0) {
          const lockCutoff = new Date(Date.now() - winLockMin * ONE_MINUTE_MS).toISOString()
          const lockRes = await client.query(
            `select coalesce(sum(delta), 0) as locked
               from public.reward_ledger
              where address = $1
                and reason = 'battle_win'
                and created_at >= $2`,
            [address, lockCutoff]
          )
          const lockedRaw = Number(lockRes.rows[0]?.locked || 0)
          const unlocked = Math.max(0, currentBalance - lockedRaw)
          if (rawAmount > unlocked) {
            throw Object.assign(new Error('win_lock_active'), { status: 400 })
          }
        }

        const now = new Date()
        const nowIso = now.toISOString()
        const insertRes = await client.query(
          `insert into public.treasury_swaps (
             address, direction, status, source,
             amount_points, amount_tokens,
             reference, tx_signature, tx_explorer_url, metadata,
             created_at, updated_at
           ) values ($1,'withdraw','pending','user',$2,$2,$3,null,null,$4::jsonb,$5,$5)
           returning *`,
          [
            address,
            rawAmount,
            reference,
            JSON.stringify({ destination, requestedAmount: requestedNormalized }),
            nowIso,
          ]
        )
        const swapRow = insertRes.rows[0]

        const ledgerEntries: RewardLedgerEntryInput[] = [
          {
            address,
            delta: -rawAmount,
            reason: 'redeem_debit',
            swapId: swapRow.id,
            metadata: {
              destination,
              requestedAmount: requestedNormalized,
            },
          },
        ]
        const balancesAfter = await applyLedgerEntries(client, ledgerEntries, { now })
        const balanceAfterRaw = balancesAfter.get(address) ?? Math.max(0, currentBalance - rawAmount)

        await client.query('COMMIT')
        return { swap: swapRow, balanceAfterRaw }
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    })

    const response = {
      ok: true,
      status: 'pending',
      swap: result.swap,
      pointsDebited: normalizeRewardDisplay(rawAmount),
      balanceAfter: normalizeRewardDisplay(result.balanceAfterRaw),
    }
    return res.status(200).json(response)
  } catch (err: any) {
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500
    const payload: Record<string, any> = { error: err?.message || 'redeem failed' }
    if (err?.cap) payload.cap = err.cap
    return res.status(status).json(payload)
  }
}
