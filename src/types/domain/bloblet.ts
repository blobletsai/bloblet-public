/**
 * Core Bloblet Identity & Entity Types
 */

export type BlobletTier = 'top' | 'middle' | 'bottom'

export interface Bloblet {
  address: string
  // Identity
  name?: string | null
  social_handle?: string | null
  is_alive: boolean
  is_custom?: boolean
  
  // Visuals
  appearance_id?: number | null
  avatar_alive_url_256?: string | null
  assigned_variant_id?: number | null
  dead_url?: string | null // Derived often, but useful to have in type

  // Stats / Economy
  tier: BlobletTier
  rank?: number | null
  percent?: number | null
  balance?: number // Token balance
  reward_balance?: number | null // Points

  // World / Spatial (for props/landmarks)
  entity_type?: 'bloblet' | 'landmark'
  prop_type?: string | null
  prop_id?: number | null
  anchor_x?: number | null
  anchor_y?: number | null
  z?: number | null
  scale?: number | null
  expires_at?: string | null
  
  // Metadata
  rename_count?: number
  size_multiplier?: number
  last_owner?: string | null
}
