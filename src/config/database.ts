const DEFAULT_DB_PORT = 5432

function readString(key: string): string {
  return (process.env[key] || '').trim()
}

function readNumber(key: string, fallback: number, opts: { min?: number } = {}): number {
  const raw = Number(process.env[key])
  const value = Number.isFinite(raw) ? raw : fallback
  if (opts.min !== undefined) {
    return Math.max(opts.min, value)
  }
  return value
}

export const databaseConfig = {
  fallback: {
    host: readString('DATABASE_HOST'),
    port: readNumber('DATABASE_PORT', DEFAULT_DB_PORT, { min: 1 }),
    name: readString('DATABASE_NAME'),
    user: readString('DATABASE_USER'),
  },
  pool: {
    max: readNumber('PG_POOL_MAX', 5, { min: 1 }),
    readMax: readNumber('PG_POOL_MAX_READ', 5, { min: 1 }),
  },
}

export type DatabaseConfig = typeof databaseConfig
