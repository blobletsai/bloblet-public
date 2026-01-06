import type { HolderMetaEntry } from '@/components/bloblets-world/types'
import { resolveHolderAvatar } from '@/components/bloblets-world/avatar'

export type ChallengeAvatarResolver = (address: string | null | undefined) => string | null

export function createChallengeAvatarResolver(
  holderMeta: Record<string, HolderMetaEntry>,
): ChallengeAvatarResolver {
  return (address: string | null | undefined) => {
    const resolved = resolveHolderAvatar(holderMeta, address)
    return resolved.alive
  }
}
