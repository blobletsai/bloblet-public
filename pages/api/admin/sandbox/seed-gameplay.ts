import type { NextApiRequest, NextApiResponse } from 'next'

import { adminConfig } from '@/src/config/admin'
import {
  seedSandboxGameplay,
  type SandboxWalletSeed,
} from '@/src/server/sandbox/gameplaySeeder'

function parseWallets(raw: any): SandboxWalletSeed[] {
  if (!Array.isArray(raw)) return []
  const wallets: SandboxWalletSeed[] = []
  for (const entry of raw) {
    if (!entry) continue
    if (typeof entry === 'string') {
      const address = entry.trim()
      if (!address) continue
      wallets.push({ address })
      continue
    }
    if (typeof entry === 'object') {
      const address = String(entry.address ?? entry.wallet ?? '').trim()
      if (!address) continue
      const tokenValue = entry.tokenAmount ?? entry.token ?? entry.tokens ?? entry.balance
      const tierRaw = entry.tier
      const nameRaw = entry.name ?? entry.label ?? null
      const notesRaw = entry.notes ?? null
      wallets.push({
        address,
        tokenAmount: tokenValue != null ? Number(tokenValue) : undefined,
        tier: tierRaw === 'top' || tierRaw === 'middle' || tierRaw === 'bottom' ? tierRaw : undefined,
        name: typeof nameRaw === 'string' ? nameRaw : undefined,
        notes: typeof notesRaw === 'string' ? notesRaw : null,
      })
    }
  }
  return wallets
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const secret = (adminConfig.secrets.cron || '').trim()
  if (secret) {
    const hdr =
      (req.headers['x-internal-auth'] as string) ||
      (req.headers['x-internal-secret'] as string) ||
      ''
    if (hdr !== secret) {
      return res.status(403).json({ error: 'forbidden' })
    }
  }

  try {
    const wallets = parseWallets(req.body?.wallets ?? req.body?.addresses ?? [])
    if (!wallets.length) {
      return res.status(400).json({ error: 'wallets_required' })
    }

    const result = await seedSandboxGameplay({
      wallets,
      careChargesPerWallet: Number.isFinite(Number(req.body?.careChargesPerWallet))
        ? Number(req.body.careChargesPerWallet)
        : undefined,
      assignLoadouts:
        req.body?.assignLoadouts === undefined ? undefined : Boolean(req.body.assignLoadouts),
      runBattles:
        req.body?.runBattles === undefined ? undefined : Boolean(req.body.runBattles),
      battlesToRun:
        Number.isFinite(Number(req.body?.battlesToRun)) ? Number(req.body.battlesToRun) : undefined,
    })

    return res.status(200).json({ ok: true, result })
  } catch (err: any) {
    console.error('[sandbox/seed-gameplay] failed', err)
    return res.status(500).json({ error: err?.message || 'seed_failed' })
  }
}
