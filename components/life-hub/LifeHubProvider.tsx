"use client"

import { createContext, useContext } from 'react'

import type {
  EnergizeHudStatus,
  EnergizeUiState,
  RefreshReason,
} from '../bloblets-world/energizeState'

export type LifeHubTopUpStatus = {
  active: boolean
  open: boolean
  phase: string | null
  status: string | null
  notice: string | null
  orderId: number | null
  autoStatus: 'idle' | 'running' | 'success' | 'error'
  errorMessage: string | null
}

export type LifeHubTopUpStatusInput =
  | Partial<LifeHubTopUpStatus>
  | undefined

export type LifeHubContextValue = {
  energize: EnergizeUiState
  energizing: boolean
  energizeCost: number | null
  rewardBalance: number | null
  needsTopUp: boolean
  onEnergize: (orderId?: number | null) => Promise<boolean>
  onTopUp?: (options?: { autoEnergize?: boolean }) => void
  onFastForward?: () => Promise<boolean>
  disabledReason: string | null
  helperLabel: string | null
  errorMessage: string | null
  walletConnected: boolean
  isHolder: boolean | null
  minTokens: number | null
  hudStatus: EnergizeHudStatus
  coverageCountdownLabel: string
  topUpStatus: LifeHubTopUpStatus
  setTopUpStatus?: (next?: LifeHubTopUpStatusInput) => void
  refreshStatus: (reason?: RefreshReason) => Promise<void>
  statusRefreshing: boolean
  refreshRewardsSnapshot?: (options?: { silent?: boolean }) => Promise<unknown>
  fetchRewardBalance?: () => Promise<number | null>
  fastForwardAvailable?: boolean
  fastForwardDisabledReason?: string | null
  refreshStatusFn?: (reason?: RefreshReason) => Promise<void>
}

export const EMPTY_TOP_UP_STATUS: LifeHubTopUpStatus = {
  active: false,
  open: false,
  phase: null,
  status: null,
  notice: null,
  orderId: null,
  autoStatus: 'idle',
  errorMessage: null,
}

const LifeHubContext = createContext<LifeHubContextValue | null>(null)

type LifeHubProviderProps = {
  value: LifeHubContextValue
  children: React.ReactNode
}

export function LifeHubProvider({ value, children }: LifeHubProviderProps) {
  return (
    <LifeHubContext.Provider value={value}>
      {children}
    </LifeHubContext.Provider>
  )
}

export function useLifeHub(optional = false): LifeHubContextValue | null {
  const ctx = useContext(LifeHubContext)
  if (!ctx && !optional) {
    throw new Error('useLifeHub must be used within a LifeHubProvider')
  }
  return ctx
}
