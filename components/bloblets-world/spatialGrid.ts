"use client"

export class SpatialGrid {
  private readonly cell: number
  private readonly map: Map<string, number[]>

  constructor(cell: number) {
    this.cell = cell
    this.map = new Map()
  }

  private key(ix: number, iy: number) {
    return `${ix},${iy}`
  }

  private idx(value: number) {
    return Math.floor(value / this.cell)
  }

  clear() {
    this.map.clear()
  }

  insertIndex(index: number, x: number, y: number) {
    const k = this.key(this.idx(x), this.idx(y))
    const arr = this.map.get(k) || []
    arr.push(index)
    this.map.set(k, arr)
  }

  neighbors(x: number, y: number, range: number) {
    const r = Math.ceil(range / this.cell) + 1
    const cx = this.idx(x)
    const cy = this.idx(y)
    const out: number[] = []
    for (let iy = cy - r; iy <= cy + r; iy++) {
      for (let ix = cx - r; ix <= cx + r; ix++) {
        const arr = this.map.get(this.key(ix, iy))
        if (arr) out.push(...arr)
      }
    }
    return out
  }
}
