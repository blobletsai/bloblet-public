import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ErrorModal } from '@/components/challenge-modal/ErrorModal'
import { CLIENT_EVENT, type BattleAlertPhase, type BattleAlertType } from '@/src/client/events/clientEventMap'
import { emitClientEvent } from '@/src/client/events/useClientEventBus'

export type { BattleAlertType } from '@/src/client/events/clientEventMap'

export type BattleAlertConfig = {
  id?: string
  type?: BattleAlertType
  title: string
  message: string
  opponent?: string | null
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
}

type BattleAlertState = BattleAlertConfig & { id: string; opponent: string | null; type: BattleAlertType }

type BattleAlertContextValue = {
  alert: BattleAlertState | null
  showAlert: (config: BattleAlertConfig) => void
  dismissAlert: () => void
  beginBattleAttempt: () => void
  resetAcknowledgement: (type: BattleAlertType, opponent?: string | null) => void
}

type AcknowledgementMap = Record<string, number>

const BattleAlertContext = createContext<BattleAlertContextValue | null>(null)

function canonicalOpponent(value?: string | null) {
  const next = (value || '').trim()
  return next ? next.toLowerCase() : null
}

function acknowledgementKey(type: BattleAlertType, opponent?: string | null) {
  const normalized = canonicalOpponent(opponent)
  return `${type}:${normalized || 'global'}`
}

function emitBattleAlertEvent(phase: BattleAlertPhase, alert: BattleAlertState) {
  emitClientEvent(CLIENT_EVENT.BATTLE_ALERT, {
    phase,
    type: alert.type,
    opponent: alert.opponent,
    id: alert.id,
  })
}

export function BattleAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<BattleAlertState | null>(null)
  const [acknowledged, setAcknowledged] = useState<AcknowledgementMap>({})
  const [attemptId, setAttemptId] = useState(0)
  const actionQueueRef = useRef<(() => void) | null>(null)
  const actionSourceRef = useRef<BattleAlertState | null>(null)

  const markAcknowledged = useCallback(
    (type: BattleAlertType, opponent?: string | null) => {
      const key = acknowledgementKey(type, opponent)
      setAcknowledged((prev) => {
        if (prev[key] === attemptId) return prev
        return { ...prev, [key]: attemptId }
      })
    },
    [attemptId],
  )

  const resetAcknowledgement = useCallback((type: BattleAlertType, opponent?: string | null) => {
    const key = acknowledgementKey(type, opponent)
    setAcknowledged((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const beginBattleAttempt = useCallback(() => {
    setAttemptId((prev) => prev + 1)
  }, [])

  const clearAlert = useCallback(
    (phase: BattleAlertPhase, shouldEnqueueAction?: boolean) => {
      setAlert((current) => {
        if (!current) return null
        emitBattleAlertEvent(phase, current)
        markAcknowledged(current.type, current.opponent)
        current.onDismiss?.()
        if (shouldEnqueueAction && current.onAction) {
          actionQueueRef.current = current.onAction
          actionSourceRef.current = current
        } else {
          actionQueueRef.current = null
          actionSourceRef.current = null
        }
        return null
      })
    },
    [markAcknowledged],
  )

  const dismissAlert = useCallback(() => {
    clearAlert('dismiss')
  }, [clearAlert])

  const handleAction = useCallback(() => {
    clearAlert('dismiss', true)
  }, [clearAlert])

  const showAlert = useCallback(
    (config: BattleAlertConfig) => {
      const type = config.type || 'generic'
      const opponent = canonicalOpponent(config.opponent)
      const key = acknowledgementKey(type, opponent)
      if (acknowledged[key] === attemptId) {
        return
      }
      const nextAlert: BattleAlertState = {
        ...config,
        type,
        opponent,
        id: config.id || `${type}:${opponent || 'global'}:${Date.now()}`,
      }
      setAlert(nextAlert)
      emitBattleAlertEvent('show', nextAlert)
    },
    [acknowledged, attemptId],
  )

  const value = useMemo<BattleAlertContextValue>(() => ({
    alert,
    showAlert,
    dismissAlert,
    beginBattleAttempt,
    resetAcknowledgement,
  }), [alert, showAlert, dismissAlert, beginBattleAttempt, resetAcknowledgement])

  useEffect(() => {
    if (alert || !actionQueueRef.current) return
    const action = actionQueueRef.current
    const source = actionSourceRef.current
    actionQueueRef.current = null
    actionSourceRef.current = null
    try {
      action()
    } finally {
      if (source) {
        emitBattleAlertEvent('action', source)
      }
    }
  }, [alert])

  return (
    <BattleAlertContext.Provider value={value}>
      {children}
      {alert ? (
        <ErrorModal
          isOpen
          title={alert.title}
          message={alert.message}
          actionLabel={alert.actionLabel}
          onAction={alert.onAction ? handleAction : undefined}
          onClose={dismissAlert}
        />
      ) : null}
    </BattleAlertContext.Provider>
  )
}

export function useBattleAlerts() {
  const ctx = useContext(BattleAlertContext)
  if (!ctx) {
    throw new Error('useBattleAlerts must be used within a BattleAlertProvider')
  }
  return ctx
}
