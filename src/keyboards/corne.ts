import { bind, NONE, TRANS, type Binding } from '../data/types.js'
import type { KeyboardDefinition, KeyDef, KeyId } from './types.js'

/* ================================================================
   Corne（crkbd）6 列 + 親指 3 キー × 左右 = 42 キー

   座標は ZMK の physical layout（app/dts/layouts/foostan/corne/6column.dtsi）を
   1u 単位に直したもの。内側の親指キーは実物どおり回転している。
   初期キーマップは ZMK 同梱の corne.keymap（Default / Lower / Raise）。
   ================================================================ */

/** 各列の縦オフセット（左手。右手は左右反転） */
const STAGGER = [0.37, 0.37, 0.12, 0, 0.12, 0.24]

function gridRow(row: number): KeyDef[] {
  const left = STAGGER.map((dy, col) => ({
    id: `L${row}${col}`, half: 'L' as const, row, col, x: col, y: row + dy, w: 1, h: 1,
  }))
  const right = [...STAGGER].reverse().map((dy, col) => ({
    id: `R${row}${col}`, half: 'R' as const, row, col, x: 8 + col, y: row + dy, w: 1, h: 1,
  }))
  return [...left, ...right]
}

const THUMBS: KeyDef[] = [
  { id: 'LT0', half: 'L', row: 3, col: 0, thumb: true, x: 3.5, y: 3.12, w: 1, h: 1 },
  { id: 'LT1', half: 'L', row: 3, col: 1, thumb: true, x: 4.5, y: 3.12, w: 1, h: 1, r: 12, rx: 4.5, ry: 4.12 },
  { id: 'LT2', half: 'L', row: 3, col: 2, thumb: true, x: 5.48, y: 2.83, w: 1, h: 1.5, r: 24, rx: 5.48, ry: 4.33 },
  { id: 'RT0', half: 'R', row: 3, col: 0, thumb: true, x: 7.52, y: 2.83, w: 1, h: 1.5, r: -24, rx: 8.52, ry: 4.33 },
  { id: 'RT1', half: 'R', row: 3, col: 1, thumb: true, x: 8.5, y: 3.12, w: 1, h: 1, r: -12, rx: 9.5, ry: 4.12 },
  { id: 'RT2', half: 'R', row: 3, col: 2, thumb: true, x: 9.5, y: 3.12, w: 1, h: 1 },
]

const KEYS: KeyDef[] = [...gridRow(0), ...gridRow(1), ...gridRow(2), ...THUMBS]

/** キー順（KEYS の順番）に並べた割当を、KeyId → 割当 の表にする */
function byOrder(bindings: Binding[]): Record<KeyId, Binding> {
  return Object.fromEntries(KEYS.map((k, i) => [k.id, bindings[i] ?? TRANS]))
}

const b = (...codes: string[]) => codes.map((c) => (c === '_' ? TRANS : c === 'x' ? NONE : bind(c)))

const BASE = byOrder([
  ...b('TAB', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'BSPC'),
  ...b('LCTRL', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'SEMI', 'SQT'),
  ...b('LSHFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'COMMA', 'DOT', 'FSLH', 'ESC'),
  ...b('LGUI', 'FN_1', 'SPACE', 'ENTER', 'FN_2', 'RALT'),
])

const LOWER = byOrder([
  ...b('TAB', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N0', 'BSPC'),
  ...b('BT_CLR', 'BT_SEL_0', 'BT_SEL_1', 'BT_SEL_2', 'BT_SEL_3', 'BT_SEL_4', 'LEFT', 'DOWN', 'UP', 'RIGHT', '_', '_'),
  ...b('LSHFT', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_', '_'),
  ...b('LGUI', '_', 'SPACE', 'ENTER', '_', 'RALT'),
])

const RAISE = byOrder([
  ...b('TAB', 'EXCL', 'AT', 'HASH', 'DLLR', 'PRCNT', 'CARET', 'AMPS', 'STAR', 'LPAR', 'RPAR', 'BSPC'),
  ...b('LCTRL', '_', '_', '_', '_', '_', 'MINUS', 'EQUAL', 'LBKT', 'RBKT', 'BSLH', 'GRAVE'),
  ...b('LSHFT', '_', '_', '_', '_', '_', 'UNDER', 'PLUS', 'LBRC', 'RBRC', 'PIPE', 'TILDE'),
  ...b('LGUI', '_', 'SPACE', 'ENTER', '_', 'RALT'),
])

export const CORNE: KeyboardDefinition = {
  id: 'foostan-corne-6col',
  name: 'Corne（6 列）',
  maker: 'foostan',
  firmware: 'zmk',
  hashtag: 'crkbd',
  keys: KEYS,
  layerCount: 4,
  defaultLayers: [
    { name: 'BASE', color: 'gray', keys: BASE },
    { name: 'LOWER', color: 'pink', keys: LOWER },
    { name: 'RAISE', color: 'green', keys: RAISE },
    { name: 'ADJUST', color: 'purple' },
  ],
  defaultKeymapName: 'Corne 標準',
  // 文字キーはベースレイヤーの割当から自動で対応づく。親指のレイヤーキーだけ手元のキーに当てる
  capture: {
    AltLeft: 'LT1', NonConvert: 'LT1', Lang2: 'LT1',
    AltRight: 'RT1', Convert: 'RT1', Lang1: 'RT1',
    ControlRight: 'RT2',
  },
}
