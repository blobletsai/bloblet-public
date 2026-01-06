"use client"

import { featuresConfig } from '@/src/config/features'

const PROXY_ASSETS_ENV = featuresConfig.proxyAssets

export function shouldProxyAssets(): boolean {
  if (PROXY_ASSETS_ENV) return true
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('proxy') === '1') return true
  }
  return false
}

export function resolveAssetUrl(src: string) {
  if (!src) return src
  if (!shouldProxyAssets()) return src
  return `/api/proxy?u=${encodeURIComponent(src)}`
}

export function loadImage(src: string, attempt = 0): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    if (attempt === 0) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = (err) => {
      if (attempt === 0) {
        loadImage(src, attempt + 1).then(resolve).catch(reject)
        return
      }
      reject(err)
    }
    img.src = resolveAssetUrl(src)
  })
}
