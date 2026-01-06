/**
 * Core Application Configuration
 * Centralizes Supabase, Cron/Admin secrets, and basic environment settings.
 */

interface SupabaseConfig {
  url: string
  anonKey: string
  serviceKey: string
  dbConnection: string
  dbConnectionRead: string
  dbPassword?: string
}

interface AppConfig {
  env: 'development' | 'production' | 'test'
  isProduction: boolean
  isDev: boolean
  urls: {
    docs: string
    apiBase: string
    internalApiBase: string
  }
  auth: {
    cookieDomain: string
    domain: string
  }
  tuning: {
    statusTtlMs: number
    healthThrottleMs: number
  }
  supabase: SupabaseConfig
  secrets: {
    cron: string
    admin: string
    session: string
    internalApi: string
  }
}

function readEnv(key: string, fallback = ''): string {
  return (process.env[key] || fallback).trim()
}

// Helper to support legacy/alternate key names
function readEnvFirst(keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = process.env[key]
    if (val) return val.trim()
  }
  return fallback
}

export const appConfig: AppConfig = {
  env: (process.env.NODE_ENV as any) || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',
  
  urls: {
    docs: (process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.bloblets.ai').trim().replace(/\/$/, ''),
    apiBase: readEnv('API_URL', ''), // Sometimes used in scripts
    internalApiBase: readEnv('INTERNAL_API_BASE_URL', ''),
  },

  auth: {
    cookieDomain: readEnv('AUTH_COOKIE_DOMAIN'),
    domain: readEnvFirst(['AUTH_DOMAIN', 'AUTH_COOKIE_DOMAIN']),
  },

  tuning: {
    statusTtlMs: Math.max(1000, Number(process.env.NEXT_PUBLIC_STATUS_TTL_MS || 3000)),
    healthThrottleMs: Math.max(1000, Number(process.env.NEXT_PUBLIC_HEALTH_THROTTLE_MS || 5000)),
  },

  supabase: {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    anonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    serviceKey: readEnvFirst(['SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']),
    dbConnection: readEnvFirst(['SUPABASE_DB_CONNECTION', 'DATABASE_URL', 'POSTGRES_CONNECTION_STRING']),
    dbConnectionRead: readEnvFirst(['SUPABASE_DB_CONNECTION_READ', 'SUPABASE_DB_CONNECTION']),
    dbPassword: readEnv('SUPABASE_DB_PASSWORD'),
  },

  secrets: {
    cron: readEnv('CRON_SECRET'),
    admin: readEnv('ADMIN_SECRET'),
    session: readEnv('SESSION_SECRET'),
    internalApi: readEnv('INTERNAL_API_SECRET') || readEnv('CRON_SECRET'),
  },
}
