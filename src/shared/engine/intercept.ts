import { Vec, add, sub, mul, dot } from './math'

// Solve intercept when ball moves at constant velocity and player runs at max speed
export function interceptConstantVel(ballPos: Vec, ballVel: Vec, playerPos: Vec, playerMaxSpeed: number) {
  const rel = sub(ballPos, playerPos)
  const a = dot(ballVel, ballVel) - playerMaxSpeed * playerMaxSpeed
  const b = 2 * dot(ballVel, rel)
  const c = dot(rel, rel)
  const disc = b * b - 4 * a * c
  if (disc < 0 || Math.abs(a) < 1e-8) return { ok: false, point: ballPos, t: 0 }
  const s = Math.sqrt(disc)
  const t1 = (-b - s) / (2 * a)
  const t2 = (-b + s) / (2 * a)
  const t = t1 > 0 ? t1 : (t2 > 0 ? t2 : -1)
  if (t <= 0) return { ok: false, point: ballPos, t: 0 }
  return { ok: true, point: add(ballPos, mul(ballVel, t)), t }
}

