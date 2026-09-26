import { KEYCODES, type Keycode } from '../../data/keycodes.js'
import { NONE, TRANS, type Binding, type LayerColor } from '../../data/types.js'
import { keyCenter } from '../geometry.js'
import {
  SENSOR_SLOTS,
  type KeyboardDefinition, type KeyDef, type KeyId, type LayerSeed, type SensorBindings, type SensorDef,
} from '../types.js'

/* ================================================================
   組み込みキーボードを短く書くための小道具

   キーの座標とキーマップを、公開されている QMK / ZMK / KLE の定義から写しやすい形で書く。
   - keys:  [x, y, 幅, 高さ, 回転, 回転の中心 x, 回転の中心 y]（幅・高さは省略で 1、回転は省略で 0）
            並びはファームウェアのキー順（QMK の LAYOUT の引数順 / ZMK の bindings の順）
   - キーマップ: キーの順に空白で区切った割当。
            _ は透過、x は未割当、TAP@HOLD は長押しつき（例: A@LSHFT、SPACE@FN_1）
   ================================================================ */

/** [x, y, 幅, 高さ, 回転, 回転の中心 x, 回転の中心 y] */
export type KeyTuple = readonly [number, number, number?, number?, number?, number?, number?]

export interface PresetLayer {
  name: string
  color: LayerColor
  /** キーの順に空白で区切った割当。省略すると白紙のレイヤー */
  keys?: string
  /** センサー ID → スロットの順（エンコーダーなら 左回し 右回し）に空白で区切った割当 */
  sensors?: Record<string, string>
}

export interface PresetSpec extends Omit<KeyboardDefinition, 'keys' | 'defaultLayers' | 'capture'> {
  /** 分割キーボードなら、左右を分ける x。キーの中心がこれより左なら左手 */
  splitAt?: number
  keys: readonly KeyTuple[]
  /** 親指キーの番号（keys の添字） */
  thumbs?: readonly number[]
  layers: readonly PresetLayer[]
  /** 手元のキーボードの event.code → キーの番号（keys の添字）。書いていないキーは L0 の割当から自動で対応づく */
  capture?: Record<string, number>
}

const KNOWN = new Set<Keycode>(KEYCODES.map((k) => k.code))

function code(token: string, where: string): Keycode {
  if (!KNOWN.has(token)) throw new Error(`${where}: 知らないキーコード ${token}`)
  return token
}

function parseBinding(token: string, where: string): Binding {
  if (token === '_') return TRANS
  if (token === 'x') return NONE
  const [tap, hold] = token.split('@')
  return hold ? { tap: code(tap, where), hold: code(hold, where) } : { tap: code(tap, where) }
}

function tokens(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

export function preset(spec: PresetSpec): KeyboardDefinition {
  const { splitAt, keys: tuples, thumbs = [], layers, capture, ...rest } = spec
  const thumbSet = new Set(thumbs)

  // 見た目の段は「（回転を反映した）キーの中心が左に戻ったら次の段」。列は段の中で左右それぞれ左から数える
  let row = -1
  let prevX = Infinity
  const colCount = { L: 0, R: 0, '': 0 }
  const keys: KeyDef[] = tuples.map(([x, y, w = 1, h = 1, r = 0, rx = 0, ry = 0], i) => {
    const shape: KeyDef = { id: `k${i}`, x, y, w, h, ...(r ? { r, rx, ry } : {}) }
    const [cx] = keyCenter(shape)
    if (cx < prevX - 0.01) {
      row++
      colCount.L = 0
      colCount.R = 0
      colCount[''] = 0
    }
    prevX = cx
    const half = splitAt === undefined ? undefined : cx < splitAt ? 'L' as const : 'R' as const
    return {
      ...shape,
      ...(half ? { half } : {}),
      row,
      col: colCount[half ?? '']++,
      ...(thumbSet.has(i) ? { thumb: true } : {}),
    }
  })

  const defaultLayers: LayerSeed[] = layers.map((layer, n) => {
    const where = `${spec.name} L${n} ${layer.name}`
    if (layer.keys === undefined) return { name: layer.name, color: layer.color }
    const list = tokens(layer.keys)
    if (list.length !== keys.length) {
      throw new Error(`${where}: 割当が ${list.length} 個あります（キーは ${keys.length} 個）`)
    }
    const bindings: Record<KeyId, Binding> = Object.fromEntries(
      keys.map((k, i) => [k.id, parseBinding(list[i], where)]),
    )
    const sensors: Record<string, SensorBindings> = {}
    for (const [id, text] of Object.entries(layer.sensors ?? {})) {
      const sensor = spec.sensors?.find((s: SensorDef) => s.id === id)
      if (!sensor) throw new Error(`${where}: 知らないセンサー ${id}`)
      const slots = SENSOR_SLOTS[sensor.kind]
      const list = tokens(text)
      if (list.length !== slots.length) throw new Error(`${where}: ${id} の割当の数が違います`)
      sensors[id] = Object.fromEntries(slots.map((slot, i) => [slot, parseBinding(list[i], where)]))
    }
    return { name: layer.name, color: layer.color, keys: bindings, sensors }
  })

  return {
    ...rest,
    keys,
    defaultLayers,
    ...(capture ? { capture: Object.fromEntries(Object.entries(capture).map(([c, i]) => [c, `k${i}`])) } : {}),
  }
}
