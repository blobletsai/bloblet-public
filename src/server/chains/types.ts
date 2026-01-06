/**
 * Stage 5 Chain Adapter abstractions.
 *
 * These types describe the contract that each chain implementation must fulfil
 * so the rest of the app can remain chain-agnostic. Only the Solana adapter
 * remains active in production.
 */

export type ChainKind = 'sol'

export interface ChainMetadata {
  readonly kind: ChainKind
  readonly label: string
  readonly nativeSymbol: string
  readonly tokenSymbol: string
  readonly tokenDecimals: number
  readonly tokenAddress: string
  readonly network?: string
}

export type AddressString = string

export interface AuthMessageContext {
  readonly address: AddressString
  readonly domain: string
  readonly origin?: string
  readonly nonce: string
}

export interface SignaturePayload {
  readonly address: AddressString
  readonly message: string
  readonly signature: string
}

export interface HolderBalance {
  readonly raw: bigint
  readonly decimals: number
  readonly auxiliary?: Record<string, unknown>
}

export interface HolderSnapshot {
  readonly address: AddressString
  readonly balanceRaw: bigint
  readonly balanceDecimals: number
}

export interface TransferExpectation {
  readonly txHash: string
  readonly tokenAddress: string
  readonly sender: AddressString
  readonly recipient: AddressString | AddressString[]
  readonly minimumAmountRaw: bigint
  readonly memoFragment?: string | null
}

export type TransferVerificationResult =
  | {
      readonly status: 'confirmed'
      readonly txHash: string
      readonly amountRaw: bigint
      readonly decimals: number
      readonly blockNumber?: number
      readonly metadata?: Record<string, unknown>
    }
  | {
      readonly status: 'pending'
      readonly txHash: string
      readonly confirmations?: number
      readonly reason?: string
      readonly metadata?: Record<string, unknown>
    }
  | {
      readonly status: 'failed'
      readonly txHash: string
      readonly reason: string
      readonly metadata?: Record<string, unknown>
    }

export interface ChainAdapter {
  readonly metadata: ChainMetadata

  normalizeAddress(address: string): AddressString
  isValidAddress(address: string): boolean

  buildAuthMessage(ctx: AuthMessageContext): string
  verifySignature(payload: SignaturePayload): Promise<boolean>

  fetchGateBalance(address: AddressString): Promise<HolderBalance>
  fetchTopHolders?(limit: number): Promise<HolderSnapshot[]>

  verifyTokenTransfer(expectation: TransferExpectation): Promise<TransferVerificationResult>
}

export class MissingChainConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingChainConfigError'
  }
}
