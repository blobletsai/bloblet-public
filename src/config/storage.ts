/**
 * Storage Configuration (R2 / Minio)
 * Centralizes bucket, endpoint, and access key settings.
 */

interface StorageConfig {
  endpoint: string
  accessKey: string
  secretKey: string
  region: string
  buckets: {
    persist: string
    temp: string
  }
  public: {
    base: string
    baseTemp: string
  }
  cacheControl: string
}

function val(...candidates: (string | undefined)[]) {
  const found = candidates.find((v) => (v ?? '').trim() !== '') || ''
  return String(found).trim()
}

function derivePublicBase(endpoint: string, bucket: string): string {
  if (!endpoint || !bucket) return ''
  try {
    const u = new URL(endpoint)
    const host = u.hostname // e.g., <account>.r2.cloudflarestorage.com
    const account = host.split('.')[0]
    if (account && host.includes('r2.cloudflarestorage.com')) {
      return `https://${bucket}.${account}.r2.dev`
    }
  } catch {}
  return ''
}

// Compute values
const endpoint = val(process.env.R2_ENDPOINT, process.env.CLOUDFLARE_R2_ENDPOINT)
const bucketPersist = val(process.env.R2_BUCKET_PERSIST, process.env.R2_BUCKET_GENERATIONS)
const bucketTemp = val(process.env.R2_BUCKET_TEMP, process.env.R2_BUCKET_TEMP_UPLOADS, process.env.R2_BUCKET_PERSIST)

const basePersist = val(process.env.R2_PUBLIC_BASE_URL, process.env.R2_PUBLIC_URL, process.env.R2_PUBLIC_URL_GENERATIONS)
  .replace(/\/$/, '') || derivePublicBase(endpoint, bucketPersist)

const baseTemp = val(process.env.R2_PUBLIC_BASE_URL_TEMP, process.env.R2_PUBLIC_URL_TEMP)
  .replace(/\/$/, '')

export const storageConfig: StorageConfig = {
  endpoint,
  accessKey: val(process.env.R2_ACCESS_KEY_ID, process.env.CLOUDFLARE_R2_ACCESS_KEY),
  secretKey: val(process.env.R2_SECRET_ACCESS_KEY, process.env.CLOUDFLARE_R2_SECRET_KEY),
  region: process.env.R2_REGION || 'auto',
  buckets: {
    persist: bucketPersist,
    temp: bucketTemp,
  },
  public: {
    base: basePersist,
    baseTemp: baseTemp,
  },
  cacheControl: process.env.R2_CACHE_CONTROL || 'public, max-age=31536000, immutable',
}
