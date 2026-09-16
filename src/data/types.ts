import type { Keycode } from './keycodes'
import type { KeyId } from './layout'

/** ホールドタップの解決方針（ZMK の flavor に対応） */
export type Flavor = 'hold-preferred' | 'balanced' | 'tap-preferred'

export const FLAVOR_LABEL: Record<Flavor, string> = {
  'hold-preferred': '長押し優先',
  balanced: 'バランス',
  'tap-preferred': '単押し優先',
}

export const FLAVOR_HELP: Record<Flavor, string> = {
  'hold-preferred': 'タッピングタームを超えた時点で即・長押し。修飾キー向き。',
  balanced: 'ターム内でも他のキーを押して離したら長押しと判定。ホームロー修飾向き。',
  'tap-preferred': 'ターム内に離せば必ず単押し。誤爆を避けたいとき向き。',
}

/**
 * すべての割当がこの 1 つの型に集約される。
 * hold を設定した時点でそのキーは MOD-TAP / LAYER-TAP になる。
 */
export interface Binding {
  tap: Keycode
  hold?: Keycode
  /** 未設定なら keymap.settings.tappingTermMs を使う */
  tappingTermMs?: number
  flavor?: Flavor
}

export type PadSlot = 'up' | 'down' | 'tap'
export type EncoderSlot = 'cw' | 'ccw'

export const PAD_SLOTS: PadSlot[] = ['up', 'down', 'tap']
export const ENCODER_SLOTS: EncoderSlot[] = ['cw', 'ccw']

export const PAD_SLOT_LABEL: Record<PadSlot, string> = {
  up: '上スワイプ',
  down: '下スワイプ',
  tap: 'タップ',
}
export const PAD_SLOT_GLYPH: Record<PadSlot, string> = {
  up: '↑', down: '↓', tap: '·',
}

export const ENCODER_SLOT_LABEL: Record<EncoderSlot, string> = {
  cw: '右回し（時計回り）',
  ccw: '左回し（反時計回り）',
}
export const ENCODER_SLOT_GLYPH: Record<EncoderSlot, string> = {
  cw: '↻', ccw: '↺',
}

export type PadConfig = Record<PadSlot, Binding>
export type EncoderConfig = Record<EncoderSlot, Binding>

/** トラックボールはデバイス設定なのでレイヤーではなくキーマップ全体で 1 つ持つ */
export interface TrackballConfig {
  dpi: number
  /** 取り付け角度の補正（度） */
  angle: number
  invertX: boolean
  invertY: boolean
  /** 精密モード時に DPI に掛ける倍率 */
  snipeRatio: number
  /** スクロールモード時の 1 ノッチあたりの移動量 */
  scrollDivisor: number
}

export type LayerColor =
  | 'gray' | 'pink' | 'green' | 'purple' | 'cyan' | 'lime' | 'sand' | 'orange'

export const LAYER_COLORS: LayerColor[] = [
  'gray', 'pink', 'green', 'purple', 'cyan', 'lime', 'sand', 'orange',
]

export const LAYER_COLOR_HEX: Record<LayerColor, string> = {
  gray: '#9ca3af',
  pink: '#ff3d71',
  green: '#22c55e',
  purple: '#7b5cff',
  cyan: '#38bdf8',
  lime: '#a8e10c',
  sand: '#f6ce7c',
  orange: '#fb923c',
}

export interface Layer {
  id: number
  name: string
  color: LayerColor
  keys: Record<KeyId, Binding>
  encoder: EncoderConfig
  padL: PadConfig
  padR: PadConfig
}

export interface Combo {
  id: string
  name: string
  keys: KeyId[]
  binding: Binding
  timeoutMs: number
  /** このコンボが有効なレイヤー */
  layers: number[]
  enabled: boolean
}

export interface KeymapSettings {
  tappingTermMs: number
  flavor: Flavor
}

export interface Keymap {
  version: 1
  name: string
  layers: Layer[]
  combos: Combo[]
  trackball: TrackballConfig
  settings: KeymapSettings
}

/* ---------------------------------------------------------------- helpers */

export function bind(tap: Keycode, hold?: Keycode, extra?: Partial<Binding>): Binding {
  return { tap, ...(hold ? { hold } : {}), ...extra }
}

export const TRANS: Binding = { tap: 'TRANS' }
export const NONE: Binding = { tap: 'NONE' }

export function isTrans(b: Binding | undefined): boolean {
  return !b || b.tap === 'TRANS'
}

export function isModTap(b: Binding | undefined): boolean {
  return !!b?.hold && b.hold !== 'TRANS' && b.hold !== 'NONE'
}
