export interface Vec2 {
  x: number
  y: number
}

export const v2 = (x = 0, y = 0): Vec2 => ({ x, y })
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
export const len = (v: Vec2) => Math.hypot(v.x, v.y)

export function norm(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y)
  return l > 1e-6 ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

/** フレームレートに依存しない指数的な追従係数 */
export const follow = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)

/** 2 つの向きのなす角（ラジアン） */
export function angleBetween(a: Vec2, b: Vec2): number {
  const d = (a.x * b.x + a.y * b.y) / (len(a) * len(b) || 1)
  return Math.acos(clamp(d, -1, 1))
}

/** 向きを最短経路で回して追従させる（逆向きでも 0 ベクトルを経由しない） */
export function turnToward(cur: Vec2, target: Vec2, k: number): Vec2 {
  const a = Math.atan2(cur.y, cur.x)
  const b = Math.atan2(target.y, target.x)
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  const r = a + d * k
  return { x: Math.cos(r), y: Math.sin(r) }
}

/** 原点から向き d に進んで画面の外に出るまでの距離 */
export function rayExit(o: Vec2, d: Vec2, W: number, H: number): number {
  let t = Infinity
  if (d.x > 1e-6) t = Math.min(t, (W - o.x) / d.x)
  if (d.x < -1e-6) t = Math.min(t, -o.x / d.x)
  if (d.y > 1e-6) t = Math.min(t, (H - o.y) / d.y)
  if (d.y < -1e-6) t = Math.min(t, -o.y / d.y)
  return Number.isFinite(t) ? Math.max(0, t) : 0
}
