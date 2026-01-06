function parseDecimals(value: any, fallback: number, max = 12): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(max, Math.max(0, Math.floor(parsed)))
}

const DISPLAY_DECIMALS = (() => {
  const envValue = process.env.REWARD_DECIMALS
  return parseDecimals(envValue, 2, 6)
})()

const LEDGER_DECIMALS = 0

const SOLANA_TOKEN_DECIMALS = (() => {
  const envValue = process.env.SOLANA_TOKEN_DECIMALS
  return parseDecimals(envValue, 6, 9)
})()

function parseNumber(value: any): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const DEFAULT_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: Math.min(2, DISPLAY_DECIMALS),
})

function buildFormatter(options?: Intl.NumberFormatOptions) {
  if (!options) return DEFAULT_FORMATTER
  return new Intl.NumberFormat('en-US', options)
}

export function rewardDecimals(): number {
  return DISPLAY_DECIMALS
}

export function rewardLedgerDecimals(): number {
  return LEDGER_DECIMALS
}

export function solanaTokenDecimals(): number {
  return SOLANA_TOKEN_DECIMALS
}

export function parseRawPoints(value: any): number {
  return parseNumber(value)
}

export function formatDisplayPoints(value: number, options?: Intl.NumberFormatOptions): string {
  const formatter = buildFormatter(options)
  return formatter.format(parseNumber(value))
}

export function formatPoints(raw: number, options?: Intl.NumberFormatOptions): string {
  const normalized = parseNumber(raw)
  const formatter = buildFormatter(options ?? inferPointFormatOptions(normalized))
  return formatter.format(normalized)
}

export function formatDeltaPoints(value: number, options?: Intl.NumberFormatOptions): string {
  const normalized = parseNumber(value)
  const abs = Math.abs(normalized)
  const formatter = buildFormatter(options ?? inferPointFormatOptions(abs))
  const formatted = formatter.format(abs)
  if (normalized > 0) return `+${formatted}`
  if (normalized < 0) return `-${formatted}`
  return formatted
}

export function formatDeltaRaw(raw: number, options?: Intl.NumberFormatOptions): string {
  return formatDeltaPoints(raw, options)
}

function inferPointFormatOptions(value: number): Intl.NumberFormatOptions {
  if (value >= 100) {
    return { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  }
  if (value >= 10) {
    return { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  }
  return { minimumFractionDigits: 2, maximumFractionDigits: 2 }
}

function parseBigInt(value: bigint | number | string): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot convert non-finite number to bigint')
    return BigInt(Math.trunc(value))
  }
  const trimmed = String(value || '').trim()
  if (!trimmed) return 0n
  return BigInt(trimmed)
}

function bigIntToNumberWithScale(value: bigint, scale: number): number {
  if (scale === 0) return Number(value)
  if (scale < 0) {
    const multiplier = 10n ** BigInt(Math.abs(scale))
    return Number(value * multiplier)
  }
  const negative = value < 0n
  let abs = negative ? -value : value
  const str = abs.toString().padStart(scale + 1, '0')
  const whole = str.slice(0, -scale) || '0'
  const fraction = str.slice(-scale)
  const numeric = Number(`${whole}.${fraction}`)
  return negative ? -numeric : numeric
}

export function normalizeLedgerPoints(raw: any, _decimals: number = LEDGER_DECIMALS): number {
  return parseNumber(raw)
}

export function tokenAmountToLedgerPoints(
  rawAmount: bigint | number | string,
  tokenDecimals: number = SOLANA_TOKEN_DECIMALS,
  ledgerDecimals: number = LEDGER_DECIMALS
): number {
  const tokenDec = Number.isFinite(tokenDecimals) ? Math.max(0, Math.floor(tokenDecimals)) : 0
  const ledgerDec = Number.isFinite(ledgerDecimals) ? Math.max(0, Math.floor(ledgerDecimals)) : 0
  const amount = parseBigInt(rawAmount)
  if (tokenDec === ledgerDec) {
    return Number(amount)
  }
  if (tokenDec > ledgerDec) {
    const diff = tokenDec - ledgerDec
    return bigIntToNumberWithScale(amount, diff)
  }
  const multiplier = 10n ** BigInt(ledgerDec - tokenDec)
  return Number(amount * multiplier)
}

export function rewardRawToTokenAmountRaw(
  rewardRaw: bigint | number | string,
  tokenDecimals: number = SOLANA_TOKEN_DECIMALS,
  rewardDecimals: number = LEDGER_DECIMALS
): bigint {
  const raw = parseBigInt(rewardRaw)
  if (tokenDecimals === rewardDecimals) return raw
  if (tokenDecimals > rewardDecimals) {
    const multiplier = 10n ** BigInt(tokenDecimals - rewardDecimals)
    return raw * multiplier
  }
  const divisor = 10n ** BigInt(rewardDecimals - tokenDecimals)
  return raw / divisor
}

export function rewardPointsToTokenAmountRaw(
  points: number,
  tokenDecimals: number = SOLANA_TOKEN_DECIMALS,
  rewardDecimals: number = LEDGER_DECIMALS
): bigint {
  const normalizedPoints = parseNumber(points)
  if (!Number.isFinite(normalizedPoints) || normalizedPoints === 0) return 0n
  const scale = rewardDecimals > 0 ? 10 ** rewardDecimals : 1
  const rewardRawNumber = Math.round(normalizedPoints * scale)
  const rewardRaw = BigInt(rewardRawNumber)
  return rewardRawToTokenAmountRaw(rewardRaw, tokenDecimals, rewardDecimals)
}

export function tokenAmountRawToRewardRaw(
  rawAmount: bigint | number | string,
  tokenDecimals: number = SOLANA_TOKEN_DECIMALS,
  rewardDecimals: number = LEDGER_DECIMALS
): number {
  return tokenAmountToLedgerPoints(rawAmount, tokenDecimals, rewardDecimals)
}
