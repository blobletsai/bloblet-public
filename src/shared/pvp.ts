export type RiskTone = 'good' | 'warn' | 'bad' | 'neutral'

export type RiskInfo = {
  label: string
  tone: RiskTone
  detail: string
}

const riskToneOrder: Record<RiskTone, number> = {
  good: 0,
  neutral: 1,
  warn: 2,
  bad: 3,
}

export const riskToneClasses: Record<RiskTone, string> = {
  good: 'text-[#8ff7ff]',
  warn: 'text-[#ffe780]',
  bad: 'text-[#ff9de1]',
  neutral: 'text-white',
}

export function computeRisk(attack: number, defense: number): RiskInfo {
  if (!Number.isFinite(attack) || attack <= 0) {
    return {
      label: 'Equip a weapon first',
      tone: 'bad',
      detail: 'Your attack slot is empty; care for drops before fighting.',
    }
  }
  if (!Number.isFinite(defense) || defense <= 0) {
    return {
      label: 'Great odds',
      tone: 'good',
      detail: 'Opposing shield slot is empty; expect an easy steal unless luck flips.',
    }
  }

  const diff = attack - defense
  if (diff >= 3) {
    return {
      label: 'Favored',
      tone: 'good',
      detail: 'Your weapon outclasses their shield. Boosters & luck still apply.',
    }
  }
  if (diff >= 1) {
    return {
      label: 'Slight edge',
      tone: 'good',
      detail: 'You lead on base stats; boosters or luck swings decide the rest.',
    }
  }
  if (diff <= -3) {
    return {
      label: 'High risk',
      tone: 'bad',
      detail: 'Their shield dwarfs your weapon. Expect to lose unless luck spikes.',
    }
  }
  if (diff <= -1) {
    return {
      label: 'Risky',
      tone: 'warn',
      detail: 'They have the defensive edge. Consider upgrading your weapon first.',
    }
  }
  return {
    label: 'Tight matchup',
    tone: 'neutral',
    detail: 'Stats are close. Boosters, cooldowns, and luck will decide it.',
  }
}

export function riskToneWeight(info: RiskInfo | null | undefined): number {
  if (!info) return riskToneOrder.neutral
  return riskToneOrder[info.tone]
}

export function formatAddress(address: string | null | undefined, fallback = ''): string {
  if (!address) return fallback
  return address.trim()
}

export function shortAddress(address: string | null | undefined, chars = 4): string {
  const full = formatAddress(address)
  if (!full) return ''
  if (full.length <= chars * 2) return full
  return `${full.slice(0, chars)}…${full.slice(-chars)}`
}
