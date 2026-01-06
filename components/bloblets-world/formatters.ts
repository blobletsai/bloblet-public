"use client"

import { BATTLE_TERMS } from '@/src/shared/gameplay/status'

export function formatChallengeErrorMessage(code: string, details?: any) {
  switch (code) {
    case 'target_missing':
      return 'Pick an opponent address to launch a battle.'
    case 'self_target':
      return 'You cannot challenge yourself. Choose another bloblet.'
    case 'unauthorized':
      return 'Connect and verify your wallet before challenging.'
    case 'pair_cooldown': {
      const nextIso = details?.nextAllowedAt || details?.cooldownUntil
      if (typeof nextIso === 'string') {
        const date = new Date(nextIso)
        const label = Number.isNaN(date.getTime())
          ? nextIso
          : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        return `That matchup is cooling down. Try again at ${label}.`
      }
      return 'That matchup is cooling down. Try again in a bit.'
    }
    case 'defender_down':
      return 'That bloblet is currently down. Pick someone who is still active.'
    case 'attacker_overdue': {
      const readyAt = details?.cooldownEndsAt
      if (typeof readyAt === 'string') {
        const dt = new Date(readyAt)
        const label = Number.isNaN(dt.getTime())
          ? readyAt
          : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        return `Nourish your bloblet first. Coverage returns at ${label}.`
      }
      return 'Nourish your bloblet first—coverage has lapsed.'
    }
    case 'defender_overdue':
      return 'That opponent’s boosters have expired, but they remain attackable. Refresh and try again.'
    case 'attacker_dead':
      return 'Revive or nourish your bloblet before launching another challenge.'
    case 'defender_dead':
      return 'That bloblet is currently offline. Pick someone who is still active.'
    case 'defender_balance_low': {
      const min = typeof details?.minPoints === 'number' ? details.minPoints : null
      return min
        ? `${BATTLE_TERMS.rewardDeficit.label}: requires ≥ ${min.toLocaleString()} BlobCoin before they can fight.`
        : `${BATTLE_TERMS.rewardDeficit.label}: they need to top up before battles resume.`
    }
    case 'attacker_balance_low': {
      const min = typeof details?.minPoints === 'number' ? details.minPoints : null
      return min
        ? `You need at least ${min.toLocaleString()} BlobCoin to launch a challenge.`
        : 'You need more BlobCoin to launch a challenge.'
    }
    case 'transfer_exceeds_balance':
    case 'invalid_transfer_state':
      return 'Battle aborted due to an invalid balance state. Please try again shortly.'
    case 'bloblet_not_found':
    case 'defender_missing':
      return 'Could not find that bloblet on the canvas.'
    case 'rate_limited':
      return 'Too many battle attempts at once. Pause for a few seconds and retry.'
    case 'network_error':
      return 'Could not reach the battle service. Check your connection and retry.'
    default:
      return 'Challenge failed. Try again in a moment.'
  }
}

export function formatTimeAgo(iso: string | null | undefined) {
  if (!iso) return ''
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return ''
  const diffMs = Date.now() - ts
  if (diffMs < 45 * 1000) return 'just now'
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay}d ago`
}

const LEDGER_REASON_LABELS: Record<string, string> = {
  balance_snapshot: 'Snapshot adjustment',
  care_upkeep: 'Nourish upkeep bonus',
  battle_win: 'Battle win',
  battle_loss: 'Battle loss',
  treasury_cut: 'Treasury cut',
  swap_credit: 'Buy BlobCoin credit',
  redeem_debit: 'Redeem debit',
  redeem_fee: 'Redeem fee',
  manual_adjustment: 'Adjustment',
}

const SWAP_DIRECTION_LABELS: Record<string, string> = {
  deposit: 'Buy BlobCoin',
  withdraw: 'Redeem',
}

const SWAP_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Confirmed',
  failed: 'Failed',
  rejected: 'Rejected',
}

export function ledgerReasonLabel(reason: string): string {
  const key = reason ? reason.toLowerCase() : ''
  return (
    LEDGER_REASON_LABELS[key] ||
    key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) ||
    'Ledger entry'
  )
}

export function swapDirectionLabel(direction: string): string {
  const key = direction ? direction.toLowerCase() : ''
  return SWAP_DIRECTION_LABELS[key] || 'Swap'
}

export function swapStatusLabel(status: string): string {
  const key = status ? status.toLowerCase() : ''
  return SWAP_STATUS_LABELS[key] || status || 'Status'
}
