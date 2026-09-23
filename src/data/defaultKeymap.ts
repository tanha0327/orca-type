import { KEYS, type KeyId } from './layout'
import {
  bind, DEFAULT_ESC_COLOR, TRANS, NONE,
  type Binding, type Combo, type EncoderConfig, type Keymap,
  type Layer, type LayerColor, type PadConfig,
} from './types'

/* ================================================================
   初期キーマップ
   L0〜L2 は実機写真のキーキャップ印字（白 / 赤 / 緑）をそのまま再現。
   L3 以降は白紙（すべて未割当）。
   ================================================================ */

type KeyMapPatch = Record<KeyId, Binding>

const pad = (up: Binding, down: Binding, tap: Binding = TRANS): PadConfig => ({ up, down, tap })

const enc = (cw: Binding, ccw: Binding): EncoderConfig => ({ cw, ccw })

const transPad = (): PadConfig => pad(TRANS, TRANS, TRANS)

/* 白紙レイヤー用: 全キー／エンコーダー／パッドを未割当（NONE）にする */
const NONE_KEYS: KeyMapPatch = Object.fromEntries(KEYS.map((k) => [k.id, NONE])) as KeyMapPatch
const nonePad = (): PadConfig => pad(NONE, NONE, NONE)
const noneEnc = (): EncoderConfig => enc(NONE, NONE)

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

interface LayerSeed {
  name: string
  color: LayerColor
  keys: KeyMapPatch
  encoder: EncoderConfig
  padL: PadConfig
  padR: PadConfig
}

const SEEDS: LayerSeed[] = [
  {
    name: 'BASE', color: 'gray', keys: BASE_KEYS,
    // 左エンコーダーは右矢印・左矢印
    encoder: enc(bind('RIGHT'), bind('LEFT')),
    // 左パッド: 上下スワイプで音量、タップでミュート
    padL: pad(bind('C_VOL_UP'), bind('C_VOL_DN'), bind('C_MUTE')),
    // 右パッド: 上下で縦スクロール、タップで左クリック
    padR: pad(bind('MSC_WHEEL_UP'), bind('MSC_WHEEL_DOWN'), bind('MB1')),
  },
  {
    name: 'SYMBOL', color: 'pink', keys: SYMBOL_KEYS,
    encoder: enc(bind('PG_DN'), bind('PG_UP')),
    padL: pad(bind('C_BRI_UP'), bind('C_BRI_DN')),
    padR: transPad(),
  },
  {
    name: 'SYSTEM', color: 'green', keys: SYSTEM_KEYS,
    encoder: enc(bind('PG_DN'), bind('PG_UP')),
    padL: pad(bind('C_BRI_UP'), bind('C_BRI_DN')),
    padR: transPad(),
  },
  {
    name: 'NAV', color: 'purple', keys: NONE_KEYS,
    encoder: noneEnc(), padL: nonePad(), padR: nonePad(),
  },
  {
    name: 'MOUSE', color: 'cyan', keys: NONE_KEYS,
    encoder: noneEnc(), padL: nonePad(), padR: nonePad(),
  },
  {
    name: 'MEDIA', color: 'lime', keys: NONE_KEYS,
    encoder: noneEnc(), padL: nonePad(), padR: nonePad(),
  },
  {
    name: 'NUM', color: 'sand', keys: NONE_KEYS,
    encoder: noneEnc(), padL: nonePad(), padR: nonePad(),
  },
  {
    name: 'MACRO', color: 'orange', keys: NONE_KEYS,
    encoder: noneEnc(), padL: nonePad(), padR: nonePad(),
  },
]

const DEFAULT_COMBOS: Combo[] = []

export function createDefaultKeymap(): Keymap {
  const layers: Layer[] = SEEDS.map((seed, id) => ({
    id,
    name: seed.name,
    color: seed.color,
    // L1/L2 は未指定キーを「透過」にして下のレイヤーへ落とす。L3〜L7 は全キー未割当（白紙）
    keys: { ...seed.keys },
    encoder: seed.encoder,
    padL: seed.padL,
    padR: seed.padR,
  }))

  return {
    version: 1,
    name: 'Orca echo 標準',
    layers,
    combos: DEFAULT_COMBOS,
    trackball: {
      dpi: 800,
      angle: 0,
      invertX: false,
      invertY: false,
      snipeRatio: 0.35,
      scrollDivisor: 24,
      color: 'white',
    },
    settings: {
      tappingTermMs: 200,
      flavor: 'balanced',
      bodyColor: 'white',
      escColor: DEFAULT_ESC_COLOR,
    },
  }
}
