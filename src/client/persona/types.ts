"use client"

export type PersonaSession = {
  address: string | null
  isHolder: boolean
}

export type PersonaBloblet = {
  address: string
  addressCased: string
  name: string | null
  socialHandle: string | null
  avatarUrl: string | null
  avatarUrl256: string | null
}

export type PersonaLandmark = {
  id: number
  type: string
  name: string | null
  renameCount: number
  currentPrice: number
  lastPrice: number
}

export type PersonaRenameHistoryEntry = {
  propId: number
  name: string
  pricePaid: number
  appliedAt: string
}
