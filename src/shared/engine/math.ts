export type Vec = { x: number; y: number }

export function add(a: Vec, b: Vec): Vec { return { x: a.x + b.x, y: a.y + b.y } }
export function sub(a: Vec, b: Vec): Vec { return { x: a.x - b.x, y: a.y - b.y } }
export function mul(v: Vec, s: number): Vec { return { x: v.x * s, y: v.y * s } }
export function div(v: Vec, s: number): Vec { return { x: v.x / s, y: v.y / s } }
export function dot(a: Vec, b: Vec): number { return a.x * b.x + a.y * b.y }
export function len(v: Vec): number { return Math.hypot(v.x, v.y) }
export function norm(v: Vec): Vec { const L = len(v); return L > 1e-8 ? div(v, L) : { x: 0, y: 0 } }
export function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)) }
export function dist(a: Vec, b: Vec): number { return len(sub(b, a)) }

