"use client"

import { formatDisplayPoints, formatPoints as formatPointsRaw } from '@/src/shared/points'

export function formatRewardBalanceLabel(rewardBalance: number | null) {
  if (rewardBalance == null) return null
  if (rewardBalance >= 1000) {
    return formatDisplayPoints(rewardBalance, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  if (rewardBalance >= 100) {
    return formatDisplayPoints(rewardBalance, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  if (rewardBalance >= 10) {
    return formatDisplayPoints(rewardBalance, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  }
  return formatDisplayPoints(rewardBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPoints(raw: number) {
  return formatPointsRaw(raw)
}
