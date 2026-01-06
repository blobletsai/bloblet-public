import { Client as MinioClient } from 'minio'
import { storageConfig } from '../config/storage'

type BucketKind = 'persist' | 'temp'

// ----- R2 (S3) helpers -----

function r2Client() {
  const ep = storageConfig.endpoint
  const url = new URL(ep)
  const endPoint = url.hostname
  const useSSL = url.protocol === 'https:'
  const port = url.port ? Number(url.port) : useSSL ? 443 : 80
  const { accessKey, secretKey, region } = storageConfig
  return new MinioClient({ endPoint, port, useSSL, accessKey, secretKey, region, pathStyle: true } as any)
}

function r2Bucket(kind?: BucketKind) {
  if (kind === 'temp') return storageConfig.buckets.temp
  return storageConfig.buckets.persist
}

function r2PublicBase(kind?: BucketKind) {
  if (kind === 'temp') {
    const tb = storageConfig.public.baseTemp
    if (tb) return tb
  }
  const base = storageConfig.public.base
  if (base) return base
  return ''
}

export async function uploadPublic(options: { key: string; body: Buffer; contentType: string; cacheControl?: string; kind?: BucketKind }) {
  const { key, body, contentType, cacheControl, kind } = options
  const bucket = r2Bucket(kind)
  if (!bucket) throw new Error('R2 bucket not configured')
  const cli = r2Client()
  await cli.putObject(bucket, key, body, body.length, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl || storageConfig.cacheControl,
  } as any)
  const base = r2PublicBase(kind)
  if (!base) throw new Error('R2 public base URL not configured')
  return `${base}/${encodeURI(key)}`
}

export function getPublicUrl(key: string, kind?: BucketKind) {
  const base = r2PublicBase(kind)
  if (!base) throw new Error('R2 public base URL not configured')
  return `${base}/${encodeURI(key)}`
}

export async function removeByUrl(url: string) {
  const u = new URL(url)
  const host = u.hostname
  let bucket = ''
  let key = ''
  
  // Pattern 0: match configured public bases
  const persistBase = storageConfig.public.base
  const tempBase = storageConfig.public.baseTemp
  
  try {
    if (persistBase) {
      const pb = new URL(persistBase)
      if (host === pb.hostname) {
        bucket = storageConfig.buckets.persist
        key = u.pathname.replace(/^\//, '')
      }
    }
    if (!bucket && tempBase) {
      const tb = new URL(tempBase)
      if (host === tb.hostname) {
        bucket = storageConfig.buckets.temp
        key = u.pathname.replace(/^\//, '')
      }
    }
  } catch {}
  
  // Pattern 1: <bucket>.r2.dev/<key>
  if (!bucket) {
    const m = host.match(/^([^.]+)\./)
    if (m && host.includes('.r2.dev')) {
      const b = m?.[1] || ''
      if (b) bucket = b
      key = u.pathname.replace(/^\//, '')
    }
  }
  // Pattern 2: <endpoint>/<bucket>/<key>
  if (!bucket) {
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      const b = parts[0] || ''
      bucket = b
      key = parts.slice(1).join('/')
    }
  }
  if (!bucket || !key) return
  const cli = r2Client()
  try {
    await cli.removeObject(bucket, key)
  } catch {}
}

export async function removeManyByUrl(urls: string[]) {
  for (const u of urls) {
    // eslint-disable-next-line no-await-in-loop
    await removeByUrl(u)
  }
}
