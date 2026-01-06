import { useCallback, useRef, useState } from 'react'

export type TopUpViewState = 'entry' | 'payment' | 'success'
export type TopUpAutoStatus = 'idle' | 'running' | 'success' | 'error'

type Options = {
  onClearReason?: () => void
  onResetLifeHub?: () => void
}

export function useTopUpViewState(options: Options = {}) {
  const [view, setView] = useState<TopUpViewState>('entry')
  const [amountInput, setAmountInput] = useState('')
  const [entryError, setEntryError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [successAmount, setSuccessAmount] = useState<number | null>(null)
  const [successBalance, setSuccessBalance] = useState<number | null>(null)
  const [successLoading, setSuccessLoading] = useState(false)
  const [successError, setSuccessError] = useState<string | null>(null)
  const [autoStatus, setAutoStatus] = useState<TopUpAutoStatus>('idle')
  const appliedHandledRef = useRef(false)

  const reset = useCallback(() => {
    setView('entry')
    setAmountInput('')
    setEntryError(null)
    setSubmitting(false)
    setCanceling(false)
    setSuccessAmount(null)
    setSuccessBalance(null)
    setSuccessLoading(false)
    setSuccessError(null)
    setAutoStatus('idle')
    appliedHandledRef.current = false
    options.onClearReason?.()
    options.onResetLifeHub?.()
  }, [options])

  return {
    view,
    setView,
    amountInput,
    setAmountInput,
    entryError,
    setEntryError,
    submitting,
    setSubmitting,
    canceling,
    setCanceling,
    successAmount,
    setSuccessAmount,
    successBalance,
    setSuccessBalance,
    successLoading,
    setSuccessLoading,
    successError,
    setSuccessError,
    autoStatus,
    setAutoStatus,
    appliedHandledRef,
    reset,
  }
}
