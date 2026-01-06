import { interceptConstantVel } from '@/src/shared/engine/intercept'
export type Vec = { x: number; y: number }
export type GoalSide = 'left' | 'right'

export type PlayerState = 'idle' | 'chase' | 'return' | 'kick'

export type Player = {
  id: number
  team: 0 | 1
  pos: Vec
  vel: Vec
  home: Vec
  state: PlayerState
  traits: { speed: number; power: number; vision: number; risk: number; gk?: boolean }
  role: 'GK' | 'DEF' | 'MID' | 'FWD'
}

export type Ball = { pos: Vec; vel: Vec }

export type EngineEvent = { type: 'goal'; side: GoalSide; t: number }

export const FIELD = { W: 100, H: 60 }

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }

export function seededRand(seed: number) {
  let s = (seed >>> 0) || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff }
}

export class SoccerEngine {
  players: Player[] = []
  ball: Ball = { pos: { x: FIELD.W / 2, y: FIELD.H / 2 }, vel: { x: 0, y: 0 } }
  private rnd: () => number
  private events: EngineEvent[] = []
  private holdT = 0
  private possessor: Player | null = null
  private time = 0
  private style = {
    press0: 0.5, press1: 0.5, // 0..1 pressing intensity
    shootBias0: 0.5, shootBias1: 0.5, // 0..1 preference to shoot
  }
  private shotJustNow: { byTeam: 0 | 1 } | null = null

  constructor(seed = 12345) {
    this.rnd = seededRand(seed)
    this.initPlayers()
  }

  resetKickoff() {
    this.ball.pos = { x: FIELD.W / 2, y: FIELD.H / 2 }
    this.ball.vel = { x: 0, y: 0 }
    this.holdT = 0
    this.possessor = null
  }

  consumeEvents(): EngineEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  private initPlayers() {
    const { W, H } = FIELD
    const spacingX = W / 11
    const jitter = () => (this.rnd() - 0.5) * 6
    for (let i = 0; i < 22; i++) {
      const team: 0 | 1 = i < 11 ? 0 : 1
      const col = team === 0 ? (i + 1) : (i - 10)
      const baseX = team === 0 ? (col * spacingX * 0.9) : (W - col * spacingX * 0.9)
      const baseY = (H / 12) * ((i % 11) + 0.5)
      // Traits: deterministic per-player from RNG
      const speed = 0.85 + this.rnd() * 0.4 // [0.85,1.25]
      const power = 0.85 + this.rnd() * 0.4
      const vision = 0.85 + this.rnd() * 0.4
      const risk = 0.3 + this.rnd() * 0.7 // 0.3..1.0
      const gk = (i === 0) || (i === 11)
      let role: 'GK' | 'DEF' | 'MID' | 'FWD'
      if (gk) role = 'GK'
      else {
        const idx = team === 0 ? i : (i - 11)
        // rough buckets
        role = idx <= 4 ? 'DEF' : (idx <= 8 ? 'MID' : 'FWD')
      }
      this.players.push({
        id: i,
        team,
        pos: { x: clamp(baseX + jitter(), 5, W - 5), y: clamp(baseY + jitter(), 5, H - 5) },
        vel: { x: 0, y: 0 },
        home: { x: clamp(baseX, 5, W - 5), y: clamp(baseY, 5, H - 5) },
        state: 'idle',
        traits: { speed, power, vision, risk, gk },
        role,
      })
    }
  }

  step(dt: number) {
    this.time += dt
    const { W, H } = FIELD

    // Periodic tactic refresh every ~15s
    if (Math.floor(this.time / 15) !== Math.floor((this.time - dt) / 15)) {
      // derive new style values deterministically
      this.style.press0 = 0.3 + this.rnd() * 0.7
      this.style.press1 = 0.3 + this.rnd() * 0.7
      this.style.shootBias0 = 0.3 + this.rnd() * 0.7
      this.style.shootBias1 = 0.3 + this.rnd() * 0.7
    }

    // Pressing: determine defenders to engage (nearest 2 of defending team)
    let attackingTeam: 0 | 1 | null = null
    if (this.possessor) attackingTeam = this.possessor.team
    // fallback: team closer to ball x towards right considered attacking
    if (attackingTeam === null) attackingTeam = (this.ball.vel.x >= 0 ? 0 : 1)
    const defendingTeam: 0 | 1 = attackingTeam === 0 ? 1 : 0
    const nearestDef: { p: Player; d2: number }[] = []
    for (const p of this.players) {
      if (p.team !== defendingTeam) continue
      const dx = p.pos.x - this.ball.pos.x
      const dy = p.pos.y - this.ball.pos.y
      const d2 = dx * dx + dy * dy
      nearestDef.push({ p, d2 })
    }
    nearestDef.sort((a, b) => a.d2 - b.d2)
    const chasers = nearestDef.slice(0, 2).map(x => x.p)
    for (const p of this.players) {
      if (chasers.includes(p)) p.state = 'chase'
      else {
        const dxh = p.home.x - p.pos.x
        const dyh = p.home.y - p.pos.y
        p.state = (dxh * dxh + dyh * dyh) > 9 ? 'return' : 'idle'
      }
    }

    // Possession & actions
    for (const p of chasers) {
      const dx = this.ball.pos.x - p.pos.x
      const dy = this.ball.pos.y - p.pos.y
      const d2 = dx * dx + dy * dy
      if (d2 < 4) {
        this.possessor = p
        this.holdT += dt
        // Dribble
        const dir = p.team === 0 ? 1 : -1
        const aheadX = p.pos.x + dir * (1.6 + 0.8 * p.traits.speed)
        const aheadY = p.pos.y + Math.sin((p.id + this.holdT) * 6) * 0.4
        this.ball.pos.x += (aheadX - this.ball.pos.x) * 0.6
        this.ball.pos.y += (aheadY - this.ball.pos.y) * 0.6
        this.ball.vel.x *= 0.85
        this.ball.vel.y *= 0.85

        // Utility scores for actions
        const distToOppGoal = p.team === 0 ? (W - p.pos.x) : p.pos.x
        const shootBias = p.team === 0 ? this.style.shootBias0 : this.style.shootBias1
        const uShoot = (1.2 - (distToOppGoal / 60)) * (0.8 + 0.4 * p.traits.power) * (0.7 + 0.6 * shootBias)

        // Evaluate best pass
        let best: Player | null = null
        let bestU = -Infinity
        for (const m of this.players) {
          if (m.team !== p.team || m.id === p.id) continue
          // predicted target position
          const lead = 0.6 + 0.6 * p.traits.vision
          const txp = m.pos.x + m.vel.x * lead
          const typ = m.pos.y + m.vel.y * lead
          const tx = txp - this.ball.pos.x
          const ty = typ - this.ball.pos.y
          const dist = Math.hypot(tx, ty)
          if (dist < 6 || dist > 45) continue
          // ahead preference
          const ahead = p.team === 0 ? (txp > p.pos.x) : (txp < p.pos.x)
          // simple intercept risk: nearest opponent distance to target vs travel time of ball
          let risk = 0
          for (const o of this.players) {
            if (o.team === p.team) continue
            const dox = txp - o.pos.x
            const doy = typ - o.pos.y
            const dOpp = Math.hypot(dox, doy)
            risk = Math.max(risk, Math.max(0, 1 - dOpp / 18)) // closer opponent -> higher risk (0..1)
          }
          const distPref = 1 - Math.abs(dist - 18) / 18 // peak around 18
          const u = (ahead ? 0.8 : 0.3) + 0.9 * distPref + 0.6 * p.traits.vision - 1.0 * risk
          if (u > bestU) { bestU = u; best = m }
        }
        const uPass = bestU

        // Soft decision
        const riskT = 0.6 + 0.8 * p.traits.risk // higher -> more randomness
        const choose = (x: number) => Math.exp(x / riskT)
        const ws = [choose(uShoot), choose(uPass || -10), choose(0.2)] // dribble baseline; penalize if no pass
        const sum = (ws[0] || 0) + (ws[1] || 0) + (ws[2] || 0)
        const r = this.rnd() * sum
        const w0 = ws[0] || 0, w1 = ws[1] || 0, w2 = ws[2] || 0
        const pick = r < w0 ? 'shoot' : (r < w0 + w1 ? 'pass' : 'dribble')

        if (pick === 'shoot' && distToOppGoal < 40) {
          const targetX = p.team === 0 ? W - 1.5 : 1.5
          const tx = targetX - this.ball.pos.x
          const ty = (H / 2 + (this.rnd() - 0.5) * 8) - this.ball.pos.y
          const d = Math.hypot(tx, ty) || 1
          const power = (38 + this.rnd() * 18) * (0.9 + 0.3 * p.traits.power)
          this.ball.vel.x = (tx / d) * power * dt
          this.ball.vel.y = (ty / d) * power * dt
          p.state = 'kick'
          this.possessor = null; this.holdT = 0
          this.shotJustNow = { byTeam: p.team }
        } else if (pick === 'pass' && best) {
            const passSpeed = (34 + this.rnd() * 12) * (0.9 + 0.3 * p.traits.vision)
            const dirx = best.pos.x - this.ball.pos.x
            const diry = best.pos.y - this.ball.pos.y
            const L = Math.hypot(dirx, diry) || 1
            const gvx = (dirx / L) * passSpeed
            const gvy = (diry / L) * passSpeed
            const interP = interceptConstantVel(this.ball.pos, { x: gvx, y: gvy } as any, best.pos, Math.max(6, 12 * best.traits.speed))
            const tx = (interP.ok ? interP.point.x : best.pos.x) + (this.rnd() - 0.5) * 1.0
            const ty = (interP.ok ? interP.point.y : best.pos.y) + (this.rnd() - 0.5) * 1.0
            const dxp = tx - this.ball.pos.x
            const dyp = ty - this.ball.pos.y
            const D = Math.hypot(dxp, dyp) || 1
            this.ball.vel.x = (dxp / D) * passSpeed * dt
            this.ball.vel.y = (dyp / D) * passSpeed * dt
            p.state = 'kick'
            this.possessor = null; this.holdT = 0
        } else {
          // keep dribbling; small sidestep towards open space
          const side = (this.rnd() - 0.5) * 0.6
          this.ball.pos.y = clamp(this.ball.pos.y + side, 2, H - 2)
        }
      }
    }

    // Players movement + spacing (repulsion between teammates)
    for (const p of this.players) {
      let ax = 0, ay = 0
      if (p.state === 'chase') {
        const press = p.team === 0 ? this.style.press0 : this.style.press1
        const speed = (18 + 8 * press) * p.traits.speed
        const inter = interceptConstantVel(this.ball.pos, this.ball.vel, p.pos, speed)
        const tx = inter.ok ? inter.point.x : this.ball.pos.x
        const ty = inter.ok ? inter.point.y : this.ball.pos.y
        const dx = tx - p.pos.x
        const dy = ty - p.pos.y
        const d = Math.hypot(dx, dy) || 1
        ax += (dx / d) * speed * dt
        ay += (dy / d) * speed * dt
      } else if (p.state === 'return') {
        const dx = p.home.x - p.pos.x
        const dy = p.home.y - p.pos.y
        const d = Math.hypot(dx, dy) || 1
        const speed = 10 + 6 * p.traits.speed
        ax += (dx / d) * speed * dt
        ay += (dy / d) * speed * dt
      }
      // simple teammate repulsion to avoid bunching
      for (const q of this.players) {
        if (q === p || q.team !== p.team) continue
        const dx = p.pos.x - q.pos.x
        const dy = p.pos.y - q.pos.y
        const d2 = dx*dx + dy*dy
        const minR = 4
        if (d2 > 0.01 && d2 < minR*minR) {
          const d = Math.sqrt(d2)
          const push = (minR - d) * 0.6
          ax += (dx / d) * push * dt
          ay += (dy / d) * push * dt
        }
      }
      // Basic GK behavior: keep near goal line tracking ball Y
      if (p.traits.gk) {
        const gx = p.team === 0 ? 3 : (W - 3)
        const targetY = clamp(this.ball.pos.y, 6, H - 6)
        ax += (gx - p.pos.x) * 0.6 * dt
        ay += (targetY - p.pos.y) * 0.5 * dt
      }
      p.vel.x = p.vel.x * 0.9 + ax
      p.vel.y = p.vel.y * 0.9 + ay
      p.pos.x = clamp(p.pos.x + p.vel.x * dt, 2, W - 2)
      p.pos.y = clamp(p.pos.y + p.vel.y * dt, 2, H - 2)
    }

    // Ball movement & collisions
    this.ball.pos.x += this.ball.vel.x * dt
    this.ball.pos.y += this.ball.vel.y * dt
    this.ball.vel.x *= 0.985
    this.ball.vel.y *= 0.985
    if (this.ball.pos.y < 1) { this.ball.pos.y = 1; this.ball.vel.y *= -0.6 }
    if (this.ball.pos.y > H - 1) { this.ball.pos.y = H - 1; this.ball.vel.y *= -0.6 }

    // Goalkeeper save attempt when a shot just set ball toward goal
    if (this.shotJustNow) {
      const towardsRight = this.ball.vel.x > 0
      const goalX = towardsRight ? (W - 0.5) : 0.5
      if ((towardsRight && this.ball.pos.x < goalX) || (!towardsRight && this.ball.pos.x > goalX)) {
        const tGoal = Math.abs((goalX - this.ball.pos.x) / (this.ball.vel.x || 1e-6))
        if (tGoal > 0 && tGoal < 2.0) {
          const yAtGoal = this.ball.pos.y + this.ball.vel.y * tGoal
          // defending GK
          const gk = this.players.find(p => p.traits.gk && p.team !== this.shotJustNow!.byTeam)
          if (gk) {
            const dist = Math.hypot((gk.pos.x - goalX), (gk.pos.y - yAtGoal))
            const gkReach = (3.0 * gk.traits.speed) * tGoal + 2.0 // move + reaction radius
            if (dist < gkReach) {
              // save: reflect some velocity back into field
              this.ball.vel.x = -this.ball.vel.x * 0.35
              this.ball.vel.y = this.ball.vel.y * 0.2
              // nudge ball from line
              this.ball.pos.x = towardsRight ? (W - 2) : 2
              this.shotJustNow = null
            }
          }
        }
      }
    }

    // Goals
    if (this.ball.pos.x < 0.5) {
      this.events.push({ type: 'goal', side: 'left', t: Date.now() })
      this.resetKickoff()
    } else if (this.ball.pos.x > W - 0.5) {
      this.events.push({ type: 'goal', side: 'right', t: Date.now() })
      this.resetKickoff()
    }
  }
}
