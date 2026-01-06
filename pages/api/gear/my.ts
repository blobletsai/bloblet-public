import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash } from 'node:crypto'

import { getSessionFromRequest } from '@/src/server/auth'
import { getGearInventoryForAddress, type GearInventory } from '@/src/server/gameplay/gearService'

const GEAR_CACHE_CONTROL = 'private, max-age=0, must-revalidate'

function buildGearEtag(gear: GearInventory): string {
  const normalizeItem = (item: GearInventory['equipped']['weapon']) => {
    if (!item) return null
    return {
      id: item.id,
      baseItemId: item.baseItemId,
      type: item.type,
      name: item.name,
      slug: item.slug,
      rarity: item.rarity,
      op: item.op,
      dp: item.dp,
      iconUrl: item.iconUrl,
      generatedIconUrl: item.generatedIconUrl,
      equippedSlot: item.equippedSlot ?? null,
    }
  }
  const payload = {
    equipped: {
      weapon: normalizeItem(gear.equipped.weapon),
      shield: normalizeItem(gear.equipped.shield),
    },
    stash: (gear.stash || []).map((it) => normalizeItem(it)),
    stashCount: gear.stashCount,
  }
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return `"gear-${hash}"`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const session = getSessionFromRequest(req)
    if (!session || !session.address) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const gear = await getGearInventoryForAddress(session.address)
    const etag = buildGearEtag(gear)
    res.setHeader('Cache-Control', GEAR_CACHE_CONTROL)
    res.setHeader('ETag', etag)
    const ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end()
    }
    return res.status(200).json({ ok: true, gear })
  } catch (err) {
    console.error('[gear/my] failed', err)
    return res.status(500).json({ error: 'gear_fetch_failed' })
  }
}
