import type { Binding, LayerColor } from '../data/types.js'

/* ================================================================
   キーボード定義

   ORCA MAP は「どのキーボードを編集しているか」をこの 1 つのデータで受け取り、
   盤面の描画・手元のキーボードからの読み替え・ファームウェアへの書き出しを
   すべてここから組み立てる。関数を持たない素のデータなので、JSON のまま
   保存・共有したり、QMK / VIA / ZMK の定義ファイルから取り込んで作ったりできる。

   座標系は QMK の info.json・KLE（keyboard-layout-editor）・ZMK の physical layout と同じ。
   「1 = キー 1 個分（1u）」のユニットで、左上が原点、y は下向き。
   ================================================================ */

export type KeyId = string
export type SensorId = string

/** 分割キーボードの左右 */
export type Half = 'L' | 'R'

/** 書き出し先のファームウェア。キーコードの書き方と書き出し形式が変わる */
export type Firmware = 'zmk' | 'qmk'

export const FIRMWARE_LABEL: Record<Firmware, string> = {
  zmk: 'ZMK',
  qmk: 'QMK / VIA',
}

export interface KeyDef {
  id: KeyId
  /** 左上座標（回転前・ユニット） */
  x: number
  y: number
  w: number
  h: number
  /** 回転（度・時計回り）。中心は (rx, ry)。KLE / QMK / ZMK と同じ意味で、省略時は 0 */
  r?: number
  rx?: number
  ry?: number
  /** スイッチマトリクス上の [行, 列]。取り込み元にあれば保持しておく（VIA / Vial で実機とやり取りするときに使う） */
  matrix?: [number, number]
  half?: Half
  /** 論理上の段・列（0 始まり）。インスペクタの表記に使う */
  row?: number
  col?: number
  thumb?: boolean
  /** esc のように、付属の交換用キーキャップで色を選べるキー（見た目のみ） */
  accent?: boolean
  /** 取り込み元のキーキャップ印字 */
  legend?: string
}

/**
 * キー以外の入力。レイヤーごとに割当を持つものはスロット（回転方向・スワイプ方向）ごとに割り当てる。
 * - encoder: ロータリーエンコーダー／ホイール（右回し・左回し）
 * - pad:     スクロールパッド・タッチストリップ（上下スワイプ・タップ）
 * - ball:    トラックボール・トラックパッド。割当は持たず、キーマップ全体の設定（DPI など）だけを持つ
 */
export type SensorKind = 'encoder' | 'pad' | 'ball'

export interface SensorDef {
  id: SensorId
  kind: SensorKind
  /** 正式名（左ロータリーエンコーダー） */
  name: string
  /** HUD のログなどに出す短い名前（ENC） */
  short: string
  half?: Half
  x: number
  y: number
  w: number
  h: number
}

export type EncoderSlot = 'cw' | 'ccw'
export type PadSlot = 'up' | 'down' | 'tap'
export type SensorSlot = EncoderSlot | PadSlot

/** センサーの種類ごとのスロット（読む順：左→右、上→下） */
export const SENSOR_SLOTS: Record<SensorKind, readonly SensorSlot[]> = {
  encoder: ['ccw', 'cw'],
  pad: ['up', 'tap', 'down'],
  ball: [],
}

export const SENSOR_SLOT_LABEL: Record<SensorSlot, string> = {
  cw: '右に回す',
  ccw: '左に回す',
  up: '上スワイプ',
  down: '下スワイプ',
  tap: 'タップ',
}

export const SENSOR_SLOT_GLYPH: Record<SensorSlot, string> = {
  cw: '↻',
  ccw: '↺',
  up: '↑',
  down: '↓',
  tap: '·',
}

export const SENSOR_KIND_LABEL: Record<SensorKind, string> = {
  encoder: 'ロータリーエンコーダー',
  pad: 'スクロールパッド',
  ball: 'トラックボール',
}

export type SensorBindings = Partial<Record<SensorSlot, Binding>>

/**
 * 新しいキーマップを作るときの、レイヤー 1 枚ぶんの初期値。
 * keys を省略したレイヤーは白紙（キーもセンサーもすべて未割当）。
 * keys を書いたレイヤーでは、書いていないキー・スロットは「透過」になる。
 */
export interface LayerSeed {
  name: string
  color: LayerColor
  keys?: Record<KeyId, Binding>
  sensors?: Record<SensorId, SensorBindings>
}

export interface KeyboardDefinition {
  /** 保存データや共有フィードから参照する一意な ID。取り込んだ定義は `custom:` で始まる */
  id: string
  name: string
  maker?: string
  firmware: Firmware
  /**
   * 物理キー。**配列の順番 = ファームウェア上のキーの順番**
   * （QMK の LAYOUT マクロの引数順・ZMK の bindings / key-positions の順）。
   */
  keys: KeyDef[]
  sensors?: SensorDef[]
  /** 新しく作るキーマップのレイヤー数。defaultLayers より多ければ白紙のレイヤーで埋める */
  layerCount?: number
  /** 工場出荷時のキーマップ。省略したレイヤーは白紙 */
  defaultLayers?: LayerSeed[]
  defaultKeymapName?: string
  /**
   * 手元のキーボードの `KeyboardEvent.code` → このキーボードの KeyId。
   * 書いていないキーは、ベースレイヤー（L0）の割当から自動で対応づける。
   */
  capture?: Record<string, KeyId>
  /** QMK の keymap.c に書き出すときの LAYOUT マクロ名（省略時は LAYOUT） */
  qmkLayout?: string
  /** 共有フィードから X に投稿するときに添えるハッシュタグ（# は付けない） */
  hashtag?: string
  /** USB の VID / PID（16 進文字列）。取り込み元にあれば保持しておく（実機の判別用） */
  usb?: { vid: string; pid: string }
  /** 取り込んで作った定義なら、その元の形式 */
  source?: 'qmk' | 'via' | 'kle' | 'zmk'
}

export function isCustomKeyboardId(id: string): boolean {
  return id.startsWith('custom:')
}
