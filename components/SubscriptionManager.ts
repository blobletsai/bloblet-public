import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { attachChannelWithRetry } from '@/src/client/realtime/helpers'

type UpdateHandler = (payload: any) => void

/**
 * Manages realtime subscription for sprite updates
 * Uses a single unfiltered channel and filters client-side for reliability
 */
export class SubscriptionManager {
  private supabase: SupabaseClient
  private handler: UpdateHandler
  private visibleAddresses = new Set<string>()
  private channel: RealtimeChannel | null = null
  private cleanupFn: (() => void) | null = null
  private debug: boolean

  constructor(supabase: SupabaseClient, handler: UpdateHandler, debug = false) {
    this.supabase = supabase
    this.handler = handler
    this.debug = debug
    
    // Create single unfiltered subscription immediately
    this.createUnfilteredSubscription()
  }

  /**
   * Create a single unfiltered subscription to all bloblets updates
   * Filter client-side based on visible addresses
   */
  private createUnfilteredSubscription() {
    if (this.cleanupFn) {
      this.cleanupFn()
      this.cleanupFn = null
    }

    console.log('[SubManager] 🔵 Creating REALTIME subscription to bloblets table...')
    console.log('[SubManager] Supabase client exists:', !!this.supabase)
    console.log('[SubManager] Supabase URL:', (this.supabase as any).supabaseUrl?.substring(0, 30) + '...')
    this.cleanupFn = attachChannelWithRetry(
      this.supabase,
      '[SubManager] bloblets-all channel',
      () => {
        this.channel = this.supabase
          .channel('bloblets-all')
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to ALL events (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'bloblets',
            },
            (payload: any) => {
              console.log('[SubManager] 🔴 REALTIME EVENT:', {
                eventType: payload.eventType,
                table: payload.table,
                schema: payload.schema,
                address: payload.new?.address || payload.old?.address,
                is_alive: payload.new?.is_alive,
                old_alive: payload.old?.is_alive,
                commit_timestamp: payload.commit_timestamp,
              })

              const address = (payload.new?.address || payload.old?.address) as string | undefined
              const noFilter = this.visibleAddresses.size === 0
              if (address && (noFilter || this.visibleAddresses.has(address))) {
                console.log(`[SubManager] ✅ Processing event for visible address:`, address)
                this.handler(payload)
              } else if (address) {
                console.log(`[SubManager] ⚠️ Ignoring event for non-visible address:`, address, 'visible set size:', this.visibleAddresses.size)
              }
            },
          )
        return this.channel
      },
      {
        onSubscribed: () => {
          console.log('[SubManager] ✅ REALTIME SUBSCRIBED! Ready to receive events.')
        },
        onError: (status, error) => {
          console.error('[SubManager] Channel issue', status, error)
        },
      },
    )
  }

  /**
   * Update the set of addresses we care about (for client-side filtering)
   */
  updateAddresses(addresses: Set<string>) {
    // Normalize all addresses to lowercase; guard against undefined/null
    const normalized = new Set(
      Array.from(addresses)
        .filter((addr: any) => typeof addr === 'string' && addr.length > 0)
        .map((addr: string) => addr)
    )
    
    const added = normalized.size - this.visibleAddresses.size
    const removed = this.visibleAddresses.size - normalized.size
    
    if (this.debug && (added !== 0 || removed !== 0)) {
      console.log(`[SubManager] Updating visible filter: ${normalized.size} addresses (${added > 0 ? '+' : ''}${added} / ${removed > 0 ? '-' : ''}${Math.abs(removed)})`)
    }
    
    this.visibleAddresses = normalized
  }

  /**
   * Clean up subscriptions
   */
  cleanup() {
    if (this.debug) {
      console.log('[SubManager] Cleaning up subscription')
    }
    if (this.cleanupFn) {
      this.cleanupFn()
      this.cleanupFn = null
    }
    this.channel = null
    this.visibleAddresses.clear()
  }
}
