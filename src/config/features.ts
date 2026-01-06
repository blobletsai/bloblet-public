/**
 * Feature Flags
 * Centralizes client-side feature toggles (NEXT_PUBLIC_...).
 */

function isTrue(v: string | undefined): boolean {
  const s = String(v || '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

export const featuresConfig = {
  helpWidget: isTrue(process.env.NEXT_PUBLIC_HELP_WIDGET),
  worldDebug: isTrue(process.env.NEXT_PUBLIC_WORLD_DEBUG),
  generativeBlobs: isTrue(process.env.NEXT_PUBLIC_GENERATIVE_BLOBS),
  demoSeed: isTrue(process.env.NEXT_PUBLIC_ENABLE_DEMO_SEED || process.env.ENABLE_DEMO_SEED),
  proxyAssets: isTrue(process.env.NEXT_PUBLIC_PROXY_ASSETS),
  worldStrip: isTrue(process.env.NEXT_PUBLIC_WORLD_STRIP_ENABLED),
  helpOneShot: isTrue(process.env.NEXT_PUBLIC_HELP_ONE_SHOT),
  helpShowSources: (process.env.NEXT_PUBLIC_HELP_SHOW_SOURCES === undefined) 
    ? true 
    : isTrue(process.env.NEXT_PUBLIC_HELP_SHOW_SOURCES),
  canvasDebug: isTrue(process.env.NEXT_PUBLIC_CANVAS_DEBUG),
  realtimeDebug: isTrue(process.env.NEXT_PUBLIC_REALTIME_DEBUG),
}
