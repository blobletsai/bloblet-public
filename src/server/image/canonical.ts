import { assetConfig } from '@/src/config/assets'

let didWarnCanvasMissing = false

async function loadCanvasModule(): Promise<typeof import('canvas') | null> {
  try {
    return await import('canvas')
  } catch (error) {
    if (!didWarnCanvasMissing) {
      console.warn('[ensurePngSize] canvas unavailable; returning original buffer', {
        message: (error as Error)?.message || String(error),
      })
      didWarnCanvasMissing = true
    }
    return null
  }
}

export async function ensurePngSize(buffer: Buffer, size = assetConfig.avatars.canonicalSize): Promise<Buffer> {
  try {
    const canvasModule = await loadCanvasModule()
    if (!canvasModule) return buffer
    const { createCanvas, loadImage } = canvasModule
    const target = Math.max(1, size)
    const img = await loadImage(buffer)
    if (img.width === target && img.height === target) return buffer
    const canvas = createCanvas(target, target)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, target, target)
    ctx.drawImage(img, 0, 0, target, target)
    return canvas.toBuffer('image/png')
  } catch (error) {
    console.warn('[ensurePngSize] failed to resize sprite', { message: (error as Error)?.message || String(error) })
    return buffer
  }
}
