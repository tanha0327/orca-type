import type { KeyId } from './layout'
import {
  bind, TRANS, NONE,
  type Binding, type Combo, type EncoderConfig, type Keymap,
  type Layer, type LayerColor, type PadConfig,
} from './types'

/* ================================================================
   初期キーマップ
   L0〜L2 は実機写真のキーキャップ印字（白 / 赤 / 緑）をそのまま再現。
   L3 以降は空き枠として使いやすい初期値を入れてある。
   ================================================================ */

type KeyMapPatch = Record<KeyId, Binding>

const pad = (
  up: Binding, down: Binding, left: Binding, right: Binding,
  tap: Binding = TRANS, doubleTap: Binding = TRANS,
): PadConfig => ({ up, down, left, right, tap, doubleTap })

const enc = (cw: Binding, ccw: Binding, press: Binding = TRANS): EncoderConfig => ({ cw, ccw, press })

const transPad = (): PadConfig => pad(TRANS, TRANS, TRANS, TRANS, TRANS, TRANS)
const transEnc = (): EncoderConfig => enc(TRANS, TRANS, TRANS)

/* ------------------------------------------------- L0 BASE（白印字） */
const BASE_KEYS: KeyMapPatch = {
  // 左 row0 — esc Q W E R T
  L00: bind('ESC'), L01: bind('Q'), L02: bind('W'), L03: bind('E'), L04: bind('R'), L05: bind('T'),
  // 左 row1 — tab A S D F G（ホームロー修飾を長押しに）
  L10: bind('TAB'),
  L11: bind('A', 'LGUI'), L12: bind('S', 'LALT'), L13: bind('D', 'LCTRL'), L14: bind('F', 'LSHFT'),
  L15: bind('G'),
  // 左 row2 — shift Z X C V B fn2
  L20: bind('LSHFT'), L21: bind('Z'), L22: bind('X'), L23: bind('C'), L24: bind('V'), L25: bind('B'),
  L26: bind('FN_2'),
  // 左 row3 — ctrl _ opt ⌘ fn1
  L30: bind('LCTRL'), L31: NONE, L32: bind('LALT'), L33: bind('LGUI'), L34: bind('FN_1'),
  // 左親指 — スペース長押しで NAV レイヤー
  LT0: bind('SPACE', 'FN_3'),

  // 右 row0 — Y U I O P -
  R01: bind('Y'), R02: bind('U'), R03: bind('I'), R04: bind('O'), R05: bind('P'), R06: bind('MINUS'),
  // 右 row1 — H J K L ; enter（ホームロー修飾）
  R11: bind('H'),
  R12: bind('J', 'RSHFT'), R13: bind('K', 'RCTRL'), R14: bind('L', 'RALT'), R15: bind('SEMI', 'RGUI'),
  R16: bind('ENTER'),
  // 右 row2 — B N M , . ( )
  R20: bind('B'), R21: bind('N'), R22: bind('M'), R23: bind('COMMA'), R24: bind('DOT'),
  R25: bind('LPAR'), R26: bind('RPAR'),
  // 右 row3 — 無線切替 / backspace / マクロ
  R32: bind('OUT_TOG'), R33: bind('BSPC', 'DEL'),
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
  L00: bind('BT_CLR'),
  L01: bind('OUT_TOG'),      // 写真の Q の緑 Wi-Fi アイコン
  L02: bind('RGB_TOG'), L03: bind('C_BRI_UP'), L13: bind('C_BRI_DN'),
  L05: bind('STUDIO_UNLOCK'),
  L21: bind('SYS_RESET'), L22: bind('BOOTLOADER'),
  R01: bind('F12'), R02: bind('F11'), R03: bind('F10'),
  R04: bind('F7'), R05: bind('F8'), R06: bind('F9'),
  R14: bind('F4'), R15: bind('F5'), R16: bind('F6'),
  R24: bind('F1'), R25: bind('F2'), R26: bind('F3'),
  R32: bind('OUT_TOG'),      // 写真の右手の緑 Wi-Fi アイコン
  R34: bind('BT_SEL_0'), R35: bind('BT_SEL_1'), R36: bind('BT_SEL_2'), // B1 / B2 / B3
  R33: bind('BT_NXT'),
}

/* --------------------------------------------------- L3 NAV */
const NAV_KEYS: KeyMapPatch = {
  R11: bind('LEFT'), R12: bind('DOWN'), R13: bind('UP'), R14: bind('RIGHT'),
  R01: bind('HOME'), R02: bind('PG_DN'), R03: bind('PG_UP'), R04: bind('END'),
  R21: bind('ESC'), R22: bind('TAB'), R23: bind('DEL'),
  L01: bind('LANG2'), L02: bind('LANG1'),
}

/* --------------------------------------------------- L4 MOUSE */
const MOUSE_KEYS: KeyMapPatch = {
  R11: bind('MS_LEFT'), R12: bind('MS_DOWN'), R13: bind('MS_UP'), R14: bind('MS_RIGHT'),
  R01: bind('MSC_WHEEL_UP'), R02: bind('MSC_WHEEL_DOWN'),
  R03: bind('MSC_HWHEEL_LEFT'), R04: bind('MSC_HWHEEL_RIGHT'),
  R21: bind('MB1'), R22: bind('MB2'), R23: bind('MB3'),
  R05: bind('MB4'), R06: bind('MB5'),
  L24: bind('SNIPE'), L25: bind('SCRL_MODE'),
  LT0: bind('MB1'),
}

/* --------------------------------------------------- L5 MEDIA */
const MEDIA_KEYS: KeyMapPatch = {
  R11: bind('C_PREV'), R12: bind('C_VOL_DN'), R13: bind('C_VOL_UP'), R14: bind('C_NEXT'),
  R21: bind('C_PP'), R22: bind('C_MUTE'), R23: bind('C_STOP'),
  L03: bind('C_BRI_UP'), L13: bind('C_BRI_DN'),
}

/* --------------------------------------------------- L6 NUM */
const NUM_KEYS: KeyMapPatch = {
  R04: bind('KP_N7'), R05: bind('KP_N8'), R06: bind('KP_N9'),
  R14: bind('KP_N4'), R15: bind('KP_N5'), R16: bind('KP_N6'),
  R24: bind('KP_N1'), R25: bind('KP_N2'), R26: bind('KP_N3'),
  R33: bind('KP_N0'), R23: bind('DOT'), R22: bind('COMMA'),
}

/* --------------------------------------------------- L7 MACRO */
const MACRO_KEYS: KeyMapPatch = {
  R34: bind('MACRO_1'), R35: bind('MACRO_2'), R36: bind('MACRO_3'),
  R24: bind('MACRO_4'), R25: bind('MACRO_5'), R26: bind('MACRO_6'),
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
    encoder: enc(bind('RIGHT'), bind('LEFT'), bind('MB3')),
    // 左パッド: 上下スワイプで音量、左右スワイプで水平スクロール
    padL: pad(
      bind('C_VOL_UP'), bind('C_VOL_DN'),
      bind('MSC_HWHEEL_LEFT'), bind('MSC_HWHEEL_RIGHT'),
      bind('C_MUTE'), bind('C_PP'),
    ),
    // 右パッド: 上下で縦スクロール、左右で水平スクロール
    padR: pad(
      bind('MSC_WHEEL_UP'), bind('MSC_WHEEL_DOWN'),
      bind('MSC_HWHEEL_LEFT'), bind('MSC_HWHEEL_RIGHT'),
      bind('MB1'), bind('MB2'),
    ),
  },
  {
    name: 'SYMBOL', color: 'pink', keys: SYMBOL_KEYS,
    encoder: enc(bind('PG_DN'), bind('PG_UP'), TRANS),
    padL: pad(bind('C_BRI_UP'), bind('C_BRI_DN'), TRANS, TRANS, TRANS, TRANS),
    padR: transPad(),
  },
  {
    name: 'SYSTEM', color: 'green', keys: SYSTEM_KEYS,
    encoder: enc(bind('BT_NXT'), bind('BT_NXT'), bind('BT_CLR')),
    padL: pad(bind('RGB_TOG'), bind('RGB_TOG'), TRANS, TRANS, TRANS, TRANS),
    padR: transPad(),
  },
  {
    name: 'NAV', color: 'purple', keys: NAV_KEYS,
    encoder: enc(bind('C_NEXT'), bind('C_PREV'), bind('C_PP')),
    padL: transPad(), padR: transPad(),
  },
  {
    name: 'MOUSE', color: 'cyan', keys: MOUSE_KEYS,
    encoder: enc(bind('MSC_WHEEL_DOWN'), bind('MSC_WHEEL_UP'), bind('MB3')),
    padL: transPad(),
    padR: pad(
      bind('MSC_WHEEL_UP'), bind('MSC_WHEEL_DOWN'),
      bind('MSC_HWHEEL_LEFT'), bind('MSC_HWHEEL_RIGHT'),
      bind('MB1'), bind('MB2'),
    ),
  },
  {
    name: 'MEDIA', color: 'lime', keys: MEDIA_KEYS,
    encoder: enc(bind('C_VOL_UP'), bind('C_VOL_DN'), bind('C_MUTE')),
    padL: pad(bind('C_VOL_UP'), bind('C_VOL_DN'), bind('C_PREV'), bind('C_NEXT'), bind('C_PP'), bind('C_MUTE')),
    padR: transPad(),
  },
  {
    name: 'NUM', color: 'sand', keys: NUM_KEYS,
    encoder: transEnc(), padL: transPad(), padR: transPad(),
  },
  {
    name: 'MACRO', color: 'orange', keys: MACRO_KEYS,
    encoder: transEnc(), padL: transPad(), padR: transPad(),
  },
]

const DEFAULT_COMBOS: Combo[] = [
  {
    id: 'combo-esc', name: 'D + F で Escape',
    keys: ['L13', 'L14'], binding: bind('ESC'), timeoutMs: 40, layers: [0], enabled: true,
  },
  {
    id: 'combo-enter', name: 'J + K で Enter',
    keys: ['R12', 'R13'], binding: bind('ENTER'), timeoutMs: 40, layers: [0], enabled: true,
  },
  {
    id: 'combo-copy', name: 'X + C でコピー',
    keys: ['L22', 'L23'], binding: bind('MACRO_1'), timeoutMs: 50, layers: [0], enabled: true,
  },
  {
    id: 'combo-mute', name: 'I + O でミュート（ジェスチャー割当の例）',
    keys: ['R03', 'R04'], binding: bind('C_MUTE'), timeoutMs: 50, layers: [0], enabled: true,
  },
  {
    id: 'combo-layer', name: 'Z + X で NUM レイヤーをトグル',
    keys: ['L21', 'L22'], binding: bind('TG_6'), timeoutMs: 50, layers: [0], enabled: true,
  },
]

export function createDefaultKeymap(): Keymap {
  const layers: Layer[] = SEEDS.map((seed, id) => ({
    id,
    name: seed.name,
    color: seed.color,
    // L0 以外は未指定キーを「透過」にして下のレイヤーへ落とす
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
    },
    settings: {
      tappingTermMs: 200,
      flavor: 'balanced',
      doubleTapMs: 220,
    },
  }
}
