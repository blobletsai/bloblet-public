"use client"

import { useMemo } from 'react'

type HandlerMap = Record<string, (...args: any[]) => unknown>

type UseWindowBridgeHandlersArgs<THub extends string> = {
  applyLoadouts: (...args: any[]) => unknown
  updateLoadout: (...args: any[]) => unknown
  applyBattles: (...args: any[]) => unknown
  prependBattle: (...args: any[]) => unknown
  applySnapshot: (...args: any[]) => unknown
  applyDelta: (...args: any[]) => unknown
  removePlaceholder: (...args: any[]) => unknown
  replayEntry: (...args: any[]) => unknown
  addSprites: (...args: any[]) => unknown
  focusOnAddress: (...args: any[]) => unknown
  setHighlightAddress: (...args: any[]) => unknown
  setMyAddressForSession: (...args: any[]) => unknown
  clearSessionForWindow: (...args: any[]) => unknown
  openHubTab: (tab: THub) => void
  closeHubTab: () => void
  challengeWindowHandlers: HandlerMap
  rewardsWindowHandlers: HandlerMap
}

export function useWindowBridgeHandlers<THub extends string>({
  applyLoadouts,
  updateLoadout,
  applyBattles,
  prependBattle,
  applySnapshot,
  applyDelta,
  removePlaceholder,
  replayEntry,
  addSprites,
  focusOnAddress,
  setHighlightAddress,
  setMyAddressForSession,
  clearSessionForWindow,
  openHubTab,
  closeHubTab,
  challengeWindowHandlers,
  rewardsWindowHandlers,
}: UseWindowBridgeHandlersArgs<THub>): HandlerMap {
  return useMemo(
    () => ({
      BlobletsWorld_applyLoadouts: applyLoadouts,
      BlobletsWorld_updateLoadout: updateLoadout,
      BlobletsWorld_applyBattles: applyBattles,
      BlobletsWorld_prependBattle: prependBattle,
      BlobletsWorld_applySnapshot: applySnapshot,
      BlobletsWorld_applyDelta: applyDelta,
      BlobletsWorld_removePlaceholder: removePlaceholder,
      BlobletsWorld_replayEntry: replayEntry,
      BlobletsWorld_addSprites: addSprites,
      BlobletsWorld_focusOn: focusOnAddress,
      BlobletsWorld_setHighlight: setHighlightAddress,
      BlobletsWorld_setMyAddress: setMyAddressForSession,
      BlobletsWorld_clearSession: clearSessionForWindow,
      BlobletsWorld_openHub: openHubTab,
      BlobletsWorld_closeHub: closeHubTab,
      ...challengeWindowHandlers,
      ...rewardsWindowHandlers,
    }),
    [
      addSprites,
      applyBattles,
      applyDelta,
      applyLoadouts,
      applySnapshot,
      challengeWindowHandlers,
      clearSessionForWindow,
      closeHubTab,
      focusOnAddress,
      openHubTab,
      prependBattle,
      removePlaceholder,
      replayEntry,
      rewardsWindowHandlers,
      setHighlightAddress,
      setMyAddressForSession,
      updateLoadout,
    ],
  )
}
