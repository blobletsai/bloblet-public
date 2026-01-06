import type { NextApiRequest, NextApiResponse } from 'next'

import { appConfig } from '@/src/config/app'
import { adminConfig } from '@/src/config/admin'
import { supaAdmin } from '@/src/server/supa'
import { resolveChainKind } from '@/src/server/chains'
import { pruneExpiredDeadHolders } from '@/src/server/holders/supabase'

function isAuthorized(req: NextApiRequest) {
  const secret = (adminConfig.secrets.cron || adminConfig.secrets.admin || '').trim()
  if (!secret) return !appConfig.isProduction
  const hdr = (req.headers['x-internal-auth'] as string) || (req.headers['x-internal-secret'] as string) || (req.query.secret as string) || ''
  return hdr === secret
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'forbidden' })
  if (req.method !== 'POST') return res.status(405).end('Method not allowed')
  try {
    const supa = supaAdmin()
    const chainKind = resolveChainKind()
    const hours = Math.max(1, Number(req.query.hours || 48))
    const graceMinutes = hours * 60
    const dry = String(req.query.dry || '') === '1'
    const result = await pruneExpiredDeadHolders(supa as any, {
      chainKind,
      graceMinutes,
      nowIso: new Date().toISOString(),
      dryRun: dry,
    })
    res.status(200).json({
      ok: true,
      dry,
      hours,
      graceMinutes,
      cutoff: result.cutoffIso,
      bloblets_deleted: dry ? 0 : result.blobletsDeleted,
      token_holders_deleted: dry ? 0 : result.tokenHoldersDeleted,
      shames_deleted: dry ? 0 : result.shamesDeleted,
      penalized_wallets: result.penalizedWallets,
      confiscated_total_raw: result.confiscatedTotalRaw,
      preview: dry ? result.addresses : undefined,
    })
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'cleanup failed' })
  }
}
