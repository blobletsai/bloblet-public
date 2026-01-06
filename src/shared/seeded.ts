export class RNG {
  private state: number
  constructor(seedString: string) {
    // xmur3 hash
    let h = 1779033703 ^ seedString.length
    for (let i = 0; i < seedString.length; i++) {
      h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353)
      h = (h << 13) | (h >>> 19)
    }
    this.state = (h >>> 0) || 1
  }
  next() {
    // Mulberry32
    let t = (this.state += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(min: number, max: number) {
    return min + (max - min) * this.next()
  }
  pick<T>(arr: readonly T[]) { return arr[Math.floor(this.next() * arr.length)] }
}
