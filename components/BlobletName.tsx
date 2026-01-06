"use client"

import { useBlobletCtx } from '@/src/client/context/BlobletContext'

export default function BlobletName({ address, initial }: { address: string, initial: string | null }) {
  const ctx = useBlobletCtx()
  const canonical = address || ''
  const name = (ctx && ctx.address === canonical ? ctx.name : (initial || null))
  return <span>{name || 'Bloblet'}</span>
}
