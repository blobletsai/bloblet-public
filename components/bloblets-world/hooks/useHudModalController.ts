"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSound } from '@/src/hooks/useSound'

type QueryValueMap<Tab extends string> = Record<string, Tab>
type TabToValueMap<Tab extends string> = Partial<Record<Tab, string>>

type HudModalQueryConfig<Tab extends string> = {
  param?: string
  valueToTab: QueryValueMap<Tab>
  tabToValue?: TabToValueMap<Tab>
}

type UseHudModalControllerOptions<Tab extends string, Dock extends string> = {
  personaTab: Tab
  lifeHubTabs: Tab[]
  challengeModalOpen?: boolean
  queryConfig?: HudModalQueryConfig<Tab>
}

export type HudModalControllerResult<Tab extends string, Dock extends string> = {
  activeHubTab: Tab | null
  activeDockPanel: Dock | null
  personaModalVisible: boolean
  lifeHubModalVisible: boolean
  gearManagerOpen: boolean
  toggleHubTab: (tab: Tab) => void
  openHubTab: (tab: Tab) => void
  closeHub: () => void
  toggleDockPanel: (panel: Dock) => void
  closeDockPanel: () => void
  openGearManager: () => void
  closeGearManager: () => void
  hydrateFromQuery: (search?: string) => void
}

type NormalizedQueryConfig<Tab extends string> = {
  param: string
  valueToTab: Map<string, Tab>
  tabToValue: TabToValueMap<Tab> | null
}

export function useHudModalController<Tab extends string, Dock extends string>({
  personaTab,
  lifeHubTabs,
  challengeModalOpen = false,
  queryConfig,
}: UseHudModalControllerOptions<Tab, Dock>): HudModalControllerResult<Tab, Dock> {
  const [activeHubTab, setActiveHubTab] = useState<Tab | null>(null)
  const [activeDockPanel, setActiveDockPanel] = useState<Dock | null>(null)
  const [gearManagerOpen, setGearManagerOpen] = useState(false)
  
  const { play } = useSound()

  const lifeHubTabSet = useMemo(() => new Set(lifeHubTabs), [lifeHubTabs])

  const normalizedQueryConfig = useMemo<NormalizedQueryConfig<Tab> | null>(() => {
    if (!queryConfig?.valueToTab) return null
    const param = queryConfig.param?.trim() || 'modal'
    const valueToTab = new Map<string, Tab>()
    Object.entries(queryConfig.valueToTab).forEach(([key, tab]) => {
      if (!key) return
      valueToTab.set(key.trim().toLowerCase(), tab)
    })
    return {
      param,
      valueToTab,
      tabToValue: queryConfig.tabToValue ?? null,
    }
  }, [queryConfig?.param, queryConfig?.tabToValue, queryConfig?.valueToTab])

  const toggleHubTab = useCallback((tab: Tab) => {
    setActiveHubTab((current) => {
      if (current === tab) {
        play('ui_close')
        return null
      }
      play('ui_open')
      return tab
    })
  }, [play])

  const openHubTab = useCallback((tab: Tab) => {
    play('ui_open')
    setActiveHubTab(tab)
  }, [play])

  const closeHub = useCallback(() => {
    setActiveHubTab((current) => {
      if (current) play('ui_close')
      return null
    })
  }, [play])

  const toggleDockPanel = useCallback((panel: Dock) => {
    setActiveDockPanel((current) => {
      if (current === panel) {
        play('ui_close')
        return null
      }
      play('ui_open')
      return panel
    })
  }, [play])

  const closeDockPanel = useCallback(() => {
    setActiveDockPanel((current) => {
      if (current) play('ui_close')
      return null
    })
  }, [play])

  const openGearManager = useCallback(() => {
    play('ui_open')
    setGearManagerOpen(true)
  }, [play])

  const closeGearManager = useCallback(() => {
    play('ui_close')
    setGearManagerOpen(false)
  }, [play])

  const hydrateFromQuery = useCallback(
    (search?: string) => {
      if (!normalizedQueryConfig) return
      const runtimeSearch =
        typeof search === 'string'
          ? search
          : typeof window !== 'undefined'
            ? window.location.search
            : ''
      if (!runtimeSearch) return
      const normalizedSearch = runtimeSearch.startsWith('?')
        ? runtimeSearch
        : `?${runtimeSearch}`
      let params: URLSearchParams
      try {
        params = new URLSearchParams(normalizedSearch)
      } catch {
        return
      }
      const rawValue = (params.get(normalizedQueryConfig.param) || '').trim().toLowerCase()
      if (!rawValue) return
      const nextTab = normalizedQueryConfig.valueToTab.get(rawValue)
      if (nextTab) {
        setActiveHubTab(nextTab)
      }
    },
    [normalizedQueryConfig],
  )

  useEffect(() => {
    if (!normalizedQueryConfig) return
    hydrateFromQuery()
    if (typeof window === 'undefined') return
    const handlePopState = () => hydrateFromQuery()
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hydrateFromQuery, normalizedQueryConfig])

  useEffect(() => {
    if (!normalizedQueryConfig?.tabToValue) return
    if (typeof window === 'undefined') return
    const tabValue = activeHubTab ? normalizedQueryConfig.tabToValue[activeHubTab] : undefined
    const url = new URL(window.location.href)
    const hasParam = url.searchParams.has(normalizedQueryConfig.param)
    if (tabValue) {
      url.searchParams.set(normalizedQueryConfig.param, tabValue)
    } else if (hasParam) {
      url.searchParams.delete(normalizedQueryConfig.param)
    } else {
      return
    }
    window.history.replaceState(window.history.state, '', url.toString())
  }, [activeHubTab, normalizedQueryConfig])

  useEffect(() => {
    if (!activeDockPanel) return
    if (typeof document === 'undefined') return
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target && target.closest('[data-hud-interactive="true"]')) return
      closeDockPanel()
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDockPanel()
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [activeDockPanel, closeDockPanel])

  useEffect(() => {
    if (!activeHubTab) return
    if (typeof document === 'undefined') return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHub()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [activeHubTab, closeHub])

  const personaModalVisible = activeHubTab === personaTab
  const lifeHubModalVisible = Boolean(
    activeHubTab && lifeHubTabSet.has(activeHubTab) && !gearManagerOpen,
  )

  return {
    activeHubTab,
    activeDockPanel,
    personaModalVisible,
    lifeHubModalVisible,
    gearManagerOpen,
    toggleHubTab,
    openHubTab,
    closeHub,
    toggleDockPanel,
    closeDockPanel,
    openGearManager,
    closeGearManager,
    hydrateFromQuery,
  }
}
