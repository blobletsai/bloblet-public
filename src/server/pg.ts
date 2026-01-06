import { Pool, PoolClient, PoolConfig } from 'pg'
import { appConfig } from '../config/app'
import { databaseConfig } from '@/src/config/database'

let pool: Pool | null = null
let readPool: Pool | null = null

function buildConnectionString(): string {
  const explicit = appConfig.supabase.dbConnection
  if (explicit) return explicit.replace(/\?(.*)$/, '')

  const { host: hostEnv, port: portNumber, name: nameEnv, user: userEnv } = databaseConfig.fallback
  const password = appConfig.supabase.dbPassword
  if (!password) throw new Error('SUPABASE_DB_PASSWORD missing')

  if (hostEnv && nameEnv && userEnv) {
    const port = Number.isFinite(portNumber) ? Math.max(1, Math.floor(portNumber)) : 5432
    return `postgresql://${encodeURIComponent(userEnv)}:${encodeURIComponent(password)}@${hostEnv}:${port}/${encodeURIComponent(nameEnv)}`
  }

  const rawUrl = appConfig.supabase.url
  if (!rawUrl) throw new Error('SUPABASE_URL missing')
  const hostTarget = rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const host = hostTarget.startsWith('db.') ? hostTarget : `db.${hostTarget}`
  return `postgresql://postgres:${encodeURIComponent(password)}@${host}:5432/postgres`
}

function poolConfig(): PoolConfig {
  const explicit = appConfig.supabase.dbConnection
  const connectionString = explicit ? explicit : buildConnectionString()
  // Using Supabase Transaction-mode pooling (port 6543) which supports ~200 connections.
  // Each serverless function can safely use 5-10 connections without exhausting the pool.
  const max = databaseConfig.pool.max
  return {
    connectionString,
    max,
    ssl: { rejectUnauthorized: false },
  }
}

function readPoolConfig(): PoolConfig {
  const explicit = appConfig.supabase.dbConnectionRead
  const base = explicit || appConfig.supabase.dbConnection
  const connectionString = base ? base : buildConnectionString()
  // Read-only pool can use more connections since it's for high-volume SELECTs
  const max = databaseConfig.pool.readMax
  return {
    connectionString,
    max,
    ssl: { rejectUnauthorized: false },
  }
}

export function pgPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig())
  }
  return pool
}

export async function withPgClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

// Read-only pool (transaction mode) for high-volume SELECTs.
export function pgReadPool(): Pool {
  if (!readPool) {
    readPool = new Pool(readPoolConfig())
  }
  return readPool
}

export async function withPgReadonlyClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgReadPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
