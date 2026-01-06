'use client'

import type { SolWalletKind } from '@/src/client/solana/providerPreference'

export type SolanaWindowProvider = {
  isPhantom?: boolean
  isSolflare?: boolean
  isConnected?: boolean
  publicKey?: { toBase58(): string; toString(): string }
  connect: (opts?: any) => Promise<any>
  disconnect?: (opts?: any) => Promise<void> | void
  signMessage?: (message: Uint8Array, displayEncoding?: string) => Promise<Uint8Array | { signature: Uint8Array }>
  autoConnect?: boolean
  setAutoConnect?: (value: boolean) => void
  adapter?: { autoConnect?: boolean; setAutoConnect?: (value: boolean) => void }
  provider?: { autoConnect?: boolean; setAutoConnect?: (value: boolean) => void }
  wallet?: { autoConnect?: boolean; setAutoConnect?: (value: boolean) => void }
}

export type WalletDisconnectLogger = (label: string, detail?: Record<string, unknown>) => void

const KNOWN_SOLANA_WALLETS: Readonly<SolWalletKind[]> = ['phantom', 'solflare']

const defaultLogger: WalletDisconnectLogger = () => {}

export async function disconnectWalletProvider(
  kind: SolWalletKind,
  provider: SolanaWindowProvider | null | undefined,
  logger: WalletDisconnectLogger = defaultLogger,
): Promise<void> {
  const disconnectFn = provider?.disconnect
  if (!provider || typeof disconnectFn !== 'function') {
    logger('wallet.provider.disconnect.skipped', { provider: kind, reason: 'missing_provider' })
    return
  }

  disableAutoConnect(provider, kind, logger)

  const attempts: Array<{ forced: boolean; disconnect(): Promise<void> }> = [
    { forced: true, disconnect: async () => { await disconnectFn.call(provider, { force: true }) } },
    { forced: false, disconnect: async () => { await disconnectFn.call(provider) } },
  ]

  for (const attempt of attempts) {
    try {
      await attempt.disconnect()
      logger('wallet.provider.disconnect', {
        provider: kind,
        forced: attempt.forced,
        stillConnected: !!provider.isConnected,
      })
      return
    } catch (error: any) {
      logger('wallet.provider.disconnect.error', {
        provider: kind,
        forced: attempt.forced,
        error: error?.message || String(error),
      })
    }
  }
}

export async function disconnectSolanaProviders({
  providers,
  priority,
  logger = defaultLogger,
}: {
  providers: Partial<Record<SolWalletKind, SolanaWindowProvider | null>>
  priority?: SolWalletKind[]
  logger?: WalletDisconnectLogger
}): Promise<void> {
  const order = uniqueOrder([...(priority ?? []), ...KNOWN_SOLANA_WALLETS])
  for (const kind of order) {
    await disconnectWalletProvider(kind, providers[kind], logger)
  }
}

function uniqueOrder(values: SolWalletKind[]): SolWalletKind[] {
  const seen = new Set<SolWalletKind>()
  const result: SolWalletKind[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function disableAutoConnect(provider: SolanaWindowProvider, kind: SolWalletKind, logger: WalletDisconnectLogger) {
  let toggled = false
  toggled = setAutoConnectFlag(provider, false) || toggled
  toggled = callAutoConnectSetter(provider, false) || toggled
  if (provider.adapter) {
    toggled = setAutoConnectFlag(provider.adapter as any, false) || toggled
    toggled = callAutoConnectSetter(provider.adapter as any, false) || toggled
  }
  if (provider.provider) {
    toggled = setAutoConnectFlag(provider.provider as any, false) || toggled
    toggled = callAutoConnectSetter(provider.provider as any, false) || toggled
  }
  if (provider.wallet) {
    toggled = setAutoConnectFlag(provider.wallet as any, false) || toggled
    toggled = callAutoConnectSetter(provider.wallet as any, false) || toggled
  }
  if (toggled) {
    logger('wallet.provider.autoconnect.disabled', { provider: kind })
  }
}

function setAutoConnectFlag(target: any, value: boolean) {
  if (!target) return false
  try {
    if (Object.prototype.hasOwnProperty.call(target, 'autoConnect') && target.autoConnect !== value) {
      target.autoConnect = value
      return true
    }
  } catch {}
  return false
}

function callAutoConnectSetter(target: any, value: boolean) {
  if (!target || typeof target.setAutoConnect !== 'function') return false
  try {
    target.setAutoConnect(value)
    return true
  } catch {}
  return false
}
