export type Mode = 'topup' | 'redeem'

export type RewardsModalConfig = {
  mint: string
  decimals: number
  treasuryWallet: string
  treasuryAta?: string | null
  tokenSymbol?: string
  conversionRate?: number
  walletConnected?: boolean
  isHolder?: boolean
  minTokens?: number | null
  rewardTopUpMin?: number | null
  rewardTopUpMax?: number | null
}

export type RewardsModalResult = {
  mode: Mode
  amount: number
  signature?: string | null
  raw: any
}
