export const WORLD_W = 3840 // 16:9
export const WORLD_H = 2160
export const WORLD_CENTER = { x: WORLD_W / 2, y: WORLD_H / 2 }

export const TIERS = 4
export const TARGET_SIZES = [160, 112, 72, 48]
export const TOP_SIZE = TARGET_SIZES[0] ?? 1
export const SIZE_SCALE_FOR_BOB = TARGET_SIZES.map((s) => s / TOP_SIZE)

export const DEAD_FRACTION_DEMO = 0.028
export const ENTRY_TOTAL_BUDGET_MS = 5000
export const STAGGER_BUDGET_MS = 800
export const NAV_HINT_KEY = 'bloblet:navigationHintSeen:v1'
export const GROUND_TILE = 128
export const CARE_COOLDOWN_MINUTES = 60
