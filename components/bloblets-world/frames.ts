"use client"

import type { Frame } from './types'

export function buildFixedFrames(img: HTMLImageElement, sizes: number[]): Frame[] {
  const first = sizes && sizes.length ? sizes[0]! : 1
  return sizes.map((px) => {
    const cnv = document.createElement('canvas')
    cnv.width = px
    cnv.height = px
    const cx = cnv.getContext('2d')!
    cx.imageSmoothingEnabled = false
    cx.drawImage(img, 0, 0, px, px)
    return { canvas: cnv, w: px, h: px, scale: px / first }
  })
}
