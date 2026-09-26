import type { Keycode } from './keycodes'
import type {
  KeyboardDefinition, KeyId, SensorBindings, SensorId,
} from '../keyboards/types'

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

/** 実機で選べる 19mm トラックボール／スクロールパッドの色（交換パーツ、セットで揃う） */
export type TrackballColor = 'white' | 'black' | 'red' | 'blue' | 'yellow'

export const TRACKBALL_COLORS: TrackballColor[] = ['white', 'black', 'red', 'blue', 'yellow']

export const TRACKBALL_COLOR_LABEL: Record<TrackballColor, string> = {
  white: 'ホワイト',
  black: 'ブラック',
  red: 'レッド',
  blue: 'ブルー',
  yellow: 'イエロー',
}

/** ボール描画用のグラデーション色（ハイライト → 中間 → 影）。実機写真の実際の色味から採取。
    スクロールパッドの地色にも同じトーンを流用する */
export const TRACKBALL_COLOR_GRADIENT: Record<TrackballColor, [string, string, string]> = {
  white: ['#ffffff', '#f2f1ee', '#d8d7d2'],
  black: ['#8f8f90', '#3a3a3c', '#0c0c0d'],
  red: ['#8a3934', '#5c1414', '#260404'],
  blue: ['#ccd6dd', '#7f93a2', '#3d4c58'],
  yellow: ['#f2e9d2', '#d6bb6c', '#8a7137'],
}

/** その色の地の上で、文字やドットを明るい色(paper)にすべきか暗い色(ink)にすべきか */
export const TRACKBALL_COLOR_DARK: Record<TrackballColor, boolean> = {
  white: false,
  black: true,
  red: true,
  blue: false,
  yellow: false,
}

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
  /** ボールの色（交換パーツ。実機写真に合わせた見た目のみで、動作には影響しない） */
  color: TrackballColor
}

export type LayerColor =
  | 'gray' | 'pink' | 'green' | 'purple' | 'cyan' | 'lime' | 'sand' | 'orange'

export const LAYER_COLORS: readonly LayerColor[] = [
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
  /** 常に keymap.layers の添字と同じ */
  id: number
  name: string
  color: LayerColor
  /** 書いていないキーは「透過」 */
  keys: Record<KeyId, Binding>
  /** エンコーダー・スクロールパッドの割当（センサー ID → スロット → 割当）。書いていないスロットは「透過」 */
  sensors: Record<SensorId, SensorBindings>
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

/** キーボード本体（キーキャップ・スクロールパッド・エンコーダー）の色。実機の白／黒モデルに対応 */
export type BodyColor = 'white' | 'black'

export const BODY_COLOR_LABEL: Record<BodyColor, string> = {
  white: 'ホワイト',
  black: 'ブラック',
}

/**
 * esc キーキャップの色（見た目のみ）。
 * white / black は本体に付いている通常のキーキャップ、blue / green / orange は付属の交換用キーキャップ。
 */
export type EscColor = 'white' | 'black' | 'blue' | 'green' | 'orange'

export const ESC_COLORS: EscColor[] = ['white', 'black', 'blue', 'green', 'orange']

export const DEFAULT_ESC_COLOR: EscColor = 'orange'

export const ESC_COLOR_LABEL: Record<EscColor, string> = {
  white: 'ホワイト',
  black: 'ブラック',
  blue: 'ブルー',
  green: 'グリーン',
  orange: 'オレンジ',
}

/** キーキャップの地色。交換用の 3 色は実機写真の色味から採取 */
export const ESC_COLOR_FACE: Record<EscColor, string> = {
  white: 'var(--color-paper)',
  black: 'var(--color-ink)',
  blue: '#4db2e6',
  green: '#2f9479',
  orange: '#f58149',
}

/** 印字の色。実機の交換用キーキャップは色付きの地に白い印字 */
export const ESC_COLOR_TEXT: Record<EscColor, string> = {
  white: 'var(--color-ink)',
  black: 'var(--color-paper)',
  blue: 'var(--color-paper)',
  green: 'var(--color-paper)',
  orange: 'var(--color-paper)',
}

export interface KeymapSettings {
  tappingTermMs: number
  flavor: Flavor
  /** キーボード本体の色（見た目のみ）。白↔黒を切り替えると、同じ色だったボールと esc も追従する */
  bodyColor: BodyColor
  /** esc キーキャップの色（見た目のみ）。古い保存データには無いので DEFAULT_ESC_COLOR で補う */
  escColor?: EscColor
}

export interface Keymap {
  /** 2: キーボード定義を参照する形（センサーの割当が sensors にまとまった） */
  version: 2
  /** どのキーボードのキーマップか（KeyboardDefinition.id） */
  keyboard: string
  /**
   * 組み込みに無いキーボード（QMK / VIA / ZMK から取り込んだもの）の定義。
   * キーマップに同梱しておき、共有フィードで他の人が見ても盤面を描けるようにする。
   */
  keyboardDef?: KeyboardDefinition
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

/**
 * ざっくりとした形チェック。ファイル読み込みや共有フィードなど、
 * 外部から来た JSON を信用せずに取り込む前に使う。
 */
export function isValidKeymapShape(x: unknown): x is Keymap {
  if (!x || typeof x !== 'object') return false
  const km = x as Partial<Keymap>
  return (
    Array.isArray(km.layers)
    && Array.isArray(km.combos)
    && typeof km.trackball === 'object' && km.trackball !== null
    && typeof km.settings === 'object' && km.settings !== null
  )
}
