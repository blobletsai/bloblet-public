import type { NextApiRequest, NextApiResponse } from 'next'

type HealthPayload = {
  status: 'idle' | 'connecting' | 'open' | 'retrying' | 'error' | 'unknown'
  updatedAt: string | null
  lastEventAt: string | null
  fallbackPolling: boolean
  activeOrders: number
  battlesCached: number
  loadoutsCached: number
  listenerCount: number
}

type MutableHealth = HealthPayload & { receivedAt: string | null }

const globalAny = globalThis as typeof globalThis & {
  __realtimeHealth?: MutableHealth
}

function getHealthState(): MutableHealth {
  if (!globalAny.__realtimeHealth) {
    globalAny.__realtimeHealth = {
      status: 'unknown',
      updatedAt: null,
      lastEventAt: null,
      fallbackPolling: false,
      activeOrders: 0,
      battlesCached: 0,
      loadoutsCached: 0,
      listenerCount: 0,
      receivedAt: null,
    }
  }
  return globalAny.__realtimeHealth!
}

function coerceNumber(input: unknown, fallback: number): number {
  const value = Number(input)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const health = getHealthState()
  if (req.method === 'POST') {
    const nowIso = new Date().toISOString()
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {}
    if (body && typeof body === 'object') {
      const status = typeof body.status === 'string' ? body.status : undefined
      if (
        status === 'idle' ||
        status === 'connecting' ||
        status === 'open' ||
        status === 'retrying' ||
        status === 'error' ||
        status === 'unknown'
      ) {
        health.status = status
      }
      const lastEventAt = typeof body.lastEventAt === 'string' ? body.lastEventAt : null
      if (lastEventAt) {
        health.lastEventAt = lastEventAt
      }
      if (typeof body.fallbackPolling === 'boolean') {
        health.fallbackPolling = body.fallbackPolling
      }
      health.activeOrders = coerceNumber(body.activeOrders, health.activeOrders)
      health.battlesCached = coerceNumber(body.battlesCached, health.battlesCached)
      health.loadoutsCached = coerceNumber(body.loadoutsCached, health.loadoutsCached)
      health.listenerCount = coerceNumber(body.listenerCount, health.listenerCount)
    }
    health.updatedAt = nowIso
    health.receivedAt = nowIso
    res.status(204).end()
    return
  }

  if (req.method === 'GET') {
    res.status(200).json({
      status: health.status,
      updatedAt: health.updatedAt,
      lastEventAt: health.lastEventAt,
      fallbackPolling: health.fallbackPolling,
      activeOrders: health.activeOrders,
      battlesCached: health.battlesCached,
      loadoutsCached: health.loadoutsCached,
      listenerCount: health.listenerCount,
      receivedAt: health.receivedAt,
    })
    return
  }

  res.setHeader('Allow', 'GET,POST')
  res.status(405).end('Method Not Allowed')
}

function safeParse(payload: string) {
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}
