import * as THREE from 'three'
import type { Stage } from './Stage'
import type { Particles } from './Particles'
import { BEAM_FRAG, FRONT_FRAG, NOISE, ORB_FRAG, RIBBON_FRAG, RING_FRAG, VERT } from './shaders'
import { type Vec2, norm, rand, rayExit, turnToward, follow, pick } from '../math'
import type { Tier } from '../config'

export interface FxCtx {
  stage: Stage
  particles: Particles
  fx: FxManager
}

export abstract class Fx {
  dead = false
  abstract update(dt: number, t: number): void
  abstract dispose(): void
}

export class FxManager {
  private list: Fx[] = []

  add<T extends Fx>(f: T): T {
    this.list.push(f)
    return f
  }

  update(dt: number, t: number) {
    // update 中に追加された FX も同じフレームで動かす
    for (let i = 0; i < this.list.length; i++) {
      const f = this.list[i]
      if (!f.dead) f.update(dt, t)
    }
    this.list = this.list.filter((f) => {
      if (f.dead) f.dispose()
      return !f.dead
    })
  }
}

export const QUAD = new THREE.PlaneGeometry(1, 1)
/** 原点から +x 方向に伸びる板（ビーム用） */
const BEAM_GEO = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0)
const WHITE = new THREE.Color(1, 1, 1)

function fxMaterial(frag: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: NOISE + frag,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

function addMesh(ctx: FxCtx, geo: THREE.BufferGeometry, mat: THREE.Material, order: number) {
  const m = new THREE.Mesh(geo, mat)
  m.renderOrder = order
  m.frustumCulled = false
  ctx.stage.scene.add(m)
  return m
}

/* =========================================================
   溜め玉 / 発射口
   ========================================================= */
export class OrbFx extends Fx {
  x = 0
  y = 0
  r = 20
  intensity = 1
  rays = 0
  unstable = 0
  prism = false
  light = 1
  readonly outer = new THREE.Color('#4d5a6e')
  readonly inner = new THREE.Color('#d9e2ef')
  private mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial
  private fadeT = -1
  private fadeDur = 0.25
  private fadeGrow = 1

  constructor(private ctx: FxCtx) {
    super()
    this.mat = fxMaterial(ORB_FRAG, {
      uTime: { value: 0 },
      uHalf: { value: 1 },
      uR: { value: 1 },
      uInt: { value: 1 },
      uRays: { value: 0 },
      uSeed: { value: Math.random() * 100 },
      uPrism: { value: 0 },
      uUnstable: { value: 0 },
      uOuter: { value: this.outer },
      uInner: { value: this.inner },
    })
    this.mesh = addMesh(ctx, QUAD, this.mat, 4)
  }

  /** 消えながら少し膨らむ */
  fadeOut(dur = 0.25, grow = 1.3) {
    if (this.fadeT >= 0) return
    this.fadeT = 0
    this.fadeDur = dur
    this.fadeGrow = grow
  }

  update(dt: number, t: number) {
    let k = 1
    let grow = 1
    if (this.fadeT >= 0) {
      this.fadeT += dt
      const f = this.fadeT / this.fadeDur
      if (f >= 1) {
        this.dead = true
        return
      }
      k = 1 - f
      grow = 1 + (this.fadeGrow - 1) * f
    }
    const r = this.r * grow
    const half = r * (this.rays > 0 ? 6 : 3.2)
    this.mesh.position.set(this.x, this.y, 0)
    this.mesh.scale.set(half * 2, half * 2, 1)
    const u = this.mat.uniforms
    u.uTime.value = t
    u.uHalf.value = half
    u.uR.value = r
    u.uInt.value = this.intensity * k
    u.uRays.value = this.rays
    u.uPrism.value = this.prism ? 1 : 0
    u.uUnstable.value = this.unstable
    if (this.light > 0) {
      this.ctx.stage.addLight({
        ax: this.x,
        ay: this.y,
        bx: this.x,
        by: this.y,
        color: this.inner,
        intensity: 0.55 * this.light * this.intensity * k,
        radius: r * 3.2 + 30,
      })
    }
  }

  dispose() {
    this.ctx.stage.scene.remove(this.mesh)
    this.mat.dispose()
  }
}

/* =========================================================
   衝撃波リング
   ========================================================= */
export interface RingOpts {
  x: number
  y: number
  r0: number
  r1: number
  life: number
  color: THREE.Color
  /** 線の太さ px */
  width: number
  alpha?: number
  /** 背景映像を歪める強さ px */
  distort?: number
  angle?: number
  /** 横方向の潰し（ビームに沿うリング用） */
  squash?: number
  vx?: number
  vy?: number
  delay?: number
}

export class RingFx extends Fx {
  private mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial
  private age = 0
  private x: number
  private y: number

  constructor(
    private ctx: FxCtx,
    private o: RingOpts,
  ) {
    super()
    this.x = o.x
    this.y = o.y
    this.mat = fxMaterial(RING_FRAG, {
      uR: { value: 0.5 },
      uW: { value: 0.05 },
      uAlpha: { value: 0 },
      uCol: { value: o.color.clone() },
    })
    this.mesh = addMesh(ctx, QUAD, this.mat, 3)
    this.mesh.visible = false
  }

  update(dt: number) {
    const o = this.o
    this.age += dt
    const a = this.age - (o.delay ?? 0)
    if (a < 0) return
    const k = a / o.life
    if (k >= 1) {
      this.dead = true
      return
    }
    this.x += (o.vx ?? 0) * dt
    this.y += (o.vy ?? 0) * dt
    const e = 1 - Math.pow(1 - k, 3)
    const r = o.r0 + (o.r1 - o.r0) * e
    const half = r + o.width * 3
    this.mesh.visible = true
    this.mesh.position.set(this.x, this.y, 0)
    this.mesh.rotation.z = o.angle ?? 0
    this.mesh.scale.set(half * 2 * (o.squash ?? 1), half * 2, 1)
    const u = this.mat.uniforms
    u.uR.value = r / half
    u.uW.value = o.width / half
    u.uAlpha.value = (o.alpha ?? 1) * Math.pow(1 - k, 1.4)
    if (o.distort) this.ctx.stage.addWave({ x: this.x, y: this.y, r, w: o.width * 2.5 + 8, s: o.distort * (1 - k) })
  }

  dispose() {
    this.ctx.stage.scene.remove(this.mesh)
    this.mat.dispose()
  }
}

/* =========================================================
   帯：稲妻・斬撃・アーク
   ========================================================= */
export interface RibbonOpts {
  color: THREE.Color
  width: number
  life: number
  alpha?: number
  /** 描き切るまでの秒数。0 なら最初から全体 */
  reveal?: number
  /** 尾が消え始めるまでの秒数と、消え切るまでの秒数 */
  tailDelay?: number
  tailDur?: number
  coreK?: number
  flicker?: boolean
  widthFn?: (u: number) => number
  delay?: number
}

const MAX_RIBBON_PTS = 96

export class RibbonFx extends Fx {
  private geo = new THREE.BufferGeometry()
  private posArr = new Float32Array(MAX_RIBBON_PTS * 2 * 3)
  private uvArr = new Float32Array(MAX_RIBBON_PTS * 2 * 2)
  private mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial
  private age = 0

  constructor(
    private ctx: FxCtx,
    pts: Vec2[],
    private o: RibbonOpts,
  ) {
    super()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uvArr, 2).setUsage(THREE.DynamicDrawUsage))
    const idx: number[] = []
    for (let i = 0; i < MAX_RIBBON_PTS - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.geo.setIndex(idx)
    this.mat = fxMaterial(RIBBON_FRAG, {
      uCol: { value: o.color.clone() },
      uAlpha: { value: 0 },
      uReveal: { value: 1.1 },
      uTail: { value: -0.1 },
      uCoreK: { value: o.coreK ?? 2.2 },
    })
    this.mesh = addMesh(ctx, this.geo, this.mat, 5)
    this.setPoints(pts)
    if (o.delay) this.mesh.visible = false
  }

  setPoints(input: Vec2[]) {
    const pts = input.length > MAX_RIBBON_PTS ? input.slice(0, MAX_RIBBON_PTS) : input
    const n = pts.length
    if (n < 2) {
      this.geo.setDrawRange(0, 0)
      return
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i]
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(n - 1, i + 1)]
      const tg = norm({ x: b.x - a.x, y: b.y - a.y })
      const u = i / (n - 1)
      const w = this.o.width * (this.o.widthFn ? this.o.widthFn(u) : 1)
      const nx = -tg.y * w
      const ny = tg.x * w
      this.posArr.set([p.x + nx, p.y + ny, 0, p.x - nx, p.y - ny, 0], i * 6)
      this.uvArr.set([u, 0, u, 1], i * 4)
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.uv.needsUpdate = true
    this.geo.setDrawRange(0, (n - 1) * 6)
  }

  update(dt: number, t: number) {
    const o = this.o
    this.age += dt
    const a = this.age - (o.delay ?? 0)
    if (a < 0) return
    this.mesh.visible = true
    if (a >= o.life) {
      this.dead = true
      return
    }
    const u = this.mat.uniforms
    u.uReveal.value = o.reveal ? Math.min(1.1, (a / o.reveal) * 1.1) : 1.1
    const td = o.tailDelay ?? Infinity
    u.uTail.value = a > td ? Math.min(1.05, ((a - td) / (o.tailDur ?? 0.2)) * 1.05) - 0.05 : -0.1
    const fade = o.tailDelay === undefined ? 1 - Math.pow(a / o.life, 2) : 1
    const flick = o.flicker ? 0.65 + 0.35 * Math.sin(t * 90 + this.age * 40) : 1
    u.uAlpha.value = (o.alpha ?? 1) * fade * flick
  }

  dispose() {
    this.ctx.stage.scene.remove(this.mesh)
    this.geo.dispose()
    this.mat.dispose()
  }
}

/** 中点変位法で稲妻の折れ線を作る */
export function boltPath(a: Vec2, b: Vec2, disp: number, depth = 5): Vec2[] {
  let pts: Vec2[] = [a, b]
  let d = disp
  for (let k = 0; k < depth; k++) {
    const next: Vec2[] = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i]
      const q = pts[i + 1]
      const n = norm({ x: -(q.y - p.y), y: q.x - p.x })
      const o = rand(-d, d)
      next.push({ x: (p.x + q.x) / 2 + n.x * o, y: (p.y + q.y) / 2 + n.y * o }, q)
    }
    pts = next
    d *= 0.55
  }
  return pts
}

/** 稲妻を 1 本出す（すぐ消える） */
export function spawnBolt(ctx: FxCtx, a: Vec2, b: Vec2, color: THREE.Color, width: number, life = 0.08, disp?: number) {
  const L = Math.hypot(b.x - a.x, b.y - a.y)
  const pts = boltPath(a, b, disp ?? L * 0.18, L > 260 ? 5 : 4)
  return ctx.fx.add(new RibbonFx(ctx, pts, { color, width, life, coreK: 2.6, flicker: true, widthFn: (u) => 1 - u * 0.55 }))
}

/* =========================================================
   背景映像を一瞬照らす光
   ========================================================= */
export class LightFx extends Fx {
  private age = 0
  constructor(
    private ctx: FxCtx,
    private x: number,
    private y: number,
    private color: THREE.Color,
    private intensity: number,
    private radius: number,
    private life: number,
  ) {
    super()
  }

  update(dt: number) {
    this.age += dt
    const k = this.age / this.life
    if (k >= 1) {
      this.dead = true
      return
    }
    const x = this.x
    const y = this.y
    this.ctx.stage.addLight({ ax: x, ay: y, bx: x, by: y, color: this.color, intensity: this.intensity * (1 - k) * (1 - k), radius: this.radius })
  }

  dispose() {}
}

/** 放射状に火花を散らす */
export function burst(
  ctx: FxCtx,
  x: number,
  y: number,
  n: number,
  colors: THREE.Color[],
  o: { speed: [number, number]; life: [number, number]; size: [number, number]; gravity?: number; drag?: number; dir?: Vec2; spread?: number; stretch?: number },
) {
  const u = ctx.stage.unit
  const base = o.dir ? Math.atan2(o.dir.y, o.dir.x) : 0
  for (let i = 0; i < n; i++) {
    const ang = o.dir ? base + rand(-1, 1) * (o.spread ?? 0.6) : rand(0, Math.PI * 2)
    const sp = rand(o.speed[0], o.speed[1]) * u
    ctx.particles.emit({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: rand(o.life[0], o.life[1]),
      size: rand(o.size[0], o.size[1]) * u,
      color: pick(colors),
      stretch: o.stretch ?? 0.035,
      drag: o.drag ?? 2,
      gravity: (o.gravity ?? 0) * u,
    })
  }
}

/* =========================================================
   ビーム（横方向）
   ========================================================= */
export interface BeamOpts {
  tier: Tier
  tierIdx: number
  ki: boolean
  duration: number
  origin: Vec2
  dir: Vec2
}

export interface SteerableBeam extends Fx {
  steer(origin: Vec2, dir: Vec2): void
  readonly progress: number
  readonly info: { tierIdx: number; ki: boolean; front: boolean; remain: number }
}

export class BeamFx extends Fx implements SteerableBeam {
  private age = 0
  private origin: Vec2
  private dir: Vec2
  private tOrigin: Vec2
  private tDir: Vec2
  private mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial
  private muzzle: OrbFx
  private outer: THREE.Color
  private inner: THREE.Color
  private core: number
  private ringT = 0
  private arcT = 0
  private pAcc = 0

  constructor(
    private ctx: FxCtx,
    private o: BeamOpts,
  ) {
    super()
    const { tier, tierIdx, ki } = o
    const u = ctx.stage.unit
    this.origin = { ...o.origin }
    this.tOrigin = { ...o.origin }
    this.dir = norm(o.dir)
    this.tDir = { ...this.dir }
    this.outer = new THREE.Color(tier.outer)
    this.inner = new THREE.Color(tier.inner)
    this.core = tier.core * u * (ki ? 1.35 : 1)

    this.mat = fxMaterial(BEAM_FRAG, {
      uTime: { value: 0 },
      uTotal: { value: 1 },
      uPad: { value: 0 },
      uHalfH: { value: 1 },
      uHead: { value: 0 },
      uCore: { value: this.core },
      uAlpha: { value: 1 },
      uSeed: { value: Math.random() * 50 },
      uKi: { value: ki ? 1 : 0 },
      uPrism: { value: tier.prism ? 1 : 0 },
      uOuter: { value: this.outer },
      uInner: { value: this.inner },
    })
    this.mesh = addMesh(ctx, BEAM_GEO, this.mat, 2)

    this.muzzle = ctx.fx.add(new OrbFx(ctx))
    this.muzzle.outer.copy(this.outer)
    this.muzzle.inner.copy(this.inner)
    this.muzzle.rays = tierIdx >= 3 ? 1 : tierIdx >= 1 ? 0.6 : 0.3
    this.muzzle.prism = tier.prism
    this.muzzle.light = 0

    // 発射の瞬間
    const { x, y } = this.origin
    ctx.fx.add(new RingFx(ctx, { x, y, r0: this.core, r1: this.core * 6 + 90 * u, life: 0.55, color: this.inner, width: 5 * u, distort: 12 * u * (1 + tierIdx * 0.5) }))
    if (tierIdx >= 3) {
      ctx.fx.add(new RingFx(ctx, { x, y, r0: this.core * 2, r1: this.core * 12 + 200 * u, life: 0.8, color: this.outer, width: 9 * u, distort: 30 * u, delay: 0.06 }))
    }
    burst(ctx, x, y, 40 + tierIdx * 30, [this.inner, this.outer, WHITE], {
      speed: [300, 1300],
      life: [0.25, 0.7],
      size: [2, 5],
      dir: this.dir,
      spread: 1.2,
    })
    ctx.stage.kick({
      shake: tier.shake,
      flash: 0.05 + 0.04 * tierIdx,
      aberr: 0.35 + 0.28 * tierIdx,
      invert: tier.prism ? 0.9 : 0,
      glitch: tier.prism ? 1 : 0,
    })
  }

  get progress() {
    return this.age / this.o.duration
  }

  get info() {
    return { tierIdx: this.o.tierIdx, ki: this.o.ki, front: false, remain: Math.max(0, this.o.duration - this.age) }
  }

  steer(origin: Vec2, dir: Vec2) {
    this.tOrigin = { ...origin }
    this.tDir = norm(dir)
  }

  update(dt: number, t: number) {
    const { tier, tierIdx, ki, duration } = this.o
    const { stage } = this.ctx
    const u = stage.unit
    this.age += dt
    if (this.age >= duration) {
      this.dead = true
      return
    }

    const k = follow(16, dt)
    this.origin.x += (this.tOrigin.x - this.origin.x) * k
    this.origin.y += (this.tOrigin.y - this.origin.y) * k
    this.dir = turnToward(this.dir, this.tDir, follow(9, dt))
    const O = this.origin
    const D = this.dir
    const N = { x: -D.y, y: D.x }

    const L = Math.hypot(stage.W, stage.H) * 1.3
    const growT = ki ? 0.5 : 0.16
    const g = Math.min(1, this.age / growT)
    const head = L * (1 - Math.pow(1 - g, 3))

    const attack = 1 + 0.7 * Math.exp(-this.age * 9)
    const relStart = duration * 0.72
    const rel = this.age > relStart ? 1 - (this.age - relStart) / (duration - relStart) : 1
    const flick = 0.93 + 0.07 * Math.sin(t * 71) + (tierIdx >= 2 ? 0.05 * Math.sin(t * 131) : 0)
    const width = this.core * attack * Math.pow(rel, 0.7) * flick
    const alpha = Math.min(1, rel * 1.8)

    const pad = width * 5
    const halfH = width * (tier.prism ? 4 : 3.2)
    this.mesh.position.set(O.x - D.x * pad, O.y - D.y * pad, 0)
    this.mesh.rotation.z = Math.atan2(D.y, D.x)
    this.mesh.scale.set(L + pad, halfH * 2, 1)
    const un = this.mat.uniforms
    un.uTime.value = t
    un.uTotal.value = L + pad
    un.uPad.value = pad
    un.uHalfH.value = halfH
    un.uHead.value = head
    un.uCore.value = width
    un.uAlpha.value = alpha

    this.muzzle.x = O.x
    this.muzzle.y = O.y
    this.muzzle.r = width * 0.95
    this.muzzle.intensity = alpha

    const vis = Math.min(head, rayExit(O, D, stage.W, stage.H))
    stage.addLight({ ax: O.x, ay: O.y, bx: O.x + D.x * vis, by: O.y + D.y * vis, color: this.outer, intensity: alpha * (0.7 + 0.12 * tierIdx), radius: width * 4 + 70 * u })
    stage.addLight({ ax: O.x, ay: O.y, bx: O.x, by: O.y, color: this.inner, intensity: alpha * 0.9, radius: width * 3 + 80 * u })
    stage.sustain({ shake: tier.shake * 0.4 * alpha, aberr: tierIdx >= 3 ? 0.35 * alpha : 0, glitch: tier.prism ? 0.12 * alpha : 0 })

    // ビームに沿って散る火花
    this.pAcc += dt * (140 + tierIdx * 150) * alpha * (ki ? 1.3 : 1)
    while (this.pAcc >= 1) {
      this.pAcc -= 1
      const s = rand(0, Math.max(10, vis))
      const side = rand(-1, 1)
      const sp = rand(80, 480) * u
      this.ctx.particles.emit({
        x: O.x + D.x * s + N.x * side * width * 0.6,
        y: O.y + D.y * s + N.y * side * width * 0.6,
        vx: D.x * rand(200, 1000) * u + N.x * Math.sign(side) * sp,
        vy: D.y * rand(200, 1000) * u + N.y * Math.sign(side) * sp,
        life: rand(0.2, 0.55),
        size: rand(2, 4.5) * u * (1 + tierIdx * 0.15),
        color: pick([this.inner, this.outer, WHITE]),
        stretch: 0.04,
        drag: 2.5,
      })
    }

    // 波紋リング（LV2 以上 / 両手）
    if ((tierIdx >= 1 || ki) && rel > 0.3) {
      this.ringT -= dt
      if (this.ringT <= 0) {
        this.ringT = ki ? 0.09 : 0.13
        const sp = 1400 * u
        this.ctx.fx.add(
          new RingFx(this.ctx, {
            x: O.x + D.x * width * 1.5,
            y: O.y + D.y * width * 1.5,
            vx: D.x * sp,
            vy: D.y * sp,
            r0: width * 1.1,
            r1: width * 2.6,
            life: 0.5,
            width: 3.2 * u,
            squash: 0.28,
            angle: Math.atan2(D.y, D.x),
            color: this.inner,
            alpha: 0.9,
          }),
        )
      }
    }

    // ビームにまとわりつく稲妻（LV3 以上）
    if (tierIdx >= 2) {
      this.arcT -= dt
      if (this.arcT <= 0) {
        this.arcT = 0.05
        const count = tierIdx >= 3 ? 3 : 2
        for (let i = 0; i < count; i++) {
          const s0 = rand(0, Math.max(40, vis * 0.8))
          const l = rand(140, 380) * u
          const side = Math.random() < 0.5 ? -1 : 1
          const a = { x: O.x + D.x * s0 + N.x * side * width * 0.4, y: O.y + D.y * s0 + N.y * side * width * 0.4 }
          const off = side * rand(0.7, 1.8) * width
          const b = { x: O.x + D.x * (s0 + l) + N.x * off, y: O.y + D.y * (s0 + l) + N.y * off }
          spawnBolt(this.ctx, a, b, pick([this.inner, WHITE]), 2.6 * u, 0.07, width * 0.7)
        }
      }
    }
  }

  dispose() {
    this.ctx.stage.scene.remove(this.mesh)
    this.mat.dispose()
    this.muzzle.fadeOut(0.25, 1.6)
  }
}

/* =========================================================
   ビーム（カメラ＝画面のこちら側に向けて撃つ）
   ========================================================= */
export class FrontBeamFx extends Fx implements SteerableBeam {
  private age = 0
  private origin: Vec2
  private tOrigin: Vec2
  private mesh: THREE.Mesh
  private mat: THREE.ShaderMaterial
  private outer: THREE.Color
  private inner: THREE.Color
  private core: number
  private pAcc = 0

  constructor(
    private ctx: FxCtx,
    private o: BeamOpts,
  ) {
    super()
    const { tier, tierIdx, ki } = o
    const { stage } = ctx
    const u = stage.unit
    this.origin = { ...o.origin }
    this.tOrigin = { ...o.origin }
    this.outer = new THREE.Color(tier.outer)
    this.inner = new THREE.Color(tier.inner)
    this.core = tier.core * u * (ki ? 1.35 : 1)
    this.mat = fxMaterial(FRONT_FRAG, {
      uRes: { value: new THREE.Vector2(stage.W, stage.H) },
      uPad: { value: 60 },
      uC: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uR: { value: 1 },
      uAlpha: { value: 1 },
      uPrism: { value: tier.prism ? 1 : 0 },
      uSeed: { value: Math.random() * 50 },
      uOuter: { value: this.outer },
      uInner: { value: this.inner },
    })
    this.mesh = addMesh(ctx, QUAD, this.mat, 2)

    const { x, y } = this.origin
    ctx.fx.add(new RingFx(ctx, { x, y, r0: this.core, r1: Math.max(stage.W, stage.H) * 0.7, life: 0.7, color: this.inner, width: 10 * u, distort: 26 * u * (1 + tierIdx * 0.4) }))
    ctx.fx.add(new RingFx(ctx, { x, y, r0: this.core * 2, r1: Math.max(stage.W, stage.H), life: 0.9, color: this.outer, width: 16 * u, distort: 20 * u, delay: 0.08 }))
    ctx.stage.kick({
      shake: tier.shake * 1.15,
      flash: 0.12 + 0.06 * tierIdx,
      aberr: 0.6 + 0.3 * tierIdx,
      invert: tier.prism ? 1 : 0,
      glitch: tier.prism ? 1 : 0.3,
    })
  }

  get progress() {
    return this.age / this.o.duration
  }

  get info() {
    return { tierIdx: this.o.tierIdx, ki: this.o.ki, front: true, remain: Math.max(0, this.o.duration - this.age) }
  }

  steer(origin: Vec2) {
    this.tOrigin = { ...origin }
  }

  update(dt: number, t: number) {
    const { tier, tierIdx, duration } = this.o
    const { stage } = this.ctx
    const u = stage.unit
    this.age += dt
    if (this.age >= duration) {
      this.dead = true
      return
    }
    const k = follow(14, dt)
    this.origin.x += (this.tOrigin.x - this.origin.x) * k
    this.origin.y += (this.tOrigin.y - this.origin.y) * k

    const attack = 1 + 0.9 * Math.exp(-this.age * 7)
    const relStart = duration * 0.7
    const rel = this.age > relStart ? 1 - (this.age - relStart) / (duration - relStart) : 1
    const grow = Math.min(1, this.age / 0.3)
    const R = this.core * 2.4 * attack * Math.pow(rel, 0.6) * (0.4 + 0.6 * grow) * (1 + 0.06 * Math.sin(t * 40))
    const alpha = Math.min(1, rel * 1.6)

    this.mesh.position.set(stage.W / 2, stage.H / 2, 0)
    this.mesh.scale.set(stage.W + 120, stage.H + 120, 1)
    const un = this.mat.uniforms
    ;(un.uRes.value as THREE.Vector2).set(stage.W, stage.H)
    ;(un.uC.value as THREE.Vector2).set(this.origin.x, this.origin.y)
    un.uTime.value = t
    un.uR.value = R
    un.uAlpha.value = alpha

    stage.addLight({ ax: this.origin.x, ay: this.origin.y, bx: this.origin.x, by: this.origin.y, color: this.inner, intensity: 1.4 * alpha, radius: R * 5 + 200 * u })
    stage.sustain({ shake: tier.shake * 0.55 * alpha, aberr: 0.4 * alpha, glitch: tier.prism ? 0.5 * alpha : 0 })

    // こちらに向かって飛んでくる粒
    this.pAcc += dt * (220 + tierIdx * 160) * alpha
    while (this.pAcc >= 1) {
      this.pAcc -= 1
      const a = rand(0, Math.PI * 2)
      const r0 = rand(0.2, 0.9) * R
      const sp = rand(60, 220) * u
      this.ctx.particles.emit({
        x: this.origin.x + Math.cos(a) * r0,
        y: this.origin.y + Math.sin(a) * r0,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        accel: 4.2,
        life: rand(0.6, 1.1),
        size: rand(1.5, 3.5) * u,
        color: pick([this.inner, this.outer, WHITE]),
        stretch: 0.06,
        drag: 0,
        shrink: false,
      })
    }
  }

  dispose() {
    this.ctx.stage.scene.remove(this.mesh)
    this.mat.dispose()
  }
}
