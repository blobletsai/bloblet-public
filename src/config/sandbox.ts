import { appConfig } from './app'
import { solanaConfig } from './solana'
import { solanaTokenDecimals } from '../shared/points'

function trim(value?: string | null): string {
  return (value || '').trim()
}

function readNumber(key: string, fallback: number, opts: { min?: number } = {}): number {
  const raw = Number(process.env[key])
  let value = Number.isFinite(raw) ? raw : fallback
  if (opts.min !== undefined) value = Math.max(opts.min, value)
  return value
}

function readOptionalNumber(key: string): number | null {
  const raw = Number(process.env[key])
  return Number.isFinite(raw) ? raw : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readBigInt(key: string, fallback: bigint): bigint {
  const raw = (process.env[key] || '').trim()
  if (!raw.length) return fallback
  try {
    return BigInt(raw)
  } catch {
    return fallback
  }
}

function splitList(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(/[, \n\r\t]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const faucetBlocklist = new Set([
  ...splitList(process.env.BPLAY_FAUCET_BLOCKLIST),
  ...splitList(process.env.FAUCET_BLOCKLIST),
])

const faucetGrantOverride =
  readOptionalNumber('BPLAY_FAUCET_TOKEN_AMOUNT') ?? readOptionalNumber('FAUCET_TOKEN_AMOUNT')

const sandboxTreasuryAddress =
  trim(process.env.BSC_TREASURY_ADDRESS) ||
  trim(process.env.TREASURY_ADDRESS) ||
  trim(solanaConfig.treasury.publicKey)

const simHolderCount = readNumber('SIM_HOLDER_COUNT', 2000, { min: 1 })
const simSeed = readNumber('SIM_SEED', 42)
const simChurnRate = clamp(readNumber('SIM_CHURN_RATE', 0.005, { min: 0 }), 0, 1)
const simVolatility = Math.max(0, readNumber('SIM_VOLATILITY', 1))
const simWhaleProb = clamp(readNumber('SIM_WHALE_PROB', 0.01, { min: 0 }), 0, 1)
const simSupplyRaw = readBigInt('SIM_SUPPLY_RAW', 1000000000000000n)

export const sandboxConfig = {
  faucet: {
    ipSalt: trim(process.env.FAUCET_IP_SALT) || trim(appConfig.secrets.session),
    blocklist: faucetBlocklist,
    rpcUrl: solanaConfig.rpcUrl,
    tokenMint: trim(solanaConfig.token.mint),
    grantOverride: faucetGrantOverride,
    treasurySecretJson: trim(process.env.SOLANA_TREASURY_SECRET_JSON),
  },
  trade: {
    depositAmount: readNumber('SANDBOX_TRADE_DEPOSIT', 120, { min: 1 }),
    withdrawAmount: readNumber('SANDBOX_TRADE_WITHDRAW', 35, { min: 1 }),
    reserveFloor: readNumber('SANDBOX_TRADE_FLOOR', 5, { min: 0 }),
    treasuryAddress: sandboxTreasuryAddress,
  },
  simulation: {
    holderCount: simHolderCount,
    seed: simSeed,
    decimals: solanaTokenDecimals(),
    churnRate: simChurnRate,
    volatility: simVolatility,
    whaleProb: simWhaleProb,
    supplyRaw: simSupplyRaw,
  },
}

export type SandboxConfig = typeof sandboxConfig
