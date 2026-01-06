export function toRaw(amountUi: number, decimals: number): bigint {
  if (!Number.isFinite(amountUi) || amountUi < 0) return 0n
  const d = Number.isFinite(decimals) ? Math.max(0, Math.floor(decimals)) : 0
  if (d === 0) return BigInt(Math.round(amountUi))
  const scale = 10 ** d
  return BigInt(Math.round(amountUi * scale))
}

export function toUi(amountRaw: bigint | number | string, decimals: number): number {
  const d = Number.isFinite(decimals) ? Math.max(0, Math.floor(decimals)) : 0
  let raw: bigint
  if (typeof amountRaw === 'bigint') raw = amountRaw
  else if (typeof amountRaw === 'number') raw = BigInt(Math.trunc(amountRaw))
  else raw = BigInt(String(amountRaw || '0'))
  if (d === 0) return Number(raw)
  const negative = raw < 0n
  let abs = negative ? -raw : raw
  const str = abs.toString().padStart(d + 1, '0')
  const whole = str.slice(0, -d) || '0'
  const fraction = str.slice(-d)
  const numeric = Number(`${whole}.${fraction}`)
  return negative ? -numeric : numeric
}

export function pickTokenDecimals(primary?: number, fallback?: number, label = 'token'): number {
  const a = Number.isFinite(primary) ? Math.max(0, Math.floor(Number(primary))) : NaN
  const b = Number.isFinite(fallback) ? Math.max(0, Math.floor(Number(fallback))) : NaN
  if (Number.isFinite(a)) return a
  if (Number.isFinite(b)) return b
  console.warn(`[units] ${label} decimals missing; defaulting to 0`)
  return 0
}

