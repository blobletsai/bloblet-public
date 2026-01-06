import { useCallback, useMemo } from 'react'
import { usePlayerStatus, type PlayerStatus } from './usePlayerStatus'

export type CareStatusResponse = PlayerStatus['care']

export type UseCareStatusState = {
  data: CareStatusResponse | null
  loading: boolean
  refreshing: boolean
  error: Error | null
  refresh: () => Promise<CareStatusResponse | null>
}

type Options = {
  refreshIntervalMs?: number
}

export function useCareStatus(options: Options = {}): UseCareStatusState {
  const { refreshIntervalMs } = options
  const {
    data: playerStatus,
    loading,
    refreshing,
    error,
    refresh: refreshPlayer,
  } = usePlayerStatus({ refreshIntervalMs })

  const careStatus = useMemo(() => playerStatus?.care ?? null, [playerStatus])

  const refresh = useCallback(async () => {
    const updated = await refreshPlayer()
    return updated?.care ?? null
  }, [refreshPlayer])

  return {
    data: careStatus,
    loading,
    refreshing,
    error,
    refresh,
  }
}
