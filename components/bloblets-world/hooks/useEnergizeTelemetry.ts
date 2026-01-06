import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import {
  emptyEnergizeUi,
  buildEnergizeToasts,
  useEnergizePolling,
  type EnergizeAlert,
  type EnergizeUiState,
  type RefreshReason,
} from '../energizeState'

type UseEnergizeTelemetryOptions = {
  shouldPollFallback: boolean
}

type UseEnergizeTelemetryResult = {
  energizeUi: EnergizeUiState
  setEnergizeUi: Dispatch<SetStateAction<EnergizeUiState>>
  energizeAlert: EnergizeAlert
  setEnergizeAlert: Dispatch<SetStateAction<EnergizeAlert>>
  pendingEnergizeActionRef: MutableRefObject<string | null>
  toasts: ReturnType<typeof buildEnergizeToasts>
  refreshStatus: (reason?: RefreshReason) => Promise<void>
  statusRefreshing: boolean
}

export function useEnergizeTelemetry({
  shouldPollFallback,
}: UseEnergizeTelemetryOptions): UseEnergizeTelemetryResult {
  const [energizeUi, setEnergizeUi] = useState<EnergizeUiState>(() => emptyEnergizeUi())
  const energizeUiRef = useRef(energizeUi)
  useEffect(() => { energizeUiRef.current = energizeUi }, [energizeUi])

  const [energizeAlert, setEnergizeAlert] = useState<EnergizeAlert>(null)
  const pendingEnergizeActionRef = useRef<string | null>(null)

  const {
    refreshStatus,
    statusRefreshing,
    reportExternalState,
  } = useEnergizePolling({
    energizeUiRef,
    pendingEnergizeActionRef,
    setEnergizeUi,
    setEnergizeAlert,
    energizeAlert,
    enabled: shouldPollFallback,
  })

  useEffect(() => {
    reportExternalState(energizeUi)
  }, [energizeUi, reportExternalState])

  const toasts = useMemo(
    () => buildEnergizeToasts(energizeAlert),
    [energizeAlert],
  )

  return {
    energizeUi,
    setEnergizeUi,
    energizeAlert,
    setEnergizeAlert,
    pendingEnergizeActionRef,
    toasts,
    refreshStatus,
    statusRefreshing,
  }
}
