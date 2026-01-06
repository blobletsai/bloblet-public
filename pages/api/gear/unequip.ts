import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { withPgClient } from '@/src/server/pg'
import { getSolanaAddressContext } from '@/src/shared/address/solana'

type UnequipResponse = {
  ok: true
  equipped: { weapon_item_id: number | null; shield_item_id: number | null }
} | { error: string }

function toCanonicalAddress(value: unknown): string {
  try {
    return getSolanaAddressContext(String(value || '')).canonical
  } catch {
    return ''
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<UnequipResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const session = getSessionFromRequest(req)
  if (!session || !session.address) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const body = req.body || {}
  const addressCanonical = toCanonicalAddress(session.address)
  if (!addressCanonical) {
    return res.status(400).json({ error: 'invalid_address' })
  }
  const slot = String(body.slot || '').trim().toLowerCase()
  if (!(slot === 'weapon' || slot === 'shield')) {
    return res.status(400).json({ error: 'invalid_slot' })
  }

  try {
    const result = await withPgClient(async (client) => {
      await client.query('BEGIN')
      try {
        // Ensure loadout row exists
        const lock = await client.query(
          `insert into public.bloblet_loadout (bloblet_address, weapon_item_id, shield_item_id)
             values ($1, null, null)
           on conflict (bloblet_address) do update set bloblet_address = excluded.bloblet_address
           returning weapon_item_id, shield_item_id`,
          [addressCanonical],
        )

        const update = await client.query(
          `update public.bloblet_loadout
              set ${slot === 'weapon' ? 'weapon_item_id' : 'shield_item_id'} = null,
                  updated_at = now()
            where bloblet_address = $1
          returning weapon_item_id, shield_item_id`,
          [addressCanonical],
        )
        // Audit event
        try {
          await client.query(
            `insert into public.events (type, severity, payload)
               values ($1, $2, $3::jsonb)`,
            [
              'gear_unequip',
              0,
              JSON.stringify({ address: addressCanonical, slot, at: new Date().toISOString() }),
            ],
          )
        } catch {}
        await client.query('COMMIT')
        const row = update.rows[0] || lock.rows[0]
        return { weapon_item_id: row?.weapon_item_id ?? null, shield_item_id: row?.shield_item_id ?? null }
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    })

    return res.status(200).json({ ok: true, equipped: result })
  } catch {
    return res.status(500).json({ error: 'unequip_failed' })
  }
}
