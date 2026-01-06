// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

import ChallengeModal, { type ChallengeHandlerResult } from '@/components/ChallengeModal'
import { BattleAlertProvider } from '@/components/challenge-modal/BattleAlertProvider'
import type { PvpItem } from '@/types'

;(globalThis as typeof globalThis & { React?: typeof React }).React = React

const MY_ADDRESS = 'DMGPDaz9V9UMcStxpMWAeDDX71uPxipmW2krp4U1ofBa'
const TARGET_ADDRESS = '5ercAfJdewdJGXrvytKBSeH9mPG84FaymZmkpS5edGj4'

const weapon: PvpItem = {
  id: 101,
  slug: 'twig',
  type: 'weapon',
  name: 'Twig',
  rarity: 'common',
  op: 1,
  dp: 0,
  icon_url: null,
}

const shield: PvpItem = {
  id: 202,
  slug: 'bubble',
  type: 'shield',
  name: 'Bubble Shield',
  rarity: 'common',
  op: 0,
  dp: 5,
  icon_url: null,
}

function renderModal(
  props: Partial<React.ComponentProps<typeof ChallengeModal>> = {},
) {
  const baseProps: React.ComponentProps<typeof ChallengeModal> = {
    open: true,
    myAddress: MY_ADDRESS,
    loadouts: {
      [MY_ADDRESS]: { weapon, shield },
    },
    suggestedTargets: [TARGET_ADDRESS],
    initialTarget: TARGET_ADDRESS,
    onClose: () => {},
    onSubmit: async (): Promise<ChallengeHandlerResult> => ({ ok: false, error: 'noop', message: 'noop' }),
    onEnergizeNow: undefined,
    resolveAvatarUrl: () => null,
    minStake: null,
    getStakeInfo: () => ({ balance: null, stakeReady: true, minStake: null }),
    getPairCooldown: () => null,
    itemCatalog: {},
    refreshViewerLoadout: undefined,
  }

  return render(
    <BattleAlertProvider>
      <ChallengeModal {...{ ...baseProps, ...props }} />
    </BattleAlertProvider>,
  )
}

describe('ChallengeModal duel preview loadout hydration', () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the viewer's OP/DP in the duel preview when loadout is available", async () => {
    renderModal()

    const preview = await screen.findByText('OP: +1 · DP: +5')
    expect(preview).toBeTruthy()
  })

  it('requests loadout hydration when the modal opens without a viewer loadout', async () => {
    const refreshViewerLoadout = vi.fn().mockResolvedValue(null)

    renderModal({
      loadouts: {},
      refreshViewerLoadout,
    })

    await waitFor(() => {
      expect(refreshViewerLoadout).toHaveBeenCalledTimes(1)
      expect(refreshViewerLoadout).toHaveBeenCalledWith({ force: true })
    })
  })
})
