// Lightweight, deterministic holder simulator for testing without on-chain calls.
// Option A: writes into the same tables (token_holders, bloblets) as Moralis flow.

import { sandboxConfig } from '@/src/config/sandbox'
import { solanaTokenDecimals } from '@/src/shared/points'

export type SimConfig = {
  count: number
  seed: number
  decimals: number
  churnRate: number // fraction [0..1] replaced per tick
  volatility: number // scales per-tick variation
  whaleProb: number // probability of a whale event per tick
  supplyRaw: bigint // total supply to distribute (raw units)
}

type Holder = { address: string; balanceRaw: bigint }

function simpleHash(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function lcg(seed: number) {
  let s = (seed >>> 0) || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff }
}

function hex40FromSeed(seedStr: string): string {
  // Build 40 hex chars deterministically from FNV hash stream
  let out = ''
  let a = simpleHash(seedStr)
  for (let i = 0; i < 10; i++) { // 10 * 4 hex = 40
    a = Math.imul(a ^ 0x9e3779b9, 16777619) >>> 0
    const part = (a >>> 0).toString(16).padStart(8, '0')
    out += part.slice(0, 4)
  }
  return out.slice(0, 40)
}

function addrFrom(seed: string): string {
  return '0x' + hex40FromSeed(seed)
}

function pareto(r: number, alpha = 1.6, xm = 1): number {
  const u = Math.max(1e-6, Math.min(1 - 1e-6, r))
  return xm / Math.pow(u, 1 / alpha)
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)) }

export function simConfigFromEnv(): SimConfig {
  const sim = sandboxConfig.simulation
  const decimals = Number.isFinite(sim.decimals) ? Math.max(0, Math.floor(sim.decimals)) : solanaTokenDecimals()
  return {
    count: Math.max(1, Math.floor(sim.holderCount)),
    seed: sim.seed,
    decimals,
    churnRate: Math.max(0, Math.min(1, sim.churnRate)),
    volatility: Math.max(0, sim.volatility),
    whaleProb: Math.max(0, Math.min(1, sim.whaleProb)),
    supplyRaw: sim.supplyRaw,
  }
}

function cohortOffset(tick: number, count: number, churnRate: number): number {
  const step = Math.max(1, Math.round(count * churnRate))
  const off = (tick * step) % count
  return off
}

// Generate current and previous address sets for churn computation.
function generateAddressSet(cfg: SimConfig, tick: number): { current: string[]; previous: string[]; replacedIdx: Set<number>; prevReplacedIdx: Set<number> } {
  const { count, seed, churnRate } = cfg
  const step = Math.max(1, Math.round(count * churnRate))
  const offCur = cohortOffset(tick, count, churnRate)
  const offPrev = cohortOffset(Math.max(0, tick - 1), count, churnRate)

  const inSegment = (i: number, off: number) => {
    const end = (off + step) % count
    if (off <= end) return i >= off && i < off + step
    return i >= off || i < end
  }

  const replacedIdx = new Set<number>()
  const prevReplacedIdx = new Set<number>()
  const current: string[] = []
  const previous: string[] = []

  for (let i = 0; i < count; i++) {
    const curNew = inSegment(i, offCur)
    const prevNew = inSegment(i, offPrev)
    const seedCur = curNew ? `SIM|${seed}|t${tick}|i${i}` : `SIM|${seed}|t0|i${i}`
    const seedPrev = prevNew ? `SIM|${seed}|t${Math.max(0, tick - 1)}|i${i}` : `SIM|${seed}|t0|i${i}`
    if (curNew) replacedIdx.add(i)
    if (prevNew) prevReplacedIdx.add(i)
    current.push(addrFrom(seedCur))
    previous.push(addrFrom(seedPrev))
  }
  return { current, previous, replacedIdx, prevReplacedIdx }
}

export function simulateSnapshot(cfg: SimConfig, tick: number): { holders: Holder[]; prevHolders: Holder[] } {
  const { count, seed, volatility, whaleProb, supplyRaw } = cfg
  const { current, previous } = generateAddressSet(cfg, tick)

  // Weights: heavy tail + small per-tick variation
  const weights: number[] = new Array(count).fill(0)
  let wsum = 0
  for (let i = 0; i < count; i++) {
    const baseR = lcg(simpleHash(`W|${seed}|i${i}`))()
    const w0 = pareto(baseR, 1.6, 1)
    const varR = lcg(simpleHash(`V|${seed}|t${tick}|i${i}`))()
    const varScale = 0.30 * volatility
    const w = clamp(w0 * (1 + (varR - 0.5) * 2 * varScale), 0.1, 1e6)
    weights[i] = w
    wsum += w
  }

  // Optional whale:
  const whaleR = lcg(simpleHash(`WH|${seed}|t${tick}`))()
  if (whaleR < whaleProb && count > 0) {
    // Boost a top-weight index by 5-15x
    let best = 0
    for (let i = 1; i < count; i++) if ((weights[i] ?? 0) > (weights[best] ?? 0)) best = i
    const boost = 5 + Math.floor(lcg(simpleHash(`WB|${seed}|t${tick}`))() * 11) // 5..15
    const baseVal = weights[best] ?? 0
    wsum += baseVal * (boost - 1)
    weights[best] = baseVal * boost
  }

  // Scale to raw supply
  const holders: Holder[] = []
  for (let i = 0; i < count; i++) {
    const share = (weights[i] ?? 0) / wsum
    const raw = BigInt(Math.max(0, Math.floor(Number(supplyRaw) * share)))
    holders.push({ address: current[i]!, balanceRaw: raw })
  }

  // Previous cohort addresses with comparable weights (for churn-out zeroing)
  const prevHolders: Holder[] = []
  for (let i = 0; i < count; i++) {
    const share = (weights[i] ?? 0) / wsum
    const raw = BigInt(Math.max(0, Math.floor(Number(supplyRaw) * share)))
    prevHolders.push({ address: previous[i]!, balanceRaw: raw })
  }

  return { holders, prevHolders }
}

export function computeRanksPercents(rows: Holder[]): { address: string; balanceRaw: bigint; rank: number; percent: number }[] {
  const sorted = [...rows].sort((a, b) => (a.balanceRaw === b.balanceRaw ? 0 : a.balanceRaw > b.balanceRaw ? -1 : 1))
  const total = rows.reduce((acc, r) => acc + r.balanceRaw, 0n) || 1n
  const out = sorted.map((r, idx) => {
    const pct = Number((r.balanceRaw * 10000n) / total) / 100
    return { address: r.address, balanceRaw: r.balanceRaw, rank: idx + 1, percent: pct }
  })
  return out
}
