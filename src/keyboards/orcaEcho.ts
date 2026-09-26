import {
  bind, NONE, TRANS,
  type Binding,
} from '../data/types'
import type {
  Half, KeyboardDefinition, KeyDef, KeyId, LayerSeed, SensorBindings, SensorDef,
} from './types'

/* ================================================================
   Keychron Orca echo

   実機写真から起こした 49 キー（左 25 / 右 24）のカラムスタッガー配列。
     左: 7 列 × 4 行 + 親指キー 1 + ロータリーエンコーダー + スクロールパッド
     右: 7 列 × 4 行 + 19mm トラックボール + スクロールパッド
   右手は左手の 7.5u 右に置く（左右の間に 0.5u のすき間）。
   ================================================================ */

const RIGHT_OFFSET = 7.5

/** 列ごとの縦オフセット（指の長さに合わせたカラムスタッガー） */
const STAGGER_L = [0.36, 0.22, 0.05, 0, 0.12, 0.3, 0.46]
const STAGGER_R = [0.46, 0.3, 0.12, 0, 0.05, 0.22, 0.36]

/** 各行に存在する列（写真どおり）*/
const ROWS_L: number[][] = [
  [0, 1, 2, 3, 4, 5], // esc Q W E R T
  [0, 1, 2, 3, 4, 5], // tab A S D F G
  [0, 1, 2, 3, 4, 5, 6], // shift Z X C V B fn2
  [0, 1, 2, 3, 4], // ctrl _ opt cmd fn1
]
const ROWS_R: number[][] = [
  [1, 2, 3, 4, 5, 6], // Y U I O P -
  [1, 2, 3, 4, 5, 6], // H J K L ; enter
  [0, 1, 2, 3, 4, 5, 6], // B N M , . ( )
  [2, 3, 4, 5, 6], // 無線 bspc M1 M2 M3
]

function rowKeys(half: Half, row: number): KeyDef[] {
  const cols = (half === 'L' ? ROWS_L : ROWS_R)[row]
  const stagger = half === 'L' ? STAGGER_L : STAGGER_R
  const dx = half === 'L' ? 0 : RIGHT_OFFSET
  return cols.map((col) => ({
    id: `${half}${row}${col}`,
    half,
    row,
    col,
    x: col + dx,
    y: stagger[col] + row,
    w: 1,
    h: 1,
    ...(half === 'L' && row === 0 && col === 0 ? { accent: true } : {}), // esc は色を選べる
  }))
}

/** 左の親指キー（写真では fn1 の右下に張り出した大きめのキー） */
const LEFT_THUMB: KeyDef = {
  id: 'LT0', half: 'L', row: 4, col: 5, thumb: true,
  x: 4.62, y: 4.18, w: 1.15, h: 1,
}

/** 書き出しの順番に合わせて、段ごとに 左 → 右 と並べ、最後に親指キー */
const KEYS: KeyDef[] = [
  ...[0, 1, 2, 3].flatMap((row) => [...rowKeys('L', row), ...rowKeys('R', row)]),
  LEFT_THUMB,
]

const SENSORS: SensorDef[] = [
  {
    id: 'pad-l', half: 'L', kind: 'pad',
    name: '左スクロールパッド', short: 'PAD L',
    x: 6, y: 0.46, w: 1, h: 1.9,
  },
  {
    // 実機のホイールは横向きに埋まっていて、左右に転がして回す（見た目は気持ち縦長の正方形）
    id: 'enc-l', half: 'L', kind: 'encoder',
    name: '左ロータリーエンコーダー', short: 'ENC',
    x: 5.9, y: 4.36, w: 0.68, h: 0.78,
  },
  {
    id: 'pad-r', half: 'R', kind: 'pad',
    name: '右スクロールパッド', short: 'PAD R',
    x: RIGHT_OFFSET, y: 0.46, w: 1, h: 1.9,
  },
  {
    id: 'ball-r', half: 'R', kind: 'ball',
    name: '19mm トラックボール', short: 'BALL',
    x: RIGHT_OFFSET + 0.75, y: 4.02, w: 1.35, h: 1.35,
  },
]

/**
 * 手元の一般的なキーボードの `event.code` → Orca echo の KeyId 対応表。
 * シミュレーターはこれを通して「Orca echo だったらどう出力されるか」を解決する。
 */
const CAPTURE: Record<string, KeyId> = {
  // ---- 左 row0: esc Q W E R T
  Escape: 'L00', KeyQ: 'L01', KeyW: 'L02', KeyE: 'L03', KeyR: 'L04', KeyT: 'L05',
  // ---- 左 row1: tab A S D F G
  Tab: 'L10', KeyA: 'L11', KeyS: 'L12', KeyD: 'L13', KeyF: 'L14', KeyG: 'L15',
  // ---- 左 row2: shift Z X C V B fn2
  ShiftLeft: 'L20', KeyZ: 'L21', KeyX: 'L22', KeyC: 'L23', KeyV: 'L24', KeyB: 'L25',
  Backquote: 'L26', // fn2
  // ---- 左 row3: ctrl _ opt cmd fn1
  ControlLeft: 'L30', CapsLock: 'L31', AltLeft: 'L32', MetaLeft: 'L33',
  Space: 'LT0',
  // fn1 は物理キーボードに無いので、右 Alt / 変換キーを当てる
  AltRight: 'L34', NonConvert: 'L34', Lang2: 'L34',

  // ---- 右 row0: Y U I O P -
  KeyY: 'R01', KeyU: 'R02', KeyI: 'R03', KeyO: 'R04', KeyP: 'R05', Minus: 'R06',
  // ---- 右 row1: H J K L ; enter
  KeyH: 'R11', KeyJ: 'R12', KeyK: 'R13', KeyL: 'R14', Semicolon: 'R15', Enter: 'R16',
  // ---- 右 row2: B N M , . ( )
  BracketLeft: 'R20', KeyN: 'R21', KeyM: 'R22', Comma: 'R23', Period: 'R24',
  Slash: 'R25', Quote: 'R26',
  // ---- 右 row3: 無線 bspc M1 M2 M3
  ShiftRight: 'R32', Backspace: 'R33',
  Digit1: 'R34', Digit2: 'R35', Digit3: 'R36',
}

/* ================================================================
   初期キーマップ
   L0〜L2 は実機写真のキーキャップ印字（白 / 赤 / 緑）をそのまま再現。
   L3 以降は白紙（すべて未割当）。
   ================================================================ */

type KeyMapPatch = Record<KeyId, Binding>

const pad = (up: Binding, down: Binding, tap: Binding = TRANS): SensorBindings => ({ up, down, tap })
const enc = (cw: Binding, ccw: Binding): SensorBindings => ({ cw, ccw })

/* ------------------------------------------------- L0 BASE（白印字） */
const BASE_KEYS: KeyMapPatch = {
  // 左 row0 — esc Q W E R T
  L00: bind('ESC'), L01: bind('Q'), L02: bind('W'), L03: bind('E'), L04: bind('R'), L05: bind('T'),
  // 左 row1 — tab A S D F G
  L10: bind('TAB'),
  L11: bind('A'), L12: bind('S'), L13: bind('D'), L14: bind('F'),
  L15: bind('G'),
  // 左 row2 — shift Z X C V B fn2
  L20: bind('LSHFT'), L21: bind('Z'), L22: bind('X'), L23: bind('C'), L24: bind('V'), L25: bind('B'),
  L26: bind('FN_2'),
  // 左 row3 — ctrl _ opt ⌘ fn1
  L30: bind('LCTRL'), L31: NONE, L32: bind('LALT'), L33: bind('LGUI'), L34: bind('FN_1'),
  // 左親指
  LT0: bind('SPACE'),

  // 右 row0 — Y U I O P -
  R01: bind('Y'), R02: bind('U'), R03: bind('I'), R04: bind('O'), R05: bind('P'), R06: bind('MINUS'),
  // 右 row1 — H J K L ; enter
  R11: bind('H'),
  R12: bind('J'), R13: bind('K'), R14: bind('L'), R15: bind('SEMI'),
  R16: bind('ENTER'),
  // 右 row2 — B N M , . ( )
  R20: bind('B'), R21: bind('N'), R22: bind('M'), R23: bind('COMMA'), R24: bind('DOT'),
  R25: bind('LPAR'), R26: bind('RPAR'),
  // 右 row3 — 無線切替 / backspace / マクロ
  R32: bind('OUT_TOG'), R33: bind('BSPC'),
  R34: bind('MACRO_1'), R35: bind('MACRO_2'), R36: bind('MACRO_3'),
}

/* --------------------------------------- L1 SYMBOL（赤印字 = fn1） */
const SYMBOL_KEYS: KeyMapPatch = {
  // 左: ESDF 十字キー + ページ移動
  L02: bind('PG_UP'), L03: bind('UP'), L04: bind('HOME'), L05: bind('END'),
  L12: bind('LEFT'), L13: bind('DOWN'), L14: bind('RIGHT'), L15: bind('PG_DN'),
  L01: bind('TAB'), L21: bind('UNDER'), L22: bind('PLUS'), L23: bind('EQUAL'),
  L24: bind('LBRC'), L25: bind('RBRC'),
  // 右: 上段に記号、テンキー状に数字（写真の & * ~ / $ % ^ / ! @ # 印字）
  R01: bind('GRAVE'), R02: bind('PIPE'), R03: bind('BSLH'),
  R04: bind('N7'), R05: bind('N8'), R06: bind('N9'),
  R11: bind('TILDE'), R12: bind('C_PREV'), R13: bind('C_NEXT'),
  R14: bind('N4'), R15: bind('N5'), R16: bind('N6'),
  R20: bind('MINUS'), R21: bind('LBKT'), R22: bind('RBKT'), R23: bind('EQUAL'),
  R24: bind('N1'), R25: bind('N2'), R26: bind('N3'),
  R33: bind('N0'),
}

/* --------------------------------------- L2 SYSTEM（緑印字 = fn2） */
const SYSTEM_KEYS: KeyMapPatch = {
  // 左手 ESDF: 矢印キー
  L03: bind('UP'), L12: bind('LEFT'), L13: bind('DOWN'), L14: bind('RIGHT'),
  // 右手: マウスボタン（U/J/K）+ テンキー状の数字
  R02: bind('MB3'),
  R04: bind('N7'), R05: bind('N8'), R06: bind('N9'),
  R12: bind('MB1'), R13: bind('MB2'),
  R14: bind('N4'), R15: bind('N5'), R16: bind('N6'),
  R24: bind('N1'), R25: bind('N2'), R26: bind('N3'),
  R34: bind('N0'),
}

/** L1/L2 は未指定キーを「透過」にして下のレイヤーへ落とす。L3〜L7 は白紙（すべて未割当） */
const LAYERS: LayerSeed[] = [
  {
    name: 'BASE', color: 'gray', keys: BASE_KEYS,
    sensors: {
      // 左エンコーダーは右矢印・左矢印
      'enc-l': enc(bind('RIGHT'), bind('LEFT')),
      // 左パッド: 上下スワイプで音量、タップでミュート
      'pad-l': pad(bind('C_VOL_UP'), bind('C_VOL_DN'), bind('C_MUTE')),
      // 右パッド: 上下で縦スクロール、タップで左クリック
      'pad-r': pad(bind('MSC_WHEEL_UP'), bind('MSC_WHEEL_DOWN'), bind('MB1')),
    },
  },
  {
    name: 'SYMBOL', color: 'pink', keys: SYMBOL_KEYS,
    sensors: {
      'enc-l': enc(bind('PG_DN'), bind('PG_UP')),
      'pad-l': pad(bind('C_BRI_UP'), bind('C_BRI_DN')),
      'pad-r': pad(TRANS, TRANS, TRANS),
    },
  },
  {
    name: 'SYSTEM', color: 'green', keys: SYSTEM_KEYS,
    sensors: {
      'enc-l': enc(bind('PG_DN'), bind('PG_UP')),
      'pad-l': pad(bind('C_BRI_UP'), bind('C_BRI_DN')),
      'pad-r': pad(TRANS, TRANS, TRANS),
    },
  },
  { name: 'NAV', color: 'purple' },
  { name: 'MOUSE', color: 'cyan' },
  { name: 'MEDIA', color: 'lime' },
  { name: 'NUM', color: 'sand' },
  { name: 'MACRO', color: 'orange' },
]

export const ORCA_ECHO: KeyboardDefinition = {
  id: 'keychron-orca-echo',
  name: 'Keychron Orca echo',
  maker: 'Keychron',
  firmware: 'zmk',
  hashtag: 'Orcaecho',
  keys: KEYS,
  sensors: SENSORS,
  layerCount: 8,
  defaultLayers: LAYERS,
  defaultKeymapName: 'Orca echo 標準',
  capture: CAPTURE,
}
