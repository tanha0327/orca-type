import { getKeycode, type Keycode } from '../data/keycodes'
import type { KeyId, SensorId } from '../data/layout'
import type {
  Binding, Combo, EncoderSlot, Flavor, Keymap, PadSlot,
} from '../data/types'
import {
  activeCombos, combinationLabel, computeLayerStack, effectiveFlavor, effectiveTerm,
  glyphOf, layerActionOf, modSymbolOf, nameOf, resolveKey, resolveSensor,
  type SensorSlot,
} from './resolve'

export type OutputKind = 'tap' | 'hold' | 'combo' | 'encoder' | 'pad' | 'layer'

export const OUTPUT_KIND_LABEL: Record<OutputKind, string> = {
  tap: '単押し',
  hold: '長押し',
  combo: 'コンボ',
  encoder: 'エンコーダー',
  pad: 'スワイプ',
  layer: 'レイヤー',
}

export interface OutputEvent {
  id: number
  at: number
  kind: OutputKind
  keycode: Keycode
  /** 出力の短い表記 */
  glyph: string
  /** 出力の正式名 */
  name: string
  /** 何を操作した結果か（"F" / "D + F" / "ENC ↻" / "PAD L ↑"） */
  source: string
  /** どのレイヤーで解決されたか */
  layerId: number
  /** 同時に押されていた修飾 */
  mods: string[]
  /** HUD 用の完成形。"⇧ + A" */
  combination: string
}

export type PressState = 'combo-wait' | 'init' | 'pending' | 'tap' | 'hold' | 'consumed'

export interface PressView {
  keyId: KeyId
  state: PressState
  downAt: number
  termMs: number
  tapGlyph: string
  holdGlyph?: string
  layerId: number
  /** 長押し判定待ちかどうか（HUD の進行バーを出す条件） */
  awaitingHold: boolean
}

export interface ComboFlash {
  id: string
  name: string
  keys: KeyId[]
  glyph: string
  at: number
}

export interface EngineSnapshot {
  stack: number[]
  activeLayer: number
  presses: PressView[]
  mods: string[]
  last?: OutputEvent
  log: OutputEvent[]
  combo?: ComboFlash
  toggled: number[]
  /** 押されている物理キー（盤面のハイライト用） */
  down: KeyId[]
}

interface Press {
  keyId: KeyId
  binding: Binding
  layerId: number
  downAt: number
  termMs: number
  flavor: Flavor
  state: PressState
  timers: number[]
  activatedLayer?: number
  modSymbol?: string
}

const LOG_MAX = 24

export class KeyEngine {
  private keymap: Keymap
  private listeners = new Set<() => void>()
  private cached?: EngineSnapshot

  private pressed = new Map<KeyId, Press>()
  private momentary: number[] = []
  private toggled: number[] = []
  private log: OutputEvent[] = []
  private last?: OutputEvent
  private combo?: ComboFlash
  private seq = 0

  constructor(keymap: Keymap) {
    this.keymap = keymap
  }

  /** ストアの内容が変わったら差し替える */
  setKeymap(keymap: Keymap) {
    this.keymap = keymap
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  /** useSyncExternalStore 用。publish のたびに作り直した同一参照を返す */
  getSnapshot = (): EngineSnapshot => {
    if (!this.cached) this.cached = this.computeSnapshot()
    return this.cached
  }

  /* ------------------------------------------------------------ 公開 API */

  keyDown(keyId: KeyId) {
    if (this.pressed.has(keyId)) return // OS のオートリピート
    const now = performance.now()
    const stack = this.stack()
    const { binding, layerId } = resolveKey(this.keymap, stack, keyId)

    const press: Press = {
      keyId,
      binding,
      layerId,
      downAt: now,
      termMs: effectiveTerm(binding, this.keymap),
      flavor: effectiveFlavor(binding, this.keymap),
      state: 'init',
      timers: [],
    }
    this.pressed.set(keyId, press)

    // 長押し優先のキーは、別のキーが押された時点で長押しに倒す
    for (const other of this.pressed.values()) {
      if (other !== press && other.state === 'pending' && other.flavor === 'hold-preferred') {
        this.resolveHold(other)
      }
    }

    const candidates = activeCombos(this.keymap, stack).filter((c) => c.keys.includes(keyId))
    if (candidates.length > 0) {
      press.state = 'combo-wait'
      const window = Math.max(...candidates.map((c) => c.timeoutMs))
      this.schedule(press, window, () => {
        this.beginNormal(press)
        this.publish()
      })
      if (this.tryCombos(candidates, now)) {
        this.publish()
        return
      }
    } else {
      this.beginNormal(press)
    }

    this.publish()
  }

  keyUp(keyId: KeyId) {
    const press = this.pressed.get(keyId)
    if (!press) return

    // バランス型のキーは、別のキーが押されて離された時点で長押しに倒す
    for (const other of this.pressed.values()) {
      if (other !== press && other.state === 'pending' && other.flavor === 'balanced' && other.downAt < press.downAt) {
        this.resolveHold(other)
      }
    }

    this.clearTimers(press)

    if (press.state === 'combo-wait' || press.state === 'init') {
      // コンボが成立しないまま離された → 通常のキーとして扱う
      this.beginNormal(press)
    }
    if (press.state === 'pending') {
      // タッピングターム内に離した → 単押し
      this.fireTap(press)
    }

    this.releaseEffects(press)
    this.pressed.delete(keyId)
    this.publish()
  }

  /** ロータリーエンコーダーの回転 */
  encoder(slot: EncoderSlot) {
    this.fireSensor('enc-l', slot, 'encoder')
  }

  /** スクロールパッドのスワイプ・タップ */
  pad(sensor: Extract<SensorId, 'pad-l' | 'pad-r'>, slot: PadSlot) {
    this.fireSensor(sensor, slot, 'pad')
  }

  /** 盤面クリックなどで単発に発火させたいとき */
  pulse(keyId: KeyId) {
    this.keyDown(keyId)
    window.setTimeout(() => this.keyUp(keyId), 90)
  }

  reset() {
    for (const p of this.pressed.values()) this.clearTimers(p)
    this.pressed.clear()
    this.momentary = []
    this.toggled = []
    this.log = []
    this.last = undefined
    this.combo = undefined
    this.publish()
  }

  clearLog() {
    this.log = []
    this.last = undefined
    this.combo = undefined
    this.publish()
  }

  /* ------------------------------------------------------------ 内部処理 */

  private stack(): number[] {
    return computeLayerStack(this.toggled, this.momentary)
  }

  private schedule(press: Press, delayMs: number, fn: () => void) {
    const id = window.setTimeout(() => {
      press.timers = press.timers.filter((t) => t !== id)
      fn()
    }, Math.max(0, delayMs))
    press.timers.push(id)
  }

  private clearTimers(press: Press) {
    for (const t of press.timers) window.clearTimeout(t)
    press.timers = []
  }

  /** combo-wait / init から、通常のキー処理へ進む */
  private beginNormal(press: Press) {
    if (press.state !== 'combo-wait' && press.state !== 'init') return
    this.clearTimers(press)

    const hasHold = !!press.binding.hold && press.binding.hold !== 'NONE' && press.binding.hold !== 'TRANS'
    if (hasHold) {
      press.state = 'pending'
      const remaining = press.downAt + press.termMs - performance.now()
      if (remaining <= 0) {
        this.resolveHold(press)
      } else {
        this.schedule(press, remaining, () => {
          this.resolveHold(press)
          this.publish()
        })
      }
    } else {
      this.fireTap(press)
    }
  }

  private fireTap(press: Press) {
    if (press.state === 'tap' || press.state === 'hold' || press.state === 'consumed') return
    press.state = 'tap'
    this.applyBehavior(press, press.binding.tap, 'tap')
  }

  private resolveHold(press: Press) {
    if (press.state !== 'pending') return
    this.clearTimers(press)
    press.state = 'hold'
    this.applyBehavior(press, press.binding.hold!, 'hold')
  }

  /** レイヤー操作・修飾の保持・出力イベントの発行をまとめて行う */
  private applyBehavior(press: Press, code: Keycode, kind: 'tap' | 'hold') {
    const la = layerActionOf(code)
    if (la) {
      if (la.action === 'MO') {
        this.momentary.push(la.target)
        press.activatedLayer = la.target
      } else if (la.action === 'TG') {
        this.toggled = this.toggled.includes(la.target)
          ? this.toggled.filter((n) => n !== la.target)
          : [...this.toggled, la.target]
      } else {
        this.toggled = la.target === 0 ? [] : [la.target]
      }
      this.emitOutput('layer', code, this.sourceOfKey(press.keyId), press.layerId)
      return
    }

    const mod = modSymbolOf(code)
    if (mod) press.modSymbol = mod

    this.emitOutput(kind, code, this.sourceOfKey(press.keyId), press.layerId)
  }

  private releaseEffects(press: Press) {
    if (press.activatedLayer !== undefined) {
      const at = this.momentary.lastIndexOf(press.activatedLayer)
      if (at >= 0) this.momentary.splice(at, 1)
      press.activatedLayer = undefined
    }
    press.modSymbol = undefined
  }

  private tryCombos(candidates: Combo[], now: number): boolean {
    for (const combo of candidates) {
      const presses = combo.keys.map((k) => this.pressed.get(k))
      if (presses.some((p) => !p)) continue
      const usable = presses as Press[]
      if (usable.some((p) => p.state === 'tap' || p.state === 'hold' || p.state === 'consumed')) continue
      const earliest = Math.min(...usable.map((p) => p.downAt))
      if (now - earliest > combo.timeoutMs) continue

      for (const p of usable) {
        this.clearTimers(p)
        p.state = 'consumed'
      }
      const label = combo.keys.map((k) => this.keyGlyph(k)).join(' + ')
      this.combo = {
        id: combo.id,
        name: combo.name,
        keys: [...combo.keys],
        glyph: glyphOf(combo.binding.tap),
        at: now,
      }
      this.emitOutput('combo', combo.binding.tap, label, usable[0].layerId)
      return true
    }
    return false
  }

  private fireSensor(sensor: SensorId, slot: SensorSlot, kind: 'encoder' | 'pad') {
    const stack = this.stack()
    const { binding, layerId } = resolveSensor(this.keymap, stack, sensor, slot)
    if (binding.tap === 'NONE') return

    const la = layerActionOf(binding.tap)
    if (la) {
      if (la.action === 'TG') {
        this.toggled = this.toggled.includes(la.target)
          ? this.toggled.filter((n) => n !== la.target)
          : [...this.toggled, la.target]
      } else if (la.action === 'TO') {
        this.toggled = la.target === 0 ? [] : [la.target]
      }
    }
    this.emitOutput(kind, binding.tap, this.sourceOfSensor(sensor, slot), layerId)
    this.publish()
  }

  private emitOutput(kind: OutputKind, code: Keycode, source: string, layerId: number) {
    const kc = getKeycode(code)
    if (kc.code === 'NONE') return

    const mods = this.currentMods()
    const glyph = glyphOf(code)
    const ev: OutputEvent = {
      id: ++this.seq,
      at: performance.now(),
      kind,
      keycode: code,
      glyph,
      name: nameOf(code),
      source,
      layerId,
      mods,
      // 修飾キーそのものの出力に「⇧ + ⇧」とは出さない
      combination: kc.modSymbol ? glyph : combinationLabel(mods, glyph),
    }
    this.last = ev
    this.log = [ev, ...this.log].slice(0, LOG_MAX)
  }

  private currentMods(): string[] {
    const out: string[] = []
    for (const p of this.pressed.values()) {
      if (p.modSymbol && !out.includes(p.modSymbol)) out.push(p.modSymbol)
    }
    return out
  }

  private keyGlyph(keyId: KeyId): string {
    const { binding } = resolveKey(this.keymap, this.stack(), keyId)
    return glyphOf(binding.tap) || keyId
  }

  private sourceOfKey(keyId: KeyId): string {
    return this.keyGlyph(keyId)
  }

  private sourceOfSensor(sensor: SensorId, slot: SensorSlot): string {
    const head = sensor === 'enc-l' ? 'ENC' : sensor === 'pad-l' ? 'PAD L' : 'PAD R'
    const glyphs: Record<string, string> = {
      cw: '↻', ccw: '↺', up: '↑', down: '↓', tap: '·',
    }
    return `${head} ${glyphs[slot] ?? slot}`
  }

  /* ------------------------------------------------------------ 出力 */

  private computeSnapshot(): EngineSnapshot {
    const stack = this.stack()
    const presses: PressView[] = [...this.pressed.values()].map((p) => ({
      keyId: p.keyId,
      state: p.state,
      downAt: p.downAt,
      termMs: p.termMs,
      tapGlyph: glyphOf(p.binding.tap),
      holdGlyph: p.binding.hold ? glyphOf(p.binding.hold) : undefined,
      layerId: p.layerId,
      awaitingHold: p.state === 'pending' || p.state === 'combo-wait',
    }))
    return {
      stack,
      activeLayer: stack[stack.length - 1] ?? 0,
      presses,
      mods: this.currentMods(),
      last: this.last,
      log: this.log,
      combo: this.combo,
      toggled: [...this.toggled],
      down: [...this.pressed.keys()],
    }
  }

  private publish() {
    this.cached = this.computeSnapshot()
    for (const fn of this.listeners) fn()
  }
}
