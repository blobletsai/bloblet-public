export function getMinTransferPoints(): number {
  const raw = Number(process.env.MIN_TRANSFER || process.env.PVP_MIN_TRANSFER || 5)
  return Math.max(0, Number.isFinite(raw) ? raw : 5)
}

export function getTransferBasisPoints(): number {
  const raw = Number(process.env.TRANSFER_BPS || 1000)
  return Math.max(0, Number.isFinite(raw) ? raw : 1000)
}

export function getHouseCutBasisPoints(): number {
  const raw = Number(process.env.HOUSE_CUT_BPS || 1000)
  return Math.max(0, Number.isFinite(raw) ? raw : 1000)
}

export function getChallengeableMinPoints(): number {
  const raw = Number(process.env.CHALLENGEABLE_MIN_POINTS || process.env.PVP_CHALLENGEABLE_MIN || 5)
  return Math.max(0, Number.isFinite(raw) ? raw : 5)
}
