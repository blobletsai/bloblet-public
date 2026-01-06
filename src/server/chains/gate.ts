import { solanaTokenDecimals } from '@/src/shared/points'
import { economyConfig } from '@/src/config/economy'

function parseGateUnits(envValue: any): number {
  const raw = (envValue ?? '').toString().trim()
  if (!raw) return 0
  const match = raw.match(/^(?:"|')?\s*([0-9]+)/)
  if (!match || !match[1]) return 0
  const units = Number.parseInt(match[1], 10)
  return Number.isFinite(units) && units >= 0 ? units : 0
}

export function gateThresholdRaw(decimals?: number, envValue: any = economyConfig.gate.minTokens): bigint {
  const units = parseGateUnits(envValue)
  const resolvedDecimals = Number.isFinite(decimals)
    ? Math.max(0, Math.floor(Number(decimals)))
    : solanaTokenDecimals()
  if (!(units > 0)) return 0n
  const scale = BigInt(10) ** BigInt(resolvedDecimals)
  return BigInt(units) * scale
}

export function meetsGateRequirement(balanceRaw: bigint, decimals?: number, envValue: any = economyConfig.gate.minTokens) {
  const threshold = gateThresholdRaw(decimals, envValue)
  return {
    threshold,
    decimals: Number.isFinite(decimals)
      ? Math.max(0, Math.floor(Number(decimals)))
      : solanaTokenDecimals(),
    isHolder: balanceRaw >= threshold,
  }
}

export function gateUnits(envValue: any = economyConfig.gate.minTokens): number {
  return parseGateUnits(envValue)
}
