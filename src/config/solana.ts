/**
 * Solana Configuration
 * Centralizes RPC, Token, and Treasury settings.
 */

interface SolanaConfig {
  cluster: 'mainnet-beta' | 'devnet' | 'testnet'
  rpcUrl: string
  rpcUrlPublic: string
  solscanApiKey: string
  token: {
    mint: string
    symbol: string
    decimals: number
  }
  treasury: {
    publicKey: string
  }
}

function val(...candidates: (string | undefined)[]) {
  const found = candidates.find((v) => (v ?? '').trim() !== '') || ''
  return String(found).trim()
}

const clusterRaw = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || process.env.SOLANA_CLUSTER || '').trim().toLowerCase()
const cluster = (clusterRaw === 'devnet' || clusterRaw === 'testnet') ? clusterRaw : 'mainnet-beta'

const rpcUrlPublic = (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || '').trim() || 
  (cluster === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com')

const rpcUrl = (process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '').trim() || rpcUrlPublic

export const solanaConfig: SolanaConfig = {
  cluster,
  rpcUrl,
  rpcUrlPublic,
  solscanApiKey: val(process.env.SOLSCAN_API_KEY),
  token: {
    mint: (process.env.SOLANA_TOKEN_MINT || process.env.NEXT_PUBLIC_SOLANA_TOKEN_MINT || '').trim(),
    symbol: (process.env.NEXT_PUBLIC_REWARD_TOKEN_SYMBOL || process.env.NEXT_PUBLIC_TOKEN_SYMBOL || process.env.TOKEN_SYMBOL || '').trim() || 'BPLAY',
    decimals: 6, // Default for now, or could read SOLANA_TOKEN_DECIMALS
  },
  treasury: {
    publicKey: (process.env.SOLANA_TREASURY_PUBLIC_KEY || process.env.NEXT_PUBLIC_SOLANA_TREASURY_PUBLIC_KEY || '').trim(),
  },
}
