"use client"

import { ReactNode } from 'react'
import { BlobletProvider, BlobletRow } from '@/src/client/context/BlobletContext'

export default function BlobletProviderClient({ address, initial, children }: { address: string; initial?: Partial<BlobletRow>; children: ReactNode }) {
  return (
    <BlobletProvider address={address} initial={initial}>
      {children}
    </BlobletProvider>
  )
}
