export const SOUND_ASSETS = {
  ui_hover: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/ui_hover.mp3",
  ui_select: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/ui_select.mp3",
  ui_open: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/ui_open.mp3",
  ui_close: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/ui_close.mp3",
  battle_launch: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/battle_launch.mp3",
  battle_impact: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/battle_impact.mp3",
  battle_win: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/battle_win.mp3",
  battle_defeat: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/battle_defeat.mp3",
  energize_charge: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/energize_charge.mp3",
  bg_ambience: "https://pub-c1e9982dc8304ab6bede6514dcbdfaea.r2.dev/sfx/bg_ambience.mp3"
} as const

export type SoundKey = keyof typeof SOUND_ASSETS
