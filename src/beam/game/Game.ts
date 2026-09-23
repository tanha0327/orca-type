import * as THREE from 'three'
import {
  ALIGN_DEG,
  KI_FAR,
  KI_NEAR,
  KI_RATE,
  LOST_MS,
  MAX_CHARGE,
  MIN_CHARGE,
  PRE_INNER,
  PRE_OUTER,
  SKILLS,
  TIERS,
  tierIndexFor,
} from '../config'
import { type Vec2, angleBetween, clamp, dist, follow, lerp, norm, rand, turnToward, pick } from '../math'
import type { Gesture, HandObs, PoseArm, TrackFrame } from '../tracking/hand'
import { BeamFx, FrontBeamFx, type FxCtx, OrbFx, RingFx, type SteerableBeam, burst, spawnBolt } from '../fx/effects'
import { NovaFx, ProjectileFx, SlashFx, ThunderFx, crossPaths, smoothPath } from '../fx/skills'
import type { Sfx } from '../audio/Sfx'
import type { Hud } from '../ui/Hud'

export interface Slot {
  id: number
  name: string
  virtual: boolean
  present: boolean
  lastSeen: number
  obs: HandObs | null
  /** 平滑化した手のひら中心（粒子の吸い寄せ先として参照を共有するので差し替えない） */
  pos: Vec2
  dir: Vec2
  size: number
  raw: Gesture | null
  rawCount: number
  otherSince: number
  stable: Gesture | null
  charging: boolean
  charge: number
  tierIdx: number
  orb: OrbFx | null
  beam: SteerableBeam | null
  inflow: number
  arcT: number
}

export interface KiState {
  active: boolean
  charge: number
  tierIdx: number
  pos: Vec2
  orb: OrbFx | null
  beam: SteerableBeam | null
  nearT: number
  apartT: number
  lostT: number
  alignT: number
  cool: number
  inflow: number
  arcT: number
  linkT: number
  /** 両腕の向きの差（度）。測れないときは null */
  delta: number | null
  aligned: boolean
  front: boolean
}

export interface GameCtx extends FxCtx {
  sfx: Sfx
  hud: Hud
}

const WHITE = new THREE.Color(1, 1, 1)

function makeSlot(id: number, name: string, virtual = false): Slot {
  return {
    id,
    name,
    virtual,
    present: false,
    lastSeen: 0,
    obs: null,
    pos: { x: 0, y: 0 },
    dir: { x: 0, y: -1 },
    size: 80,
    raw: null,
    rawCount: 0,
    otherSince: 0,
    stable: null,
    charging: false,
    charge: 0,
    tierIdx: -1,
    orb: null,
    beam: null,
    inflow: 0,
    arcT: 0,
  }
}

const tierColors = TIERS.map((t) => ({ outer: new THREE.Color(t.outer), inner: new THREE.Color(t.inner) }))
const preColors = { outer: new THREE.Color(PRE_OUTER), inner: new THREE.Color(PRE_INNER) }

/** 溜め量に応じた色。次の段階が近づくと少しずつ次の色に寄せる */
export function chargeColors(charge: number, outer: THREE.Color, inner: THREE.Color) {
  const i = tierIndexFor(charge)
  if (i < 0) {
    const k = clamp((charge - MIN_CHARGE * 0.6) / (MIN_CHARGE * 0.4), 0, 1)
    outer.copy(preColors.outer).lerp(tierColors[0].outer, k * 0.5)
    inner.copy(preColors.inner).lerp(tierColors[0].inner, k * 0.5)
    return
  }
  outer.copy(tierColors[i].outer)
  inner.copy(tierColors[i].inner)
  const next = TIERS[i + 1]
  if (next) {
    const k = clamp((charge - (next.min - 0.8)) / 0.8, 0, 1)
    outer.lerp(tierColors[i + 1].outer, k * 0.6)
    inner.lerp(tierColors[i + 1].inner, k * 0.6)
  }
}

export type Mode = 'boot' | 'camera' | 'demo'

export class Game {
  readonly slots: Slot[] = [makeSlot(0, 'A'), makeSlot(1, 'B')]
  /** キーボード / デモ用の仮想の手（画面下中央の発射台） */
  readonly vslot: Slot = makeSlot(2, 'V', true)
  readonly ki: KiState = {
    active: false,
    charge: 0,
    tierIdx: -1,
    pos: { x: 0, y: 0 },
    orb: null,
    beam: null,
    nearT: 0,
    apartT: 0,
    lostT: 0,
    alignT: 0,
    cool: 0,
    inflow: 0,
    arcT: 0,
    linkT: 0,
    delta: null,
    aligned: false,
    front: false,
  }
  arms: PoseArm[] = []
  pointer: Vec2 = { x: 0, y: 0 }
  skill = 0
  mode: Mode = 'boot'
  private now = 0

  constructor(private ctx: GameCtx) {}

  /* =========================================================
     入力
     ========================================================= */

  onFrame(frame: TrackFrame, now: number) {
    this.arms = frame.arms
    const hands = frame.hands.slice(0, 2)
    const [a, b] = this.slots
    const cost = (s: Slot, h: HandObs) => (s.present ? dist(s.pos, h.palm) : 4000)
    const assign: [Slot, HandObs][] = []
    if (hands.length === 1) {
      const h = hands[0]
      assign.push([cost(a, h) <= cost(b, h) ? a : b, h])
    } else if (hands.length === 2) {
      const [h0, h1] = hands
      if (cost(a, h0) + cost(b, h1) <= cost(a, h1) + cost(b, h0)) assign.push([a, h0], [b, h1])
      else assign.push([a, h1], [b, h0])
    }
    for (const [s, h] of assign) this.observe(s, h, now)
  }

  private observe(s: Slot, h: HandObs, now: number) {
    if (!s.present) {
      s.pos.x = h.palm.x
      s.pos.y = h.palm.y
      s.dir = { ...h.dir }
      s.size = h.size
      s.raw = null
      s.rawCount = 0
      s.stable = null
    }
    s.present = true
    s.lastSeen = now
    s.obs = h
    if (h.gesture === s.raw) s.rawCount++
    else {
      s.raw = h.gesture
      s.rawCount = 1
    }
    if (s.raw === 'fist' || s.raw === 'open') {
      s.otherSince = 0
      if (s.rawCount >= 2) this.setStable(s, s.raw)
    } else {
      if (!s.otherSince) s.otherSince = now
      if (now - s.otherSince > 900) this.setStable(s, 'other')
    }
  }

  private setStable(s: Slot, g: Gesture) {
    if (s.stable === g) return
    s.stable = g
    if (g === 'fist') {
      if (!this.ki.active && !this.ki.beam && !s.beam && !s.charging) this.startCharge(s)
    } else if (g === 'open') {
      if (s.charging) this.release(s)
    } else if (s.charging) {
      this.cancel(s, 'GESTURE LOST')
    }
  }

  /** キーボードの SPACE：押して溜め、離して発射 */
  keyCharge(down: boolean) {
    const v = this.vslot
    if (down) {
      if (!v.charging && !v.beam) this.startCharge(v)
    } else if (v.charging) this.release(v)
  }

  setSkill(i: number) {
    this.skill = (i + SKILLS.length) % SKILLS.length
    this.ctx.hud.setSkill(this.skill)
  }

  /** タップ技 */
  tap(p: Vec2) {
    const { ctx } = this
    const u = ctx.stage.unit
    const sk = SKILLS[this.skill]
    switch (sk.id) {
      case 'bullet': {
        const from = this.nearestHand(p) ?? this.emitterPos()
        ctx.fx.add(new ProjectileFx(ctx, from, p, sk.color, () => ctx.sfx.impact(0.7)))
        ctx.sfx.shoot()
        break
      }
      case 'thunder':
        ctx.fx.add(new ThunderFx(ctx, p, sk.color))
        ctx.sfx.thunder()
        break
      case 'nova':
        ctx.fx.add(new NovaFx(ctx, p, sk.color))
        ctx.sfx.nova()
        break
      case 'slash':
        ctx.fx.add(new SlashFx(ctx, crossPaths(p, 150 * u), sk.color))
        ctx.sfx.slash()
        break
    }
    ctx.hud.log(`SKILL ${sk.no} ${sk.en} // ${sk.jp}`)
  }

  /** 斬撃：なぞった軌跡 */
  slashPath(path: Vec2[]) {
    const sk = SKILLS.find((s) => s.id === 'slash')!
    const pts = smoothPath(path, 14)
    if (pts.length < 3) return
    this.ctx.fx.add(new SlashFx(this.ctx, [pts], sk.color))
    this.ctx.sfx.slash()
    this.ctx.hud.log(`SKILL ${sk.no} ${sk.en} // なぞり斬り`)
  }

  private nearestHand(p: Vec2): Vec2 | null {
    let best: Slot | null = null
    for (const s of this.slots) if (s.present && (!best || dist(s.pos, p) < dist(best.pos, p))) best = s
    return best ? { ...best.pos } : null
  }

  private emitterPos(): Vec2 {
    const { W, H } = this.ctx.stage
    return { x: W / 2, y: H * 0.78 }
  }

  /* =========================================================
     毎フレーム
     ========================================================= */

  update(dt: number, now: number) {
    this.now = now
    for (const s of this.slots) {
      if (s.present && now - s.lastSeen > LOST_MS) {
        s.present = false
        s.obs = null
        s.stable = null
        s.raw = null
        if (s.charging) this.cancel(s, 'SIGNAL LOST')
      }
      if (s.present && s.obs) {
        const k = follow(22, dt)
        s.pos.x += (s.obs.palm.x - s.pos.x) * k
        s.pos.y += (s.obs.palm.y - s.pos.y) * k
        s.size = lerp(s.size, s.obs.size, k)
        s.dir = turnToward(s.dir, s.obs.dir, follow(12, dt))
      }
    }
    this.updateVirtual()
    this.updateKi(dt)
    for (const s of this.slots) this.updateCharge(s, dt)
    this.updateCharge(this.vslot, dt)
    this.updateBeams()
    this.updateHud()
  }

  private updateVirtual() {
    const v = this.vslot
    const e = this.emitterPos()
    v.present = true
    v.pos.x = e.x
    v.pos.y = e.y
    v.size = 80 * this.ctx.stage.unit
    const d = { x: this.pointer.x - e.x, y: this.pointer.y - e.y }
    v.dir = Math.hypot(d.x, d.y) > 20 ? norm(d) : { x: 0, y: -1 }
  }

  /* ---------- 片手：グーで溜めてパーで撃つ ---------- */

  private startCharge(s: Slot) {
    s.charging = true
    s.charge = 0
    s.tierIdx = -1
    s.inflow = 0
    s.arcT = 0
    const orb = this.ctx.fx.add(new OrbFx(this.ctx))
    orb.x = s.pos.x
    orb.y = s.pos.y
    orb.r = 4
    s.orb = orb
    this.ctx.sfx.chargeStart(`s${s.id}`)
  }

  private stopCharge(s: Slot) {
    s.charging = false
    s.charge = 0
    s.tierIdx = -1
    s.orb?.fadeOut(0.18, 1.5)
    s.orb = null
    this.ctx.sfx.chargeStop(`s${s.id}`)
  }

  private updateCharge(s: Slot, dt: number) {
    if (!s.charging || !s.orb) return
    s.charge = Math.min(MAX_CHARGE, s.charge + dt)
    this.chargeVisual(s.orb, s.pos, s.size, s.charge, dt, s, false)
    this.ctx.sfx.chargeSet(`s${s.id}`, s.charge)
    const ti = tierIndexFor(s.charge)
    if (ti > s.tierIdx) {
      s.tierIdx = ti
      this.tierUp(s.pos, s.orb.r, ti, false)
    }
  }

  private release(s: Slot) {
    const charge = s.charge
    const pos = { ...s.pos }
    this.stopCharge(s)
    if (charge < MIN_CHARGE) {
      this.fizzle(pos, charge)
      return
    }
    const front = !s.virtual && s.obs?.mode === 'front'
    s.beam = this.fire(tierIndexFor(charge), charge, this.muzzle(s, front), s.dir, front, false)
  }

  private cancel(s: Slot, reason: string) {
    const pos = { ...s.pos }
    const charge = s.charge
    this.stopCharge(s)
    this.fizzle(pos, charge, reason)
  }

  private muzzle(s: Slot, front: boolean): Vec2 {
    if (front) return { ...s.pos }
    const off = s.virtual ? 0 : s.size * 0.55
    return { x: s.pos.x + s.dir.x * off, y: s.pos.y + s.dir.y * off }
  }

  /** 溜め中の玉・吸い込まれる粒・まとわりつく稲妻 */
  private chargeVisual(orb: OrbFx, pos: Vec2, size: number, charge: number, dt: number, st: { inflow: number; arcT: number }, big: boolean) {
    const { ctx } = this
    const u = ctx.stage.unit
    const r = (size * 0.24 + 6 * u) * (1 + charge * 0.085) * (big ? 1.35 : 1)
    chargeColors(charge, orb.outer, orb.inner)
    const ti = tierIndexFor(charge)
    orb.x = pos.x
    orb.y = pos.y
    orb.r = r * (1 + 0.05 * Math.sin(this.now * 0.02))
    orb.intensity = ti < 0 ? 0.45 + 0.55 * (charge / MIN_CHARGE) : 1.1 + ti * 0.1
    orb.unstable = ti >= 4 ? 1 : ti >= 2 ? 0.45 : 0
    orb.prism = ti >= 4
    orb.rays = ti >= 3 ? 0.5 : 0

    st.inflow += dt * (22 + charge * 16) * (big ? 1.5 : 1)
    while (st.inflow >= 1) {
      st.inflow -= 1
      const a = rand(0, Math.PI * 2)
      const d = r * rand(2.4, 4.6)
      const tan = rand(60, 200) * u
      const inw = rand(60, 170) * u
      ctx.particles.emit({
        x: pos.x + Math.cos(a) * d,
        y: pos.y + Math.sin(a) * d,
        vx: -Math.sin(a) * tan - Math.cos(a) * inw,
        vy: Math.cos(a) * tan - Math.sin(a) * inw,
        attract: pos,
        attractK: 40,
        drag: 2.6,
        life: 0.6,
        size: rand(1.5, 3.2) * u,
        color: Math.random() < 0.4 ? WHITE : orb.inner,
        stretch: 0.05,
        shrink: false,
      })
    }

    if (ti >= 2) {
      st.arcT -= dt
      if (st.arcT <= 0) {
        st.arcT = rand(0.05, 0.14)
        const a = rand(0, Math.PI * 2)
        const from = { x: pos.x + Math.cos(a) * r * 0.5, y: pos.y + Math.sin(a) * r * 0.5 }
        const l = r * rand(1.8, 3)
        const b = a + rand(-0.5, 0.5)
        spawnBolt(ctx, from, { x: pos.x + Math.cos(b) * l, y: pos.y + Math.sin(b) * l }, orb.inner, 2 * u, 0.07, r * 0.4)
      }
    }
  }

  private tierUp(pos: Vec2, r: number, ti: number, ki: boolean) {
    const { ctx } = this
    const u = ctx.stage.unit
    const c = tierColors[ti]
    ctx.fx.add(new RingFx(ctx, { x: pos.x, y: pos.y, r0: r, r1: r * 4 + 40 * u, life: 0.45, color: c.inner, width: 3 * u, distort: 6 * u }))
    burst(ctx, pos.x, pos.y, 22 + ti * 6, [c.inner, c.outer, WHITE], { speed: [200, 600], life: [0.2, 0.45], size: [1.5, 3.5] })
    ctx.stage.kick({ shake: 0.08 + ti * 0.03, aberr: 0.25 })
    ctx.sfx.tierUp(ti)
    const t = TIERS[ti]
    ctx.hud.log(`LV${t.lv} REACHED // ${ki ? t.kiJp : t.jp}`)
    ctx.hud.pulseTier(ti)
  }

  private fizzle(pos: Vec2, charge: number, reason?: string) {
    const { ctx } = this
    if (charge < 0.25) return
    const u = ctx.stage.unit
    ctx.fx.add(new RingFx(ctx, { x: pos.x, y: pos.y, r0: 10 * u, r1: 70 * u, life: 0.35, color: preColors.inner, width: 2 * u, alpha: 0.6 }))
    burst(ctx, pos.x, pos.y, 18, [preColors.inner, preColors.outer], { speed: [80, 300], life: [0.2, 0.5], size: [1.5, 3] })
    ctx.sfx.fizzle()
    if (reason) ctx.hud.log(`${reason} // CHARGE ${charge.toFixed(1)}s LOST`)
    else ctx.hud.log(`CHARGE INSUFFICIENT // ${charge.toFixed(1)}s < ${MIN_CHARGE.toFixed(1)}s`)
    ctx.hud.flashHint(reason ? '溜めが途切れた' : `${MIN_CHARGE}秒以上溜めてから手を開く`)
  }

  private fire(ti: number, charge: number, origin: Vec2, dir: Vec2, front: boolean, ki: boolean): SteerableBeam {
    const { ctx } = this
    const tier = TIERS[ti]
    const nextMin = TIERS[ti + 1]?.min ?? MAX_CHARGE
    const extra = clamp((charge - tier.min) / (nextMin - tier.min), 0, 1)
    const duration = tier.duration * (1 + extra * 0.3) * (ki ? 1.15 : 1)
    const opts = { tier, tierIdx: ti, ki, duration, origin, dir }
    const beam = ctx.fx.add(front ? new FrontBeamFx(ctx, opts) : new BeamFx(ctx, opts))
    ctx.sfx.fire(ti, duration, ki)
    ctx.hud.banner(ti, ki, front)
    const name = ki ? `${tier.kiEn} // ${tier.kiJp}` : `${tier.en} // ${tier.jp}`
    ctx.hud.log(`FIRE LV${tier.lv} ${name} ${front ? '[FRONT] ' : ''}${duration.toFixed(1)}s`)
    return beam
  }

  /* ---------- 両手：近づけて気を溜め、腕を揃えて撃つ ---------- */

  private updateKi(dt: number) {
    const [a, b] = this.slots
    const ki = this.ki
    const both = a.present && b.present && !!a.obs && !!b.obs
    if (ki.cool > 0) ki.cool -= dt
    if (!ki.active) {
      ki.delta = null
      ki.aligned = false
      if (both && !a.beam && !b.beam && !ki.beam && ki.cool <= 0) {
        const s = (a.size + b.size) / 2
        if (dist(a.pos, b.pos) < s * KI_NEAR) {
          ki.nearT += dt
          if (ki.nearT > 0.25) this.startKi()
        } else ki.nearT = 0
      } else ki.nearT = 0
      return
    }

    if (!both) {
      ki.lostT += dt
      if (ki.lostT > 0.7) this.endKi('SIGNAL LOST')
      return
    }
    ki.lostT = 0
    ki.pos.x = (a.pos.x + b.pos.x) / 2
    ki.pos.y = (a.pos.y + b.pos.y) / 2
    const s = (a.size + b.size) / 2
    if (dist(a.pos, b.pos) > s * KI_FAR) {
      ki.apartT += dt
      if (ki.apartT > 0.6) {
        this.endKi('KI DISPERSED')
        return
      }
    } else ki.apartT = 0

    ki.charge = Math.min(MAX_CHARGE, ki.charge + dt * KI_RATE)
    if (ki.orb) this.chargeVisual(ki.orb, ki.pos, s, ki.charge, dt, ki, true)
    this.ctx.sfx.chargeSet('ki', ki.charge)
    const ti = tierIndexFor(ki.charge)
    if (ti > ki.tierIdx) {
      ki.tierIdx = ti
      this.tierUp(ki.pos, ki.orb?.r ?? 30, ti, true)
    }

    // 気と両手をつなぐ稲妻
    ki.linkT -= dt
    if (ki.linkT <= 0 && ki.orb) {
      ki.linkT = 0.07
      const u = this.ctx.stage.unit
      for (const h of [a, b]) spawnBolt(this.ctx, ki.pos, h.pos, pick([ki.orb.inner, WHITE]), 1.8 * u, 0.08, 18 * u)
    }

    // 両腕の向き
    const fa = a.obs!.mode === 'front'
    const fb = b.obs!.mode === 'front'
    ki.front = fa && fb
    if (fa && fb) ki.delta = 0
    else if (!fa && !fb) ki.delta = (angleBetween(a.dir, b.dir) * 180) / Math.PI
    else ki.delta = null
    ki.aligned = ki.delta !== null && ki.delta < ALIGN_DEG
    if (ki.aligned && ki.charge >= MIN_CHARGE) {
      ki.alignT += dt
      if (ki.alignT >= 0.12) this.fireKi()
    } else ki.alignT = 0
  }

  private startKi() {
    const [a, b] = this.slots
    const ki = this.ki
    // 片手で溜めていた分は気に吸収する
    ki.charge = Math.max(a.charge, b.charge)
    for (const s of [a, b]) if (s.charging) this.stopCharge(s)
    ki.active = true
    ki.tierIdx = tierIndexFor(ki.charge)
    ki.pos.x = (a.pos.x + b.pos.x) / 2
    ki.pos.y = (a.pos.y + b.pos.y) / 2
    ki.nearT = ki.apartT = ki.lostT = ki.alignT = 0
    ki.inflow = ki.arcT = ki.linkT = 0
    const orb = this.ctx.fx.add(new OrbFx(this.ctx))
    orb.x = ki.pos.x
    orb.y = ki.pos.y
    orb.r = 6
    ki.orb = orb
    const u = this.ctx.stage.unit
    this.ctx.fx.add(new RingFx(this.ctx, { x: ki.pos.x, y: ki.pos.y, r0: 10 * u, r1: 120 * u, life: 0.5, color: preColors.inner, width: 3 * u, distort: 8 * u }))
    this.ctx.sfx.chargeStart('ki')
    this.ctx.hud.log('KI FIELD GENERATED // 気 発生')
  }

  private stopKi() {
    const ki = this.ki
    ki.active = false
    ki.orb?.fadeOut(0.2, 1.6)
    ki.orb = null
    ki.delta = null
    ki.aligned = false
    ki.nearT = 0
    this.ctx.sfx.chargeStop('ki')
  }

  private endKi(reason: string) {
    const pos = { ...this.ki.pos }
    const charge = this.ki.charge
    this.stopKi()
    this.ki.charge = 0
    this.ki.cool = 0.6
    this.fizzle(pos, charge, reason)
  }

  private fireKi() {
    const [a, b] = this.slots
    const ki = this.ki
    const charge = ki.charge
    const front = ki.front
    const dir = norm({ x: a.dir.x + b.dir.x, y: a.dir.y + b.dir.y })
    const s = (a.size + b.size) / 2
    const origin = front ? { ...ki.pos } : { x: ki.pos.x + dir.x * s * 0.4, y: ki.pos.y + dir.y * s * 0.4 }
    this.stopKi()
    ki.charge = 0
    ki.beam = this.fire(tierIndexFor(charge), charge, origin, dir, front, true)
  }

  /* ---------- 照射中は腕の動きに追従 ---------- */

  private updateBeams() {
    for (const s of [...this.slots, this.vslot]) {
      if (!s.beam) continue
      if (s.beam.dead) {
        s.beam = null
        continue
      }
      if (s.present) s.beam.steer(this.muzzle(s, s.beam instanceof FrontBeamFx), s.dir)
    }
    const ki = this.ki
    if (ki.beam) {
      if (ki.beam.dead) {
        ki.beam = null
        ki.cool = 1.2
      } else {
        const [a, b] = this.slots
        if (a.present && b.present) {
          const dir = norm({ x: a.dir.x + b.dir.x, y: a.dir.y + b.dir.y })
          const mid = { x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2 }
          const s = (a.size + b.size) / 2
          const front = ki.beam instanceof FrontBeamFx
          ki.beam.steer(front ? mid : { x: mid.x + dir.x * s * 0.4, y: mid.y + dir.y * s * 0.4 }, dir)
        }
      }
    }
  }

  /* ---------- HUD ---------- */

  private updateHud() {
    const { hud } = this.ctx
    const [a, b] = this.slots
    const ki = this.ki

    let primary: { charge: number; ki: boolean } | null = null
    if (ki.active) primary = { charge: ki.charge, ki: true }
    else {
      for (const s of [a, b, this.vslot]) if (s.charging && (!primary || s.charge > primary.charge)) primary = { charge: s.charge, ki: false }
    }
    const firing = [a, b, this.vslot].find((s) => s.beam)?.beam ?? ki.beam
    hud.setCharge(primary, firing ? { progress: firing.progress, ...firing.info } : null)

    let hint: string
    if (this.mode === 'boot') hint = ''
    else if (ki.active) {
      if (ki.charge < MIN_CHARGE) hint = '両手の間に気を溜めています…'
      else if (ki.delta === null) hint = '両腕を同じ向きに伸ばして発射'
      else hint = ki.aligned ? '発射！' : `両腕の向きを揃えて発射  Δθ ${ki.delta.toFixed(0)}° → ${ALIGN_DEG}° 以内`
    } else if (primary) {
      hint = primary.charge < MIN_CHARGE ? `溜め中… あと ${(MIN_CHARGE - primary.charge).toFixed(1)}s` : '手を開いて発射！（溜めるほど強くなる）'
    } else if (firing) hint = '照射中 — 腕を動かすとビームも動く'
    else if (this.mode === 'camera') {
      if (!a.present && !b.present) hint = 'カメラに手をかざしてください'
      else if (a.present && b.present) hint = 'グーで溜める / 両手を近づけて気を溜める'
      else hint = 'グーを握って溜める（3秒以上）'
    } else hint = 'SPACE 長押しで溜め → 離して発射 / 画面タップで技'
    hud.setHint(hint)

    const stat = (s: Slot) => {
      if (!s.present || !s.obs) return '-- NO SIGNAL'
      const g = s.stable === 'fist' ? 'FIST' : s.stable === 'open' ? 'OPEN' : s.stable === 'other' ? 'OTHER' : '....'
      return `${g} [${s.obs.label}] ${s.obs.mode.toUpperCase()}`
    }
    hud.setStatus({
      a: stat(a),
      b: stat(b),
      pose: this.mode !== 'camera' ? '-- OFFLINE' : this.arms.length ? `LOCK ×${this.arms.filter((x) => x.vis > 0.5).length}` : '-- SEARCHING',
      ki: ki.active ? `ACTIVE ${ki.charge.toFixed(1)}s` : ki.beam ? 'RELEASE' : '-- IDLE',
    })
  }
}
