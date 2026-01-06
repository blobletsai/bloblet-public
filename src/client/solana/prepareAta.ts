"use client"

import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token'

import { getSolanaProvider, getSolRpcUrl } from '@/src/client/solana/provider'
import { solanaConfig } from '@/src/config/solana'

type PrepareResult =
  | { status: 'already_exists' }
  | { status: 'prepared'; signature: string }

export async function prepareBplayTokenAccount(): Promise<PrepareResult> {
  const mintStr = solanaConfig.token.mint
  if (!mintStr) throw new Error('Token mint not configured')

  const provider = getSolanaProvider()
  if (!provider || !provider.publicKey) {
    throw new Error('Connect Phantom or Solflare before preparing the account')
  }

  const owner = new PublicKey(provider.publicKey.toString())
  const mint = new PublicKey(mintStr)
  const conn = new Connection(getSolRpcUrl(), { commitment: 'confirmed' })

  const ata = await getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
  const info = await conn.getAccountInfo(ata)
  if (info) return { status: 'already_exists' }

  const ix = createAssociatedTokenAccountInstruction(
    owner,
    ata,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  const { blockhash } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction()
  tx.feePayer = owner
  tx.recentBlockhash = blockhash
  tx.add(ix)

  let signature: string | null = null
  if (typeof provider.signAndSendTransaction === 'function') {
    const res = await provider.signAndSendTransaction(tx)
    signature = typeof res === 'string' ? res : res?.signature || null
  } else if (typeof provider.signTransaction === 'function') {
    const signed = await provider.signTransaction(tx)
    const raw = signed.serialize()
    signature = await conn.sendRawTransaction(raw, { skipPreflight: false })
  } else {
    throw new Error('Wallet does not support transaction signing')
  }

  if (!signature) throw new Error('Unable to obtain transaction signature')
  await conn.confirmTransaction(signature, 'confirmed')
  return { status: 'prepared', signature }
}

