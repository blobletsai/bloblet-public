import type { ChainAdapter } from '@/src/server/chains/types'
import { serializeOrder } from '@/src/server/orders/services/serialization'
import type { ConfirmOrderResult, OrderLogContext } from '@/src/server/orders/types'
import { rewardLedgerDecimals, rewardPointsToTokenAmountRaw } from '@/src/shared/points'

interface VerifyTransferArgs {
  chain: ChainAdapter
  order: any
  addressRaw: string
  tokenAddress: string
  recipients: string[]
  memoFragment: string | null
  decimals: number
  skipOnchainValidation: boolean
  log: OrderLogContext
}

export type VerifyTransferResult =
  | { kind: 'ok' }
  | { kind: 'pending'; response: ConfirmOrderResult }
  | { kind: 'error'; response: ConfirmOrderResult }

export async function verifyOrderTransfer(args: VerifyTransferArgs): Promise<VerifyTransferResult> {
  const { chain, order, addressRaw, tokenAddress, recipients, memoFragment, decimals, skipOnchainValidation, log } =
    args

  if (skipOnchainValidation) {
    return { kind: 'ok' }
  }

  let normalizedSender: string
  try {
    normalizedSender = chain.normalizeAddress(addressRaw)
  } catch {
    console.warn('[orders.confirm] invalid sender address', { ...log, addressRaw })
    return { kind: 'error', response: { statusCode: 400, body: { error: 'invalid sender address' } } }
  }

  if (!chain.isValidAddress(normalizedSender)) {
    console.warn('[orders.confirm] invalid sender address', { ...log, addressRaw })
    return { kind: 'error', response: { statusCode: 400, body: { error: 'invalid sender address' } } }
  }

  const minimumAmountRaw = rewardPointsToTokenAmountRaw(
    Number((order as any).quote_amount || 0),
    decimals,
    rewardLedgerDecimals(),
  )

  const verification = await chain.verifyTokenTransfer({
    txHash: log.txHash,
    tokenAddress,
    sender: normalizedSender,
    recipient: recipients,
    minimumAmountRaw,
    memoFragment: memoFragment || undefined,
  })

  if (verification.status === 'pending') {
    const need = minConf()
    console.log('[orders.confirm] on-chain verification pending', {
      ...log,
      confirmations: verification.confirmations ?? 0,
      need,
    })
    return {
      kind: 'pending',
      response: {
        statusCode: 200,
        body: {
          ok: true,
          status: 'pending',
          confirmations: verification.confirmations ?? 0,
          need,
          order: serializeOrder(order),
        },
      },
    }
  }

  if (verification.status === 'failed') {
    console.warn('[orders.confirm] on-chain verification failed', {
      ...log,
      reason: verification.reason,
    })
    return { kind: 'error', response: { statusCode: 400, body: { error: verification.reason } } }
  }

  // At this point, adapter reported 'confirmed'. For chains that include
  // transfer decimals and amount in the verification result (e.g., Solana),
  // perform a second, canonical minimum check using RPC-reported decimals to
  // avoid any env mismatch.
  try {
    const confirmed = verification as any
    const hasAmount = confirmed && typeof confirmed.amountRaw !== 'undefined'
    const rpcDecimals = Number(confirmed?.decimals)
    if (hasAmount && Number.isFinite(rpcDecimals)) {
      const d = Math.max(0, Math.floor(rpcDecimals))
      const minRawViaRpc = rewardPointsToTokenAmountRaw(
        Number((order as any).quote_amount || 0),
        d,
        rewardLedgerDecimals(),
      )
      const amt = BigInt(confirmed.amountRaw)
      if (amt < minRawViaRpc) {
        console.warn('[orders.confirm] transfer amount below RPC-scaled minimum', {
          ...log,
          rpcDecimals: d,
          amountRaw: amt.toString(),
          minRawViaRpc: minRawViaRpc.toString(),
        })
        return { kind: 'error', response: { statusCode: 400, body: { error: 'amount_too_low' } } }
      }
    }
  } catch {
    // Non-fatal; fall through to ok
  }

  return { kind: 'ok' }
}

function minConf() {
  return 1
}
