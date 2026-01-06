import { gameplayConfig } from '../config/gameplay';

export type WorldRect = { x: number; y: number; w: number; h: number };
export type KeepOutEllipse = { type: 'ellipse'; x: number; y: number; w: number; h: number };

export type WorldConfig = {
  rect: WorldRect;
  keepOut: KeepOutEllipse;
  seed: number;
  spritePxWorld: number; // nominal sprite diameter in world units
  rimSuppression: { inner: number; outer: number; min: number; mid: number };
};

function hash32(s: string) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

export function worldConfig(): WorldConfig {
  // World dimensions chosen to comfortably host ~2k sprites with keep-out center
  const { width, height, keepOutWidth, keepOutHeight, seed: seedStr, spritePx } = gameplayConfig.world;
  const cx = 0, cy = 0;
  const seed = hash32(seedStr);

  return {
    rect: { x: cx, y: cy, w: width, h: height },
    keepOut: { type: 'ellipse', x: cx, y: cy, w: keepOutWidth, h: keepOutHeight },
    seed,
    spritePxWorld: spritePx,
    // Stronger/wider suppression band to kill rings and keep opening clean
    rimSuppression: { inner: 1.0, outer: 1.45, min: 0.22, mid: 0.48 },
  };
}

export function isInsideKeepOut(x: number, y: number, cfg = worldConfig()): boolean {
  const e = cfg.keepOut;
  const nx = (x - e.x) / (e.w / 2);
  const ny = (y - e.y) / (e.h / 2);
  return (nx * nx + ny * ny) < 1;
}

export function rimPenalty(x: number, y: number, cfg = worldConfig()): number {
  const e = cfg.keepOut;
  const nx = (x - e.x) / (e.w / 2);
  const ny = (y - e.y) / (e.h / 2);
  const k = Math.sqrt(nx * nx + ny * ny);
  const { inner, outer, min, mid } = cfg.rimSuppression;
  if (k <= inner) return 0; // inside keep-out => fully suppressed
  if (k <= (inner + 0.10)) return min; // immediately outside edge: strongest suppression
  if (k <= outer) return mid; // still near: medium suppression
  return 1.0; // no penalty farther away
}

export function worldBounds(cfg = worldConfig()) {
  const { x, y, w, h } = cfg.rect;
  return { minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2 };
}
