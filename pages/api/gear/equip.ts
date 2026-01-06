import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { withPgClient } from '@/src/server/pg'
import { getSolanaAddressContext } from '@/src/shared/address/solana'

type EquipResponse = {
  ok: true
  equipped: { weapon_item_id: number | null; shield_item_id: number | null }
} | { error: string; details?: any }

function toCanonicalAddress(value: unknown): string {
  try {
    return getSolanaAddressContext(String(value || '')).canonical
  } catch {
    return ''
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<EquipResponse>) {
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
  const baseItemId = Number(body.itemId || body.baseItemId)
  if (!(slot === 'weapon' || slot === 'shield')) {
    return res.status(400).json({ error: 'invalid_slot' })
  }
  if (!Number.isFinite(baseItemId) || baseItemId <= 0) {
    return res.status(400).json({ error: 'invalid_item' })
  }

  try {
    const result = await withPgClient(async (client) => {
      await client.query('BEGIN')
      try {
        // Lock or create loadout row to avoid races
        const lock = await client.query(
          `insert into public.bloblet_loadout (bloblet_address, weapon_item_id, shield_item_id)
             values ($1, null, null)
           on conflict (bloblet_address) do update set bloblet_address = excluded.bloblet_address
           returning weapon_item_id, shield_item_id`,
          [addressCanonical],
        )

        // Validate item exists and type matches slot
        const itemRes = await client.query(
          `select id, type from public.pvp_items where id = $1`,
          [baseItemId],
        )
        const item = itemRes.rows[0]
        if (!item) throw new Error('item_not_found')
        if (String(item.type) !== slot) throw new Error('slot_mismatch')

        // Ensure item is in stash
        const stashRes = await client.query(
          `select items from public.bloblet_gear_inventory where bloblet_address = $1`,
          [addressCanonical],
        )
        const items = (stashRes.rows[0]?.items as any[]) || []
        const hasItem = items.some((it) => Number(it?.baseItemId ?? it?.base_item_id) === baseItemId)
        if (!hasItem) throw new Error('not_in_inventory')

        // Apply equip
        const update = await client.query(
          `update public.bloblet_loadout
              set ${slot === 'weapon' ? 'weapon_item_id' : 'shield_item_id'} = $2,
                  updated_at = now()
            where bloblet_address = $1
          returning weapon_item_id, shield_item_id`,
          [addressCanonical, baseItemId],
        )

        // Audit event
        try {
          await client.query(
            `insert into public.events (type, severity, payload)
               values ($1, $2, $3::jsonb)`,
            [
              'gear_equip',
              0,
              JSON.stringify({ address: addressCanonical, slot, baseItemId, at: new Date().toISOString() }),
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
  } catch (err: any) {
    const code = String(err?.message || 'equip_failed')
    const status = code === 'item_not_found' || code === 'slot_mismatch' ? 400
      : code === 'not_in_inventory' ? 404
      : 500
    return res.status(status).json({ error: code })
  }
}
