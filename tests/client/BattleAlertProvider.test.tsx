import React, { useEffect } from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import { BattleAlertProvider, useBattleAlerts } from '@/components/challenge-modal/BattleAlertProvider'
import { ErrorModal } from '@/components/challenge-modal/ErrorModal'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

function AlertTrigger({ onAction }: { onAction: () => void }) {
  const { showAlert } = useBattleAlerts()

  useEffect(() => {
    showAlert({
      id: 'cta-test',
      title: 'Alert Test',
      message: 'Ensure actions route through provider',
      actionLabel: 'Do It',
      onAction,
    })
  }, [onAction, showAlert])

  return null
}

describe('BattleAlertProvider', () => {
  it('invokes the injected alert action when CTA is clicked', async () => {
    const onAction = vi.fn()
    let renderer: TestRenderer.ReactTestRenderer

    await act(async () => {
      renderer = TestRenderer.create(
        <BattleAlertProvider>
          <AlertTrigger onAction={onAction} />
        </BattleAlertProvider>,
      )
    })

    const modal = renderer!.root.findByType(ErrorModal)
    expect(modal.props.isOpen).toBe(true)
    expect(modal.props.actionLabel).toBe('Do It')

    await act(async () => {
      modal.props.onAction?.()
    })

    expect(onAction).toHaveBeenCalledTimes(1)
    renderer!.unmount()
  })
})
