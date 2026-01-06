const VISIBILITY_FLAG = String(process.env.NEXT_PUBLIC_VISIBILITY_DEBUG || '')
  .trim()
  .toLowerCase()

export function isVisibilityDebugEnabled(): boolean {
  if (!VISIBILITY_FLAG) return false
  return VISIBILITY_FLAG === '1' || VISIBILITY_FLAG === 'true' || VISIBILITY_FLAG === 'yes'
}

export function logVisibilityDebug(label: string, payload?: unknown) {
  if (!isVisibilityDebugEnabled()) return
  if (typeof window === 'undefined') return
  const prefix = '[visibility-debug]'
  if (payload === undefined) {
    console.log(`${prefix} ${label}`)
    return
  }
  console.log(`${prefix} ${label}`, payload)
}
