import type { MutableRefObject } from 'react'

import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token'

import type { OrderState } from '@/src/client/hooks/orders/orderTypes'
import type { PayOrderOptions, MergeHistoryFn } from '../../orders/controllerTypes'
import { getSolanaProvider, getSolRpcUrl } from '@/src/client/solana/provider'
import { rewardLedgerDecimals, rewardPointsToTokenAmountRaw, solanaTokenDecimals } from '@/src/shared/points'

type PayOrderContext = {
  state: OrderState
  isTransferring: () => boolean
  setTransferring: (value: boolean) => void
  setReason: (reason: string | null) => void
  setNotice: (value: string | null) => void
  setState: (fn: (prev: OrderState) => OrderState) => void
  mergeHistory: MergeHistoryFn
  resetBackoff: () => void
  prevStatusRef: MutableRefObject<string | null>
  mountedRef: MutableRefObject<boolean>
}

export async function payOrderActionSol(
  ctx: PayOrderContext,
  options: PayOrderOptions,
): Promise<{ ok: boolean; hash: string | null }> {
  if (ctx.isTransferring()) return { ok: false, hash: null }

  const mintStr = String(options.tokenAddress || '').trim()
  const treasuryStr = String(options.treasuryAddress || '').trim()
  const orderId = options.orderId ?? ctx.state.orderId
  const quote = options.quoteAmount ?? ctx.state.quote
  const decimals = Number.isFinite(options.tokenDecimals)
    ? Math.max(0, Math.floor(Number(options.tokenDecimals)))
    : solanaTokenDecimals()

  if (!orderId) {
    ctx.setReason('Create an order first')
    return { ok: false, hash: null }
  }
  if (!mintStr || !treasuryStr) {
    ctx.setReason('Payment configuration invalid — contact support')
    return { ok: false, hash: null }
  }
  const provider = getSolanaProvider()
  if (!provider || !provider.publicKey) {
    ctx.setReason('Connect Phantom or Solflare first')
    return { ok: false, hash: null }
  }
  if (!quote || !Number.isFinite(Number(quote)) || Number(quote) <= 0) {
    ctx.setReason('Quote missing for this order')
    return { ok: false, hash: null }
  }

  ctx.setReason(null)
  ctx.setNotice('Waiting for wallet confirmation…')
  ctx.setTransferring(true)

  try {
    const conn = new Connection(getSolRpcUrl(), { commitment: 'confirmed' })
    const owner = new PublicKey(provider.publicKey.toString())
    const mint = new PublicKey(mintStr)
    const treasuryOwner = new PublicKey(treasuryStr)
    const fromAta = await getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
    const toAta = await getAssociatedTokenAddress(mint, treasuryOwner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

    const ixs = [] as any[]
    const fromInfo = await conn.getAccountInfo(fromAta)
    if (!fromInfo) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          owner,
          fromAta,
          owner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      )
    }
    const toInfo = await conn.getAccountInfo(toAta)
    if (!toInfo) {
      // Idempotent creation of treasury ATA (payer = user); acceptable per claimant-pays policy
      ixs.push(
        createAssociatedTokenAccountInstruction(
          owner,
          toAta,
          treasuryOwner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      )
    }

    const amountRaw = rewardPointsToTokenAmountRaw(
      Number(quote),
      decimals,
      rewardLedgerDecimals(),
    )
    ixs.push(
      createTransferCheckedInstruction(
        fromAta,
        mint,
        toAta,
        owner,
        amountRaw,
        decimals,
        [],
        TOKEN_PROGRAM_ID,
      ),
    )

    const { blockhash } = await conn.getLatestBlockhash('finalized')
    const tx = new Transaction()
    tx.feePayer = owner
    tx.recentBlockhash = blockhash
    for (const ix of ixs) tx.add(ix)

    // Prefer signAndSendTransaction when available
    let sig: string | null = null
    if (typeof provider.signAndSendTransaction === 'function') {
      const res = await provider.signAndSendTransaction(tx)
      sig = typeof res === 'string' ? res : res?.signature || null
    } else if (typeof provider.signTransaction === 'function') {
      const signed = await provider.signTransaction(tx)
      const raw = signed.serialize()
      sig = await conn.sendRawTransaction(raw, { skipPreflight: false })
    } else {
      throw new Error('Wallet does not support transaction signing')
    }

    if (!sig) throw new Error('Unable to obtain transaction signature from wallet')

    ctx.setState((prev) => ({ ...prev, signature: sig as string }))
    ctx.mergeHistory(orderId, { signature: sig as string, type: ctx.state.type })
    ctx.setNotice('Transfer sent — waiting for confirmations…')

    try {
      await conn.confirmTransaction(sig, 'confirmed')
    } catch {}
    ctx.resetBackoff()
    return { ok: true, hash: sig }
  } catch (err: any) {
    const message = String(err?.message || '')
    if (/User rejected|reject/i.test(message)) {
      ctx.setReason('Transfer cancelled in wallet')
    } else {
      ctx.setReason(message || 'Transfer failed')
    }
    ctx.setNotice(null)
    return { ok: false, hash: null }
  } finally {
    if (ctx.mountedRef.current) ctx.setTransferring(false)
  }
}
