"use client"

import dynamic from 'next/dynamic'

const SolanaWalletButton = dynamic(() => import('@/components/SolanaWalletButton'), { ssr: false })

export type WalletButtonProps = {
  hideTitles?: boolean
  disableToasts?: boolean
  anchorPortal?: { top?: number | string; right?: number | string; bottom?: number | string; left?: number | string }
  visuallyHidden?: boolean
}

export default function WalletButton(props: WalletButtonProps) {
  return <SolanaWalletButton {...props} />
}
