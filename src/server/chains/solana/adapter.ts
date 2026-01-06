import bs58 from 'bs58'
import nacl from 'tweetnacl'

import {
  type AuthMessageContext,
  type ChainAdapter,
  type ChainMetadata,
  type HolderBalance,
  type HolderSnapshot,
  type SignaturePayload,
  type TransferExpectation,
  type TransferVerificationResult,
  MissingChainConfigError,
} from '../types'
import { solanaTokenDecimals } from '@/src/shared/points'
import { fetchSolanaTopHolders } from './solscan'
import { getOwnerMintBalanceRaw, getTransaction, getSignatureStatuses } from './rpc'
import { getSolanaAddressContext, isValidSolanaAddress } from '@/src/shared/address/solana'
import { solanaConfig } from '@/src/config/solana'

// Token program ID for SPL tokens
const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

const metadata = {
  kind: 'sol' as const,
  label: 'Solana',
  nativeSymbol: 'SOL',
  tokenSymbol: solanaConfig.token.symbol,
  tokenDecimals: solanaTokenDecimals(),
  tokenAddress: solanaConfig.token.mint,
} satisfies ChainMetadata

function requireTokenMint(): string {
  const mint = solanaConfig.token.mint
  if (!mint) throw new MissingChainConfigError('SOLANA_TOKEN_MINT missing')
  if (!metadata.tokenAddress) (metadata as any).tokenAddress = mint
  return mint
}

function normalize(address: string): string {
  return getSolanaAddressContext(address).canonical
}

function normalizeForMessage(address: string): string {
  const trimmed = String(address || '').trim()
  if (!trimmed) return ''
  try {
    return getSolanaAddressContext(trimmed).canonical
  } catch {
    return trimmed
  }
}

function isValidBase58Address(address: string): boolean {
  return isValidSolanaAddress(address)
}

function canonicalMessage(ctx: AuthMessageContext): string {
  const lines = [
    'Verify Bloblet Ownership',
    '',
    'This confirms you hold tokens to access features',
    '',
    `Domain: ${ctx.domain}`,
    `Address: ${ctx.address}`,
    `Nonce: ${ctx.nonce}`,
  ]
  return lines.join('\n')
}

function asLower(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function extractRpcTransfer(tx: any, tokenAddress: string):
  | { mint: string; owner: string; destination: string; amountRaw: bigint; decimals: number }
  | null {
  const expectedMintLower = asLower(tokenAddress)
  const msg = tx?.transaction?.message
  const ix = Array.isArray(msg?.instructions) ? msg.instructions : []
  for (const ins of ix) {
    const program = String(ins?.program || '').toLowerCase()
    const programId = String(ins?.programId || ins?.programId?.toString?.() || '')
    const parsed = ins?.parsed
    const type = String(parsed?.type || '').toLowerCase()
    if (!(program === 'spl-token' || programId === SPL_TOKEN_PROGRAM)) continue
    if (type !== 'transferChecked'.toLowerCase()) continue
    const info = parsed?.info || {}
    const mint = String(info?.mint || '')
    if (asLower(mint) !== expectedMintLower) continue
    const owner = String(info?.owner || info?.authority || '')
    const destination = String(info?.destination || '')
    const amountStr = String(info?.tokenAmount?.amount ?? '0')
    let amountRaw = 0n
    try {
      amountRaw = BigInt(amountStr)
    } catch {
      amountRaw = 0n
    }
    const decimals = Number(info?.tokenAmount?.decimals)
    const dec = Number.isFinite(decimals) && decimals >= 0 ? Math.floor(decimals) : metadata.tokenDecimals
    return { mint, owner, destination, amountRaw, decimals: dec }
  }
  return null
}

async function verifyTransfer(expectation: TransferExpectation): Promise<TransferVerificationResult> {
  const txHash = expectation.txHash

  // Check signature status first for quick pending determination
  let status = null as { confirmations: number | null; confirmationStatus: string | null } | null
  try {
    status = await getSignatureStatuses(txHash)
  } catch {
    // ignore; fall through to transaction fetch
  }

  const confirmationStatus = status?.confirmationStatus || null
  if (!confirmationStatus || (confirmationStatus !== 'confirmed' && confirmationStatus !== 'finalized')) {
    const confirmations = status?.confirmations ?? undefined
    return { status: 'pending', txHash, confirmations, reason: 'not_confirmed' }
  }

  // Fetch and parse transaction via RPC (jsonParsed)
  const tx = await getTransaction(txHash)
  if (!tx) return { status: 'pending', txHash, reason: 'not_found' }
  const meta = tx?.meta || {}
  if (meta?.err != null) {
    return { status: 'failed', txHash, reason: 'tx_error', metadata: { err: meta.err } }
  }

  const tokenAddress = String(expectation.tokenAddress || '')
  if (!tokenAddress) return { status: 'failed', txHash, reason: 'token_address_missing' }

  const transfer = extractRpcTransfer(tx, tokenAddress)
  if (!transfer) return { status: 'failed', txHash, reason: 'no_token_transfer' }

  // Validate sender (owner of source token account)
  const expectedSender = String(expectation.sender || '')
  if (transfer.owner !== expectedSender) {
    return { status: 'failed', txHash, reason: 'wrong_sender', metadata: { sender: transfer.owner, expectedSender } }
  }

  // Validate recipient (treasury owner or its ATA)
  const recipients = Array.isArray(expectation.recipient) ? expectation.recipient : [expectation.recipient]
  const treasuryOwner = recipients[0]
  const accountKeys: string[] = Array.isArray(tx?.transaction?.message?.accountKeys)
    ? tx.transaction.message.accountKeys.map((k: any) => (typeof k === 'string' ? k : String(k?.pubkey || '')))
    : []
  const destIndex = accountKeys.findIndex((k) => k === transfer.destination)
  const postBalances = Array.isArray(meta?.postTokenBalances) ? meta.postTokenBalances : []
  const destBalanceEntry = postBalances.find((b: any) => Number(b?.accountIndex) === destIndex)
  const destOwner = String(destBalanceEntry?.owner || '')
  const mintLower = asLower(tokenAddress)
  const ownerMatch = destOwner === treasuryOwner
  const mintMatch = asLower(destBalanceEntry?.mint || '') === mintLower
  if (!(ownerMatch && mintMatch)) {
    // Fallback: accept if any postTokenBalances entry shows the treasury owner + mint
    const anyMatch = postBalances.some(
      (b: any) => String(b?.owner || '') === treasuryOwner && asLower(b?.mint || '') === mintLower,
    )
    if (!anyMatch) {
      return {
        status: 'failed',
        txHash,
        reason: 'wrong_destination',
        metadata: { destination: transfer.destination, expectedOwner: treasuryOwner },
      }
    }
  }

  // Amount check
  if (transfer.amountRaw < expectation.minimumAmountRaw) {
    return {
      status: 'failed',
      txHash,
      reason: 'amount_too_low',
      metadata: { amount: transfer.amountRaw.toString(), minimum: expectation.minimumAmountRaw.toString() },
    }
  }

  const blockNumber = Number.isFinite(tx?.slot) ? Number(tx.slot) : undefined
  return {
    status: 'confirmed',
    txHash,
    amountRaw: transfer.amountRaw,
    decimals: transfer.decimals,
    blockNumber,
    metadata: { destination: transfer.destination },
  }
}

export const solanaAdapter: ChainAdapter = {
  metadata,
  normalizeAddress(address: string) { return normalize(address) },
  isValidAddress(address: string) { const trimmed = normalize(address); if (!trimmed) return false; return isValidBase58Address(trimmed) },
  buildAuthMessage(ctx: AuthMessageContext) {
    return canonicalMessage({
      address: normalizeForMessage(ctx.address),
      domain: ctx.domain,
      origin: ctx.origin,
      nonce: ctx.nonce,
    })
  },
  async verifySignature(payload: SignaturePayload) {
    try {
      const address = normalize(payload.address)
      const message = String(payload.message || '').replace(/\r\n/g, '\n')
      const signature = String(payload.signature || '').trim()
      if (!signature) return false
      const pubkey = bs58.decode(address)
      const sig = bs58.decode(signature)
      if (pubkey.length !== 32) return false
      return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pubkey)
    } catch { return false }
  },
  async fetchGateBalance(address: string): Promise<HolderBalance> {
    const mint = requireTokenMint()
    const owner = normalize(address)
    const { raw, decimals, ata } = await getOwnerMintBalanceRaw(owner, mint)
    return { raw, decimals, auxiliary: { ata } }
  },
  async fetchTopHolders(limit: number): Promise<HolderSnapshot[]> {
    const mint = requireTokenMint()
    const normalizedLimit = Math.max(1, Math.min(2000, Number(limit) || 2000))
    const items = await fetchSolanaTopHolders(mint, normalizedLimit)
    return items.map((item) => ({ address: normalize(item.owner), balanceRaw: BigInt(Math.max(0, Math.floor(Number(item.amount || 0)))), balanceDecimals: Number(item.decimals || metadata.tokenDecimals) }))
  },
  verifyTokenTransfer: verifyTransfer,
}

export default solanaAdapter
