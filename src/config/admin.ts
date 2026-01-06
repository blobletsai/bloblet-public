import { appConfig } from '@/src/config/app'

function readBoolean(key: string, fallback = false): boolean {
  const raw = (process.env[key] || '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  return fallback
}

export const adminConfig = {
  allowAllAccess: readBoolean('ADMIN_ALLOW_ALL'),
  secrets: {
    cron: appConfig.secrets.cron,
    admin: appConfig.secrets.admin,
  },
}

export type AdminConfig = typeof adminConfig
