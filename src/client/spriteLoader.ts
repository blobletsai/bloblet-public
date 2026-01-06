export type SpriteManifest = {
  size: { w: number; h: number }
  variants: { id: string; url: string }[]
  anims: { [k: string]: { frames: string[]; fps: number } }
}

export type LoadedSprites = {
  manifest: SpriteManifest
  images: Map<string, HTMLImageElement>
}

export async function loadManifest(url = '/sprites/manifest.json'): Promise<SpriteManifest> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`manifest ${res.status}`)
  return res.json()
}

export async function loadSprites(manifest: SpriteManifest, concurrency = 6): Promise<LoadedSprites> {
  const images = new Map<string, HTMLImageElement>()
  const urls = new Set<string>()
  manifest.variants.forEach(v => urls.add(v.url))
  Object.values(manifest.anims || {}).forEach(a => a.frames.forEach(u => urls.add(u)))
  const list = Array.from(urls)
  let i = 0
  await Promise.all(new Array(Math.min(concurrency, list.length)).fill(0).map(async () => {
    while (i < list.length) {
      const my = i++
      const url = list[my]!
      try {
        const img = await loadImage(url)
        images.set(url, img)
      } catch {
        // leave missing
      }
    }
  }))
  return { manifest, images }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = url
  })
}

export function pickVariantIndex(seed: number, count: number, id: number) {
  // simple LCG mix
  let s = (seed ^ (id * 2654435761)) >>> 0
  s = (s * 1664525 + 1013904223) >>> 0
  return count ? (s % count) : 0
}
