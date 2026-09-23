import * as THREE from 'three'
import { Fx, type FxCtx, OrbFx, RingFx, RibbonFx, LightFx, burst, spawnBolt, boltPath } from './effects'
import { type Vec2, dist, norm, rand, pick } from '../math'

const WHITE = new THREE.Color(1, 1, 1)

/* =========================================================
   01 気弾：手元からタップ地点へ飛ぶ光弾
   ========================================================= */
export class ProjectileFx extends Fx {
  private orb: OrbFx
  private pos: Vec2
  private vel: Vec2
  private color: THREE.Color
  private color2: THREE.Color
  private age = 0
  private maxAge: number

  constructor(
    private ctx: FxCtx,
    from: Vec2,
    private to: Vec2,
    color: string,
    private onHit: () => void,
  ) {
    super()
    const u = ctx.stage.unit
    this.color = new THREE.Color(color)
    this.color2 = new THREE.Color('#1a5cff')
    this.pos = { ...from }
    const d = norm({ x: to.x - from.x, y: to.y - from.y })
    const speed = 2100 * u
    this.vel = { x: d.x * speed, y: d.y * speed }
    this.maxAge = dist(from, to) / speed
    this.orb = ctx.fx.add(new OrbFx(ctx))
    this.orb.outer.copy(this.color2)
    this.orb.inner.copy(this.color)
    this.orb.r = 15 * u
    this.orb.rays = 0.4
    burst(ctx, from.x, from.y, 14, [this.color, WHITE], { speed: [200, 700], life: [0.15, 0.35], size: [2, 4], dir: d, spread: 0.7 })
    ctx.fx.add(new RingFx(ctx, { x: from.x, y: from.y, r0: 6 * u, r1: 50 * u, life: 0.25, color: this.color, width: 3 * u }))
  }

  update(dt: number) {
    const u = this.ctx.stage.unit
    this.age += dt
    if (this.age >= this.maxAge) {
      this.explode()
      this.dead = true
      return
    }
    this.pos.x += this.vel.x * dt
    this.pos.y += this.vel.y * dt
    this.orb.x = this.pos.x
    this.orb.y = this.pos.y
    for (let i = 0; i < 3; i++) {
      this.ctx.particles.emit({
        x: this.pos.x + rand(-4, 4) * u,
        y: this.pos.y + rand(-4, 4) * u,
        vx: -this.vel.x * rand(0.05, 0.2) + rand(-60, 60) * u,
        vy: -this.vel.y * rand(0.05, 0.2) + rand(-60, 60) * u,
        life: rand(0.15, 0.35),
        size: rand(2, 5) * u,
        color: pick([this.color, this.color2, WHITE]),
        stretch: 0.02,
        drag: 4,
      })
    }
  }

  private explode() {
    const { ctx, to } = this
    const u = ctx.stage.unit
    ctx.fx.add(new RingFx(ctx, { x: to.x, y: to.y, r0: 10 * u, r1: 130 * u, life: 0.45, color: this.color, width: 5 * u, distort: 12 * u }))
    const flash = ctx.fx.add(new OrbFx(ctx))
    flash.x = to.x
    flash.y = to.y
    flash.r = 34 * u
    flash.outer.copy(this.color2)
    flash.inner.copy(this.color)
    flash.fadeOut(0.3, 2)
    burst(ctx, to.x, to.y, 46, [this.color, this.color2, WHITE], { speed: [200, 900], life: [0.25, 0.6], size: [2, 5] })
    ctx.fx.add(new LightFx(ctx, to.x, to.y, this.color, 1.6, 160 * u, 0.4))
    ctx.stage.kick({ shake: 0.22, aberr: 0.35 })
    this.onHit()
  }

  dispose() {
    this.orb.fadeOut(0.08, 1)
  }
}

/* =========================================================
   02 雷撃：画面上端からタップ地点へ落雷
   ========================================================= */
export class ThunderFx extends Fx {
  private age = 0
  private strikes = [0, 0.09, 0.22]
  private color: THREE.Color

  constructor(
    private ctx: FxCtx,
    private p: Vec2,
    color: string,
  ) {
    super()
    this.color = new THREE.Color(color)
  }

  private strike(first: boolean) {
    const { ctx, p } = this
    const u = ctx.stage.unit
    const top = { x: p.x + rand(-180, 180) * u, y: -30 }
    const main = boltPath(top, p, Math.max(60, p.y * 0.12), 6)
    ctx.fx.add(new RibbonFx(ctx, main, { color: this.color, width: 7 * u, life: 0.1, coreK: 3.2, flicker: true, widthFn: (t) => 0.55 + t * 0.45 }))
    // 枝分かれ
    const branches = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < branches; i++) {
      const from = main[Math.floor(rand(0.2, 0.8) * main.length)]
      const ang = Math.PI / 2 + rand(-1.1, 1.1)
      const l = rand(80, 220) * u
      spawnBolt(ctx, from, { x: from.x + Math.cos(ang) * l, y: from.y + Math.sin(ang) * l }, this.color, 2.6 * u, 0.09)
    }
    ctx.stage.kick({ flash: first ? 0.12 : 0.06, shake: first ? 0.34 : 0.12, aberr: 0.5 })
    ctx.stage.addLight({ ax: top.x, ay: top.y, bx: p.x, by: p.y, color: this.color, intensity: 1.6, radius: 120 * u })
    if (first) {
      ctx.fx.add(new RingFx(ctx, { x: p.x, y: p.y, r0: 8 * u, r1: 150 * u, life: 0.5, color: this.color, width: 5 * u, distort: 14 * u }))
      const flash = ctx.fx.add(new OrbFx(ctx))
      flash.x = p.x
      flash.y = p.y
      flash.r = 30 * u
      flash.outer.set('#3050ff')
      flash.inner.copy(this.color)
      flash.rays = 0.8
      flash.fadeOut(0.35, 1.8)
      burst(ctx, p.x, p.y, 60, [this.color, WHITE], { speed: [250, 1000], life: [0.2, 0.6], size: [1.5, 4], dir: { x: 0, y: -1 }, spread: 1.4, gravity: 1400 })
      ctx.fx.add(new LightFx(ctx, p.x, p.y, this.color, 2, 220 * u, 0.5))
    }
  }

  update(dt: number) {
    this.age += dt
    while (this.strikes.length && this.age >= this.strikes[0]) {
      const first = this.strikes.length === 3
      this.strikes.shift()
      this.strike(first)
    }
    if (this.age > 0.6) this.dead = true
  }

  dispose() {}
}

/* =========================================================
   03 爆裂：タップ地点で爆発
   ========================================================= */
export class NovaFx extends Fx {
  private age = 0
  private ball: OrbFx

  constructor(
    private ctx: FxCtx,
    p: Vec2,
    color: string,
  ) {
    super()
    const u = ctx.stage.unit
    const c1 = new THREE.Color(color)
    const c2 = new THREE.Color('#ffd35a')
    const c3 = new THREE.Color('#ff2a00')
    this.ball = ctx.fx.add(new OrbFx(ctx))
    this.ball.x = p.x
    this.ball.y = p.y
    this.ball.outer.copy(c3)
    this.ball.inner.copy(c2)
    this.ball.unstable = 1
    this.ball.r = 12 * u
    ctx.fx.add(new RingFx(ctx, { x: p.x, y: p.y, r0: 20 * u, r1: 440 * u, life: 0.75, color: c1, width: 11 * u, distort: 28 * u }))
    ctx.fx.add(new RingFx(ctx, { x: p.x, y: p.y, r0: 10 * u, r1: 260 * u, life: 0.5, color: WHITE, width: 4 * u, delay: 0.07, alpha: 0.8 }))
    burst(ctx, p.x, p.y, 110, [c1, c2, c3, WHITE], { speed: [250, 1300], life: [0.4, 1.1], size: [2, 6], gravity: 900, drag: 1.6 })
    ctx.fx.add(new LightFx(ctx, p.x, p.y, c1, 2.4, 300 * u, 0.8))
    ctx.stage.kick({ shake: 0.62, flash: 0.18, aberr: 0.9 })
  }

  update(dt: number) {
    const u = this.ctx.stage.unit
    this.age += dt
    const k = Math.min(1, this.age / 0.4)
    this.ball.r = (12 + 110 * (1 - Math.pow(1 - k, 3))) * u
    this.ball.intensity = 1.6 * (1 - k)
    if (this.age > 0.45) this.dead = true
  }

  dispose() {
    this.ball.fadeOut(0.15, 1.2)
  }
}

/* =========================================================
   04 斬撃：なぞった軌跡、またはタップ地点に十字
   ========================================================= */
export class SlashFx extends Fx {
  private age = 0

  constructor(ctx: FxCtx, paths: Vec2[][], color: string) {
    super()
    const u = ctx.stage.unit
    const c = new THREE.Color(color)
    const blade = (x: number) => Math.pow(Math.sin(Math.PI * x), 0.6)
    paths.forEach((path, i) => {
      const delay = i * 0.06
      ctx.fx.add(new RibbonFx(ctx, path, { color: c, width: 13 * u, life: 0.42, reveal: 0.08, tailDelay: 0.12, tailDur: 0.24, coreK: 3.4, widthFn: blade, delay }))
      const shifted = path.map((p) => ({ x: p.x + 5 * u, y: p.y - 7 * u }))
      ctx.fx.add(new RibbonFx(ctx, shifted, { color: WHITE, width: 3 * u, life: 0.36, reveal: 0.09, tailDelay: 0.1, tailDur: 0.2, coreK: 1.6, widthFn: blade, delay: delay + 0.02, alpha: 0.7 }))
      for (let j = 0; j < 26; j++) {
        const q = path[Math.floor(rand(0.1, 0.9) * path.length)]
        const a = rand(0, Math.PI * 2)
        const sp = rand(150, 700) * u
        ctx.particles.emit({ x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.2, 0.5), size: rand(1.5, 3.5) * u, color: pick([c, WHITE]), stretch: 0.03, drag: 3 })
      }
      const mid = path[Math.floor(path.length / 2)]
      ctx.fx.add(new LightFx(ctx, mid.x, mid.y, c, 1.3, 180 * u, 0.35))
    })
    ctx.stage.kick({ shake: 0.28, aberr: 0.6 })
  }

  update(dt: number) {
    this.age += dt
    if (this.age > 0.2) this.dead = true
  }

  dispose() {}
}

/** タップ地点を中心にした十字（わずかに弧を描く 2 本） */
export function crossPaths(p: Vec2, size: number): Vec2[][] {
  const arc = (a: Vec2, b: Vec2, bend: number) => {
    const n = norm({ x: -(b.y - a.y), y: b.x - a.x })
    const pts: Vec2[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const s = Math.sin(Math.PI * t) * bend
      pts.push({ x: a.x + (b.x - a.x) * t + n.x * s, y: a.y + (b.y - a.y) * t + n.y * s })
    }
    return pts
  }
  return [
    arc({ x: p.x - size, y: p.y - size * 0.9 }, { x: p.x + size, y: p.y + size * 0.9 }, size * 0.12),
    arc({ x: p.x + size, y: p.y - size * 0.9 }, { x: p.x - size, y: p.y + size * 0.9 }, -size * 0.12),
  ]
}

/** なぞった軌跡を等間隔に打ち直して滑らかにする */
export function smoothPath(raw: Vec2[], step: number): Vec2[] {
  if (raw.length < 2) return raw
  const out: Vec2[] = [raw[0]]
  let acc = 0
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1]
    const b = raw[i]
    const d = dist(a, b)
    acc += d
    if (acc >= step) {
      out.push(b)
      acc = 0
    }
  }
  if (out[out.length - 1] !== raw[raw.length - 1]) out.push(raw[raw.length - 1])
  // Chaikin で角を取る
  let pts = out
  for (let k = 0; k < 2; k++) {
    const next: Vec2[] = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  return pts.length > 90 ? pts.filter((_, i) => i % Math.ceil(pts.length / 90) === 0) : pts
}
