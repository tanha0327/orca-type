import { bind, type Binding } from '../data/types.js'
import type { KeyboardDefinition, KeyDef, KeyId } from './types.js'

/* ================================================================
   60% ANSI（一体型・ロウスタッガー）

   座標は QMK のコミュニティレイアウト LAYOUT_60_ansi（layouts/default/60_ansi/info.json）。
   初期キーマップも QMK の default_60_ansi と同じ。
   ================================================================ */

/** 段ごとのキー幅（u）。左から順に並べる */
const ROW_WIDTHS: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
]

const KEYS: KeyDef[] = ROW_WIDTHS.flatMap((widths, row) => {
  let x = 0
  return widths.map((w, col) => {
    const key: KeyDef = { id: `r${row}c${col}`, row, col, x, y: row, w, h: 1 }
    x += w
    return key
  })
})

const BASE_CODES: string[][] = [
  ['GRAVE', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N0', 'MINUS', 'EQUAL', 'BSPC'],
  ['TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'LBKT', 'RBKT', 'BSLH'],
  ['CAPS', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'SEMI', 'SQT', 'ENTER'],
  ['LSHFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'COMMA', 'DOT', 'FSLH', 'RSHFT'],
  ['LCTRL', 'LGUI', 'LALT', 'SPACE', 'RALT', 'RGUI', 'K_APP', 'RCTRL'],
]

const BASE: Record<KeyId, Binding> = Object.fromEntries(
  BASE_CODES.flatMap((codes, row) => codes.map((c, col) => [`r${row}c${col}`, bind(c)])),
)

export const ANSI_60: KeyboardDefinition = {
  id: 'qmk-60-ansi',
  name: '60% ANSI',
  firmware: 'qmk',
  qmkLayout: 'LAYOUT_60_ansi',
  keys: KEYS,
  layerCount: 4,
  defaultLayers: [{ name: 'BASE', color: 'gray', keys: BASE }],
  defaultKeymapName: '60% ANSI 標準',
}
