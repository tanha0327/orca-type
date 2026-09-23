import { GestureRecognizer } from '@mediapipe/tasks-vision'
import { ALIGN_DEG, MIN_CHARGE, PRE_INNER, TIERS, tierIndexFor } from '../config'
import type { Game, Slot } from '../game/Game'
import type { Vec2 } from '../math'

const FONT = '10px "Share Tech Mono", ui-monospace, monospace'
const FONT_B = '12px "Share Tech Mono", ui-monospace, monospace'
const GAUGE_MAX = TIERS[TIERS.length - 1].min
const HAND_LINKS = GestureRecognizer.HAND_CONNECTIONS

function tierCss(charge: number) {
  const i = tierIndexFor(charge)
  if (i < 0) return PRE_INNER
  return TIERS[i].prism ? '#ffffff' : TIERS[i].inner
}

/**
 * くっきりした線で描く照準・骨格・ゲージ。
 * ブルームのかからない 2D キャンバスに描いて、HUD と同じ白黒の質感にそろえる。
 */
export class Overlay {
  private ctx: CanvasRenderingContext2D
  private W = 1
  private H = 1
  private taps: { x: number; y: number; t: number }[] = []

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
  }

  resize(W: number, H: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.W = W
    this.H = H
    this.canvas.width = Math.round(W * dpr)
    this.canvas.height = Math.round(H * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  addTap(p: Vec2, now: number) {
    this.taps.push({ x: p.x, y: p.y, t: now })
  }

  draw(game: Game, now: number) {
    const c = this.ctx
    c.clearRect(0, 0, this.W, this.H)
    c.lineCap = 'square'

    // 腕（肩→肘→手首）
    if (game.mode === 'camera') {
      c.lineWidth = 1.5
      for (const a of game.arms) {
        if (a.vis < 0.5) continue
        c.strokeStyle = 'rgba(255,255,255,0.32)'
        c.beginPath()
        c.moveTo(a.shoulder.x, a.shoulder.y)
        c.lineTo(a.elbow.x, a.elbow.y)
        c.lineTo(a.wrist.x, a.wrist.y)
        c.stroke()
        c.fillStyle = 'rgba(255,255,255,0.7)'
        c.fillRect(a.elbow.x - 3, a.elbow.y - 3, 6, 6)
        c.strokeRect(a.shoulder.x - 4, a.shoulder.y - 4, 8, 8)
      }
    }

    for (const s of game.slots) if (s.present && s.obs) this.drawHand(s, now)
    if (game.vslot.charging || game.mode === 'demo') this.drawEmitter(game.vslot, game.pointer, now)
    if (game.ki.active) this.drawKi(game, now)

    // タップ地点
    this.taps = this.taps.filter((t) => now - t.t < 450)
    for (const t of this.taps) {
      const k = (now - t.t) / 450
      const r = 10 + k * 34
      c.strokeStyle = `rgba(255,255,255,${1 - k})`
      c.lineWidth = 1
      c.strokeRect(t.x - r, t.y - r, r * 2, r * 2)
      c.beginPath()
      c.moveTo(t.x - r - 8, t.y)
      c.lineTo(t.x - r + 6, t.y)
      c.moveTo(t.x + r - 6, t.y)
      c.lineTo(t.x + r + 8, t.y)
      c.moveTo(t.x, t.y - r - 8)
      c.lineTo(t.x, t.y - r + 6)
      c.moveTo(t.x, t.y + r - 6)
      c.lineTo(t.x, t.y + r + 8)
      c.stroke()
    }
  }

  private drawHand(s: Slot, now: number) {
    const c = this.ctx
    const o = s.obs!
    const pts = o.pts

    // 骨格
    c.strokeStyle = 'rgba(255,255,255,0.5)'
    c.lineWidth = 1
    c.beginPath()
    for (const { start, end } of HAND_LINKS) {
      c.moveTo(pts[start].x, pts[start].y)
      c.lineTo(pts[end].x, pts[end].y)
    }
    c.stroke()
    c.fillStyle = '#fff'
    for (let i = 0; i < pts.length; i++) {
      const r = i % 4 === 0 && i > 0 ? 2.5 : 1.5
      c.fillRect(pts[i].x - r, pts[i].y - r, r * 2, r * 2)
    }

    // 照準の四隅
    const { x, y } = s.pos
    const R = s.size * 0.95
    const L = R * 0.32
    c.strokeStyle = '#fff'
    c.lineWidth = 1.5
    c.beginPath()
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      c.moveTo(x + sx * R, y + sy * (R - L))
      c.lineTo(x + sx * R, y + sy * R)
      c.lineTo(x + sx * (R - L), y + sy * R)
    }
    c.stroke()

    // ラベル
    const g = s.stable === 'fist' ? 'FIST' : s.stable === 'open' ? 'OPEN' : s.stable === 'other' ? '----' : '....'
    this.tag(`HAND_${s.name} [${o.label}]`, x - R, y - R - 6, false)
    this.tag(g, x - R, y + R + 15, s.stable === 'fist')

    // 溜めゲージ
    if (s.charging) this.gauge(x, y, R * 1.25, s.charge, now)

    // 腕の向き
    if (o.mode === 'front') {
      c.strokeStyle = 'rgba(255,255,255,0.9)'
      c.lineWidth = 1
      for (const r of [R * 0.45, R * 0.7]) {
        c.beginPath()
        c.arc(x, y, r, 0, Math.PI * 2)
        c.stroke()
      }
      this.tag('AIM:FRONT', x + R + 6, y - R + 10, false)
    } else {
      const d = s.dir
      const a0 = R * 1.05
      const a1 = R * 2.6
      c.save()
      c.setLineDash([6, 5])
      c.strokeStyle = 'rgba(255,255,255,0.85)'
      c.lineWidth = 1.5
      c.beginPath()
      c.moveTo(x + d.x * a0, y + d.y * a0)
      c.lineTo(x + d.x * a1, y + d.y * a1)
      c.stroke()
      c.restore()
      this.arrow(x + d.x * a1, y + d.y * a1, d)
      const deg = ((Math.atan2(-d.y, d.x) * 180) / Math.PI + 360) % 360
      this.tag(`θ${deg.toFixed(0).padStart(3, '0')}° ${o.mode.toUpperCase()}`, x + d.x * (a1 + 14) - 20, y + d.y * (a1 + 14) + 4, false)
    }
  }

  private drawEmitter(v: Slot, pointer: Vec2, now: number) {
    const c = this.ctx
    const { x, y } = v.pos
    c.strokeStyle = 'rgba(255,255,255,0.6)'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(x - 26, y)
    c.lineTo(x - 10, y)
    c.moveTo(x + 10, y)
    c.lineTo(x + 26, y)
    c.moveTo(x, y + 10)
    c.lineTo(x, y + 26)
    c.stroke()
    c.strokeRect(x - 5, y - 5, 10, 10)
    if (v.charging) {
      this.gauge(x, y, 46, v.charge, now)
      c.save()
      c.setLineDash([3, 6])
      c.strokeStyle = 'rgba(255,255,255,0.4)'
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(pointer.x, pointer.y)
      c.stroke()
      c.restore()
    }
    this.tag('EMITTER // SPACE', x + 30, y + 4, false)
  }

  private drawKi(game: Game, now: number) {
    const c = this.ctx
    const ki = game.ki
    const [a, b] = game.slots
    const { x, y } = ki.pos
    const R = ((a.size + b.size) / 2) * 1.6
    // 回転する目盛り
    c.strokeStyle = 'rgba(255,255,255,0.75)'
    c.lineWidth = 1
    const rot = now * 0.0012
    c.beginPath()
    for (let i = 0; i < 24; i++) {
      const t = rot + (i / 24) * Math.PI * 2
      const r0 = i % 6 === 0 ? R - 10 : R - 4
      c.moveTo(x + Math.cos(t) * r0, y + Math.sin(t) * r0)
      c.lineTo(x + Math.cos(t) * R, y + Math.sin(t) * R)
    }
    c.stroke()
    this.gauge(x, y, R + 10, ki.charge, now)
    this.tag(`KI_FIELD // 気 ${ki.charge.toFixed(1)}s`, x - R, y - R - 10, true)

    const ready = ki.charge >= MIN_CHARGE
    let label: string
    if (ki.delta === null) label = 'ALIGN: ---'
    else if (ki.front) label = 'ALIGN: FRONT'
    else label = `Δθ ${ki.delta.toFixed(0).padStart(2, '0')}° / <${ALIGN_DEG}°`
    this.tag(label, x - R, y + R + 18, ki.aligned && ready)
    if (!ready) this.tag('CHARGING…', x - R, y + R + 34, false)
    else this.tag(ki.aligned ? 'RELEASE' : 'READY — 腕を揃えろ', x - R, y + R + 34, ki.aligned)
  }

  /** 最終段階を満タンとした環状ゲージ。段階の境目に目盛り */
  private gauge(x: number, y: number, r: number, charge: number, now: number) {
    const c = this.ctx
    const start = -Math.PI / 2
    c.lineWidth = 3
    c.strokeStyle = 'rgba(255,255,255,0.14)'
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.stroke()
    const k = Math.min(1, charge / GAUGE_MAX)
    const col = tierCss(charge)
    c.strokeStyle = col
    c.beginPath()
    c.arc(x, y, r, start, start + k * Math.PI * 2)
    c.stroke()
    c.lineWidth = 1.5
    c.strokeStyle = '#fff'
    c.beginPath()
    for (const t of TIERS) {
      const a = start + (t.min / GAUGE_MAX) * Math.PI * 2
      c.moveTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6))
      c.lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6))
    }
    c.stroke()
    const blink = charge >= MIN_CHARGE && Math.floor(now / 160) % 2 === 0
    c.font = FONT_B
    c.fillStyle = blink ? col : '#fff'
    c.fillText(`${charge.toFixed(2)}s`, x + r + 10, y + 4)
  }

  private arrow(x: number, y: number, d: Vec2) {
    const c = this.ctx
    const n = { x: -d.y, y: d.x }
    c.fillStyle = '#fff'
    c.beginPath()
    c.moveTo(x + d.x * 10, y + d.y * 10)
    c.lineTo(x + n.x * 5, y + n.y * 5)
    c.lineTo(x - n.x * 5, y - n.y * 5)
    c.closePath()
    c.fill()
  }

  private tag(text: string, x: number, y: number, invert: boolean) {
    const c = this.ctx
    c.font = FONT
    if (invert) {
      const w = c.measureText(text).width
      c.fillStyle = '#fff'
      c.fillRect(x - 3, y - 10, w + 6, 13)
      c.fillStyle = '#000'
    } else c.fillStyle = 'rgba(255,255,255,0.92)'
    c.fillText(text, x, y)
  }
}
