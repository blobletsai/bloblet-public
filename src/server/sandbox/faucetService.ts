import crypto from 'node:crypto'
import type { PublicKey as SolPubkey } from '@solana/web3.js'
import { Connection as SolConnection, Keypair as SolKeypair, PublicKey as SolPublicKey, Transaction as SolTransaction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID as SPL_ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress as splGetAssociatedTokenAddress, createTransferInstruction as splCreateTransferInstruction, ACCOUNT_SIZE as SPL_TOKEN_ACCOUNT_SIZE } from '@solana/spl-token'

import { sandboxConfig } from '@/src/config/sandbox'
import { resolveEconomyConfig } from '@/src/config/economy'
import { withPgClient } from '@/src/server/pg'
import { getSolanaAddressContext, type SolanaAddressContext } from '@/src/shared/address/solana'
import { rewardLedgerDecimals, rewardPointsToTokenAmountRaw, solanaTokenDecimals } from '@/src/shared/points'

export type FaucetClaimResult =
  | {
      status: 'fulfilled'
      tokenAmount: number
      tokenTxHash: string | null
      fulfilledAt: string
    }
  | {
      status: 'already_claimed'
      tokenAmount: number
      tokenTxHash: string | null
      fulfilledAt: string | null
    }
  | FaucetFailureResult

type FaucetClaimRow = {
  id: number
  status: string
  token_amount: number
  token_amount_raw: string | null
  token_tx_hash: string | null
  fulfilled_at: string | null
  metadata: Record<string, any> | null
  requested_at: string
}

export type FaucetFailureCode =
  | 'no_ata'
  | 'insufficient_sol'
  | 'mint_exhausted'
  | 'unknown_error'
  | 'faucet_disabled'
  | 'cooldown_active'
  | 'address_blocked'

type FaucetFailureResult = {
  status: 'failed'
  errorCode: FaucetFailureCode
  errorMessage: string
  tokenAmount: number
  tokenTxHash: null
  fulfilledAt: null
}

type SolanaAtaState =
  | { kind: 'hasAta'; ata: SolPublicKey }
  | { kind: 'no_ata'; ata: SolPublicKey; ownerLamports: number; requiredLamports: number }
  | { kind: 'insufficient_sol'; ata: SolPublicKey; ownerLamports: number; requiredLamports: number }

export type FaucetRequestOptions = {
  ip?: string | null
  userAgent?: string | null
  country?: string | null
  clientContext?: Record<string, any> | null
}

type FaucetMetadata = {
  receivedAt: string
  userAgent?: string | null
  country?: string | null
  clientContext?: Record<string, any> | null
}

const LAMPORTS_PER_SOL = 1_000_000_000
const SOL_TX_FEE_BUFFER_LAMPORTS = 5_000

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const salt = sandboxConfig.faucet.ipSalt
  if (!salt) return null
  return crypto.createHash('sha256').update(`${ip}|${salt}`).digest('hex')
}

function toJsonb(metadata: FaucetMetadata | null): string | null {
  if (!metadata) return null
  return JSON.stringify(metadata)
}

function toFaucetFailureResult(code: FaucetFailureCode, message: string, tokenAmount: number): FaucetFailureResult {
  return {
    status: 'failed',
    errorCode: code,
    errorMessage: message,
    tokenAmount,
    tokenTxHash: null,
    fulfilledAt: null,
  }
}

function formatLamports(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL
  if (sol >= 1) return sol.toFixed(4)
  if (sol >= 0.01) return sol.toFixed(4)
  return sol.toFixed(6)
}

export function resolveAtaPreparationState(ownerLamports: number, requiredLamports: number): 'insufficient_sol' | 'no_ata' {
  return ownerLamports < requiredLamports ? 'insufficient_sol' : 'no_ata'
}

export function buildFaucetRequestMetadata(options?: FaucetRequestOptions | null, now: Date = new Date()): FaucetMetadata | null {
  if (!options) {
    return { receivedAt: now.toISOString() }
  }
  const meta: FaucetMetadata = { receivedAt: now.toISOString() }
  if (options.userAgent) meta.userAgent = options.userAgent
  if (options.country) meta.country = options.country
  if (options.clientContext && Object.keys(options.clientContext).length > 0) {
    meta.clientContext = options.clientContext
  }
  return meta
}

function isFaucetAddressBlocked(address: string): boolean {
  return sandboxConfig.faucet.blocklist.has(address)
}

async function classifySolanaAtaState(
  conn: SolConnection,
  owner: SolPubkey,
  mint: SolPublicKey,
): Promise<SolanaAtaState> {
  const ata = await splGetAssociatedTokenAddress(mint, owner, false, SPL_TOKEN_PROGRAM_ID, SPL_ASSOCIATED_TOKEN_PROGRAM_ID)
  const info = await conn.getAccountInfo(ata, 'confirmed')
  if (info) return { kind: 'hasAta', ata }

  const [ownerLamports, rentLamports] = await Promise.all([
    conn.getBalance(owner, 'confirmed'),
    conn.getMinimumBalanceForRentExemption(SPL_TOKEN_ACCOUNT_SIZE),
  ])
  const requiredLamports = rentLamports + SOL_TX_FEE_BUFFER_LAMPORTS
  const readiness = resolveAtaPreparationState(ownerLamports, requiredLamports)
  if (readiness === 'insufficient_sol') {
    return { kind: readiness, ata, ownerLamports, requiredLamports }
  }
  return { kind: 'no_ata', ata, ownerLamports, requiredLamports }
}

async function lockOrCreateClaimSol(
  ctx: SolanaAddressContext,
  ipHash: string | null,
  tokenAmountUi: number,
  tokenAmountRaw: bigint,
  metadata: FaucetMetadata | null,
): Promise<{ row: FaucetClaimRow; status: 'processing' | 'already_claimed' }> {
  const chainKind = 'sol'
  const addressCanonical = ctx.canonical
  const metadataJson = toJsonb(metadata)
  return withPgClient(async (client) => {
    await client.query('BEGIN')
    try {
      const existingRes = await client.query<FaucetClaimRow>(
        `select id,
                status,
                token_amount,
                token_amount_raw,
                token_tx_hash,
                fulfilled_at,
                metadata,
                requested_at
           from public.demo_token_faucet_claims
          where chain_kind = $1
            and address_canonical = $2
          for update`,
        [chainKind, addressCanonical],
      )
      const existing = existingRes.rows[0]
      if (existing) {
        if (existing.status === 'fulfilled') {
          await client.query('COMMIT')
          return { row: existing, status: 'already_claimed' }
        }
        const updatedRes = await client.query<FaucetClaimRow>(
          `update public.demo_token_faucet_claims
              set status = 'processing',
                  requested_at = now(),
                  error_code = null,
                  error_message = null,
                  metadata = coalesce($2::jsonb, metadata)
            where id = $1
            returning *`,
          [existing.id, metadataJson],
        )
        const updated = updatedRes.rows[0]
        if (!updated) throw new Error('Failed to resume faucet claim row')
        await client.query('COMMIT')
        return { row: updated, status: 'processing' }
      }

      const insertRes = await client.query<FaucetClaimRow>(
        `insert into public.demo_token_faucet_claims (
           chain_kind,
           address,
           address_canonical,
           status,
           token_amount,
           token_amount_raw,
           ip_hash,
           requested_at,
           metadata
         )
         values ($1, $2, $3, 'processing', $4, $5, $6, now(), coalesce($7::jsonb, '{}'::jsonb))
         returning *`,
        [chainKind, addressCanonical, addressCanonical, tokenAmountUi, tokenAmountRaw.toString(), ipHash, metadataJson],
      )
      const inserted = insertRes.rows[0]
      if (!inserted) throw new Error('Failed to insert faucet claim row')
      await client.query('COMMIT')
      return { row: inserted, status: 'processing' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  })
}

async function updateClaimSuccess(
  claimId: number,
  tokenTxHash: string | null,
): Promise<void> {
  await withPgClient(async (client) => {
    await client.query(
      `update public.demo_token_faucet_claims
          set status = 'fulfilled',
              fulfilled_at = now(),
              token_tx_hash = $2,
              error_code = null,
              error_message = null
        where id = $1`,
      [claimId, tokenTxHash],
    )
  })
}

async function updateClaimFailure(claimId: number, code: string, message: string) {
  await withPgClient(async (client) => {
    await client.query(
      `update public.demo_token_faucet_claims
          set status = 'failed',
              error_code = $2,
              error_message = $3,
              fulfilled_at = null
        where id = $1`,
      [claimId, code, message.slice(0, 512)],
    )
  })
}

export async function requestSandboxFaucetClaim(
  address: string,
  options: FaucetRequestOptions = {},
): Promise<FaucetClaimResult> {
  const rpc = sandboxConfig.faucet.rpcUrl
  const mintStr = sandboxConfig.faucet.tokenMint
  if (!rpc || !mintStr) throw new Error('Solana RPC or token mint not configured')

  const decimals = solanaTokenDecimals()
  const faucetConfig = resolveEconomyConfig().faucet
  const economyGrant = Math.max(0, faucetConfig.grantRp)
  const overrideGrant = sandboxConfig.faucet.grantOverride ?? economyGrant
  const tokenAmountUi = Math.max(0, overrideGrant || economyGrant)
  const tokenAmountRaw = rewardPointsToTokenAmountRaw(tokenAmountUi, decimals, rewardLedgerDecimals())

  if (!faucetConfig.enabled || faucetConfig.maxClaimsPerWallet <= 0 || tokenAmountUi <= 0) {
    return toFaucetFailureResult(
      'faucet_disabled',
      'Sandbox faucet is paused right now. Try again later.',
      tokenAmountUi,
    )
  }

  const ctx = getSolanaAddressContext(address)
  if (isFaucetAddressBlocked(ctx.canonical)) {
    return toFaucetFailureResult('address_blocked', 'This wallet is blocked from the faucet.', tokenAmountUi)
  }

  const metadata = buildFaucetRequestMetadata(options)
  const { row, status } = await lockOrCreateClaimSol(ctx, hashIp(options.ip), tokenAmountUi, tokenAmountRaw, metadata)
  if (status === 'already_claimed') {
    return {
      status: 'already_claimed',
      tokenAmount: Number(row.token_amount ?? tokenAmountUi),
      tokenTxHash: row.token_tx_hash,
      fulfilledAt: row.fulfilled_at,
    }
  }

  const conn = new SolConnection(rpc, { commitment: 'confirmed' })
  const secretJson = sandboxConfig.faucet.treasurySecretJson
  const secret = secretJson ? JSON.parse(secretJson) : null
  if (!Array.isArray(secret)) throw new Error('SOLANA_TREASURY_SECRET_JSON missing')
  const payer = SolKeypair.fromSecretKey(new Uint8Array(secret))
  const owner = ctx.publicKey as SolPubkey
  const mint = new SolPublicKey(mintStr)

  const ataState = await classifySolanaAtaState(conn, owner, mint)
  if (ataState.kind !== 'hasAta') {
    const failureCode: FaucetFailureCode = ataState.kind === 'insufficient_sol' ? 'insufficient_sol' : 'no_ata'
    const message =
      failureCode === 'insufficient_sol'
        ? `Need at least ${formatLamports(ataState.requiredLamports)} SOL to create the BPLAY token account (wallet currently has ${formatLamports(ataState.ownerLamports)} SOL).`
        : 'Create the BPLAY token account in your wallet (Phantom/Solflare) before retrying the faucet.'
    await updateClaimFailure(row.id, failureCode, message)
    return toFaucetFailureResult(failureCode, message, tokenAmountUi)
  }
  const ata = ataState.ata

  const treasury = payer.publicKey
  const treasuryAta = await splGetAssociatedTokenAddress(mint, treasury, false, SPL_TOKEN_PROGRAM_ID, SPL_ASSOCIATED_TOKEN_PROGRAM_ID)
  try {
    const treasuryBal = await conn.getTokenAccountBalance(treasuryAta)
    const availableRaw = BigInt(treasuryBal?.value?.amount || '0')
    if (availableRaw < tokenAmountRaw) {
      const message = 'Faucet treasury is empty. Please try again later.'
      await updateClaimFailure(row.id, 'mint_exhausted', message)
      return toFaucetFailureResult('mint_exhausted', message, tokenAmountUi)
    }
  } catch (err) {
    const message = 'Unable to load faucet treasury balance.'
    await updateClaimFailure(row.id, 'unknown_error', message)
    throw err
  }

  const ix = splCreateTransferInstruction(
    treasuryAta,
    ata,
    treasury,
    tokenAmountRaw,
    [],
    SPL_TOKEN_PROGRAM_ID,
  )
  const tx = new SolTransaction().add(ix)
  const sig = await sendAndConfirmHttp(conn, tx, payer)
  await updateClaimSuccess(row.id, sig)
  return { status: 'fulfilled', tokenAmount: tokenAmountUi, tokenTxHash: sig, fulfilledAt: new Date().toISOString() }
}

// Helper: HTTP-only confirmation loop for Solana
async function sendAndConfirmHttp(conn: SolConnection, tx: SolTransaction, signer: SolKeypair): Promise<string> {
  const { blockhash } = await conn.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = signer.publicKey
  tx.sign(signer)
  const raw = tx.serialize()
  const sig = await conn.sendRawTransaction(raw, { skipPreflight: false })
  const start = Date.now()
  while (Date.now() - start < 60000) {
    const st = await conn.getSignatureStatuses([sig])
    const status = st?.value?.[0]
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return sig
    if (status?.err) throw new Error('Transaction failed: ' + JSON.stringify(status.err))
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Timeout waiting for confirmation: ' + sig)
}
