import defaultsJson from '../../config/economy-defaults.json'

type EconomyDefaults = typeof defaultsJson
export type EconomyProfileName = keyof EconomyDefaults

type EconomyProfileDefaults = EconomyDefaults[EconomyProfileName]
type FaucetDefaults = EconomyProfileDefaults['faucet']
type GateDefaults = EconomyProfileDefaults['gate']
type RewardTopUpDefaults = EconomyProfileDefaults['rewardTopUp']
type PricingDefaults = EconomyProfileDefaults['pricing']

export interface EconomyFaucetConfig {
  enabled: boolean
  grantRp: number
  gasBnb: number
  maxClaimsPerWallet: number
}

export interface EconomyRewardTopUpConfig {
  minRp: number
  maxRp: number
}

export interface EconomyPricingConfig {
  renameRp: number
  customAvatarRp: number
  landmarkBaseRp: number
  landmarkStepRp: number
  landmarkPremiumPct: number
  chargeCostRp: number
}

export interface EconomyConfig {
  profile: EconomyProfileName
  faucet: EconomyFaucetConfig
  gate: {
    minTokens: number
  }
  rewardTopUp: EconomyRewardTopUpConfig
  pricing: EconomyPricingConfig
}

const ECONOMY_DEFAULTS = defaultsJson as EconomyDefaults
const DEFAULT_CHARGE_COST_RP = 5

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })

function toProfileName(raw: string | undefined): EconomyProfileName {
  if (!raw) return 'sandbox'
  const normalized = raw.trim().toLowerCase()
  return normalized === 'production' ? 'production' : 'sandbox'
}

function readEnvValue(env: NodeJS.ProcessEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]
    if (value !== undefined && value !== '') return value
  }
  return undefined
}

function buildKeyVariants(profile: EconomyProfileName, suffix: string): string[] {
  const upper = profile.toUpperCase()
  return [
    `ECONOMY_${upper}_${suffix}`,
    `NEXT_PUBLIC_ECONOMY_${upper}_${suffix}`,
    `ECONOMY_${suffix}`,
    `NEXT_PUBLIC_ECONOMY_${suffix}`,
  ]
}

function readNumber(
  env: NodeJS.ProcessEnv,
  profile: EconomyProfileName,
  suffix: string,
  fallback: number,
): number {
  const raw = readEnvValue(env, buildKeyVariants(profile, suffix))
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    console.warn(`[economy-config] Invalid number for ${suffix}: "${raw}", falling back to ${fallback}`)
    return fallback
  }
  return parsed
}

function readBoolean(
  env: NodeJS.ProcessEnv,
  profile: EconomyProfileName,
  suffix: string,
  fallback: boolean,
): boolean {
  const raw = readEnvValue(env, buildKeyVariants(profile, suffix))
  if (raw === undefined) return fallback
  const normalized = raw.trim().toLowerCase()
  if (TRUE_VALUES.has(normalized)) return true
  if (FALSE_VALUES.has(normalized)) return false
  console.warn(`[economy-config] Invalid boolean for ${suffix}: "${raw}", falling back to ${fallback}`)
  return fallback
}

function ensurePositive(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  if (value < 0) return fallback
  return value
}

function ensureRange(value: number, floor: number, ceiling: number): number {
  if (!Number.isFinite(value)) return floor
  return Math.min(Math.max(value, floor), ceiling)
}

function formatRp(value: number): string {
  return `${numberFormatter.format(value)} RP`
}

function resolveFaucetConfig(
  env: NodeJS.ProcessEnv,
  profile: EconomyProfileName,
  defaults: FaucetDefaults,
): EconomyFaucetConfig {
  const enabled = readBoolean(env, profile, 'FAUCET_ENABLED', defaults.enabled)
  const grantRp = ensurePositive(readNumber(env, profile, 'FAUCET_RP', defaults.grantRp), defaults.grantRp)
  const gasBnb = Math.max(readNumber(env, profile, 'FAUCET_GAS_BNB', defaults.gasBnb), 0)
  const maxClaims = Math.max(
    Math.trunc(readNumber(env, profile, 'FAUCET_MAX_CLAIMS', defaults.maxClaimsPerWallet)),
    0,
  )
  if (enabled && grantRp === 0) {
    console.warn('[economy-config] Faucet enabled but grant RP is 0; consider disabling or setting a positive grant.')
  }
  return {
    enabled,
    grantRp,
    gasBnb,
    maxClaimsPerWallet: maxClaims,
  }
}

function resolveGateConfig(
  env: NodeJS.ProcessEnv,
  profile: EconomyProfileName,
  defaults: GateDefaults,
) {
  const minTokens = ensurePositive(readNumber(env, profile, 'GATE_MIN_TOKENS', defaults.minTokens), defaults.minTokens)
  return { minTokens }
}

function resolveRewardTopUpConfig(
  env: NodeJS.ProcessEnv,
  profile: EconomyProfileName,
  defaults: RewardTopUpDefaults,
): EconomyRewardTopUpConfig {
  const minRp = ensurePositive(readNumber(env, profile, 'REWARD_TOPUP_MIN_RP', defaults.minRp), defaults.minRp)
  const maxRp = ensurePositive(readNumber(env, profile, 'REWARD_TOPUP_MAX_RP', defaults.maxRp), defaults.maxRp)
  if (maxRp < minRp) {
    console.warn(
      `[economy-config] reward_topup max (${formatRp(maxRp)}) is less than min (${formatRp(
        minRp,
      )}); using min for both.`,
    )
    return { minRp, maxRp: minRp }
  }
  return { minRp, maxRp }
}

function resolvePricingConfig(
  env: NodeJS.ProcessEnv,
  profile: EconomyProfileName,
  defaults: PricingDefaults,
): EconomyPricingConfig {
  const chargeCostRp = ensurePositive(
    readNumber(env, profile, 'CHARGE_COST_RP', readChargeCost(env, DEFAULT_CHARGE_COST_RP)),
    DEFAULT_CHARGE_COST_RP,
  )
  const renameRp = ensurePositive(readNumber(env, profile, 'RENAME_RP', defaults.renameRp), defaults.renameRp)
  const customAvatarRp = ensurePositive(
    readNumber(env, profile, 'CUSTOM_AVATAR_RP', defaults.customAvatarRp),
    defaults.customAvatarRp,
  )
  const landmarkBaseRp = ensurePositive(
    readNumber(env, profile, 'LANDMARK_BASE_RP', defaults.landmarkBaseRp),
    defaults.landmarkBaseRp,
  )
  const landmarkStepRp = ensurePositive(
    readNumber(env, profile, 'LANDMARK_STEP_RP', defaults.landmarkStepRp),
    defaults.landmarkStepRp,
  )
  const landmarkPremiumPct = ensureRange(
    readNumber(env, profile, 'LANDMARK_PREMIUM_PCT', defaults.landmarkPremiumPct),
    0,
    10,
  )
  return {
    renameRp,
    customAvatarRp,
    landmarkBaseRp,
    landmarkStepRp,
    landmarkPremiumPct,
    chargeCostRp,
  }
}

function readChargeCost(env: NodeJS.ProcessEnv, fallback: number): number {
  const raw = readEnvValue(env, ['CARE_CHARGE_COST_POINTS', 'NEXT_PUBLIC_CARE_CHARGE_COST_POINTS'])
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function resolveEconomyConfig(env: NodeJS.ProcessEnv = process.env): EconomyConfig {
  const profile = toProfileName(env.ECONOMY_MODE ?? env.NEXT_PUBLIC_ECONOMY_MODE)
  const profileDefaults = ECONOMY_DEFAULTS[profile]
  return {
    profile,
    faucet: resolveFaucetConfig(env, profile, profileDefaults.faucet),
    gate: resolveGateConfig(env, profile, profileDefaults.gate),
    rewardTopUp: resolveRewardTopUpConfig(env, profile, profileDefaults.rewardTopUp),
    pricing: resolvePricingConfig(env, profile, profileDefaults.pricing),
  }
}

export function resolvePublicEconomyConfig(env: NodeJS.ProcessEnv = process.env): EconomyConfig {
  const publicEnv: NodeJS.ProcessEnv = {
    ...env,
    ECONOMY_MODE: env.NEXT_PUBLIC_ECONOMY_MODE ?? env.ECONOMY_MODE,
  }
  return resolveEconomyConfig(publicEnv)
}

export const economyConfig: EconomyConfig = resolveEconomyConfig()

export function isSandboxProfile(profile: EconomyProfileName): boolean {
  return profile === 'sandbox'
}

export function isProductionProfile(profile: EconomyProfileName): boolean {
  return profile === 'production'
}
