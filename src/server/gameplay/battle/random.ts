import crypto from 'node:crypto'
import type { RandomProvider } from './types'

const RNG_PRECISION = 1_000_000

export class CryptoRandomProvider implements RandomProvider {
  unit(): number {
    return crypto.randomInt(RNG_PRECISION) / RNG_PRECISION
  }
}
