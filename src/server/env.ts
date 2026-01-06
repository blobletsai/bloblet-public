export function envTrue(val?: string | null): boolean {
  if (val === undefined || val === null) return false
  const v = String(val).trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'on'
}

