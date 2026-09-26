import { getKeycode } from '../data/keycodes'
import type { Binding, Flavor, Keymap } from '../data/types'
import { bindableSensors, keyboardOf } from '../keyboards/registry'
import { resolveKey } from './resolve'
import { bindingsGrid } from './zmk'

/* ================================================================
   QMK の keymap.c 風の書き出し

   内部のキーコードは ZMK の名前なので、QMK の名前に読み替える。
   QMK に同じものが無いキー（Bluetooth・ZMK Studio など）は XXXXXXX にしてコメントを残す。
   ================================================================ */

const DIRECT: Record<string, string> = {
  SPACE: 'KC_SPC', ENTER: 'KC_ENT', BSPC: 'KC_BSPC', DEL: 'KC_DEL', TAB: 'KC_TAB', ESC: 'KC_ESC',
  CAPS: 'KC_CAPS', LANG1: 'KC_LNG1', LANG2: 'KC_LNG2',
  MINUS: 'KC_MINS', EQUAL: 'KC_EQL', LBKT: 'KC_LBRC', RBKT: 'KC_RBRC', BSLH: 'KC_BSLS',
  SEMI: 'KC_SCLN', SQT: 'KC_QUOT', GRAVE: 'KC_GRV', COMMA: 'KC_COMM', DOT: 'KC_DOT', FSLH: 'KC_SLSH',
  EXCL: 'KC_EXLM', AT: 'KC_AT', HASH: 'KC_HASH', DLLR: 'KC_DLR', PRCNT: 'KC_PERC', CARET: 'KC_CIRC',
  AMPS: 'KC_AMPR', STAR: 'KC_ASTR', LPAR: 'KC_LPRN', RPAR: 'KC_RPRN', LBRC: 'KC_LCBR', RBRC: 'KC_RCBR',
  UNDER: 'KC_UNDS', PLUS: 'KC_PLUS', PIPE: 'KC_PIPE', TILDE: 'KC_TILD', COLON: 'KC_COLN', DQT: 'KC_DQUO',
  LT: 'KC_LT', GT: 'KC_GT', QMARK: 'KC_QUES',
  LSHFT: 'KC_LSFT', RSHFT: 'KC_RSFT', LCTRL: 'KC_LCTL', RCTRL: 'KC_RCTL',
  LALT: 'KC_LALT', RALT: 'KC_RALT', LGUI: 'KC_LGUI', RGUI: 'KC_RGUI', HYPER: 'KC_HYPR', MEH: 'KC_MEH',
  LEFT: 'KC_LEFT', RIGHT: 'KC_RGHT', UP: 'KC_UP', DOWN: 'KC_DOWN', HOME: 'KC_HOME', END: 'KC_END',
  PG_UP: 'KC_PGUP', PG_DN: 'KC_PGDN', INS: 'KC_INS', K_APP: 'KC_APP', PSCRN: 'KC_PSCR',
  C_VOL_UP: 'KC_VOLU', C_VOL_DN: 'KC_VOLD', C_MUTE: 'KC_MUTE', C_PP: 'KC_MPLY', C_NEXT: 'KC_MNXT',
  C_PREV: 'KC_MPRV', C_STOP: 'KC_MSTP', C_BRI_UP: 'KC_BRIU', C_BRI_DN: 'KC_BRID',
  MB1: 'MS_BTN1', MB2: 'MS_BTN2', MB3: 'MS_BTN3', MB4: 'MS_BTN4', MB5: 'MS_BTN5',
  MSC_WHEEL_UP: 'MS_WHLU', MSC_WHEEL_DOWN: 'MS_WHLD', MSC_HWHEEL_LEFT: 'MS_WHLL', MSC_HWHEEL_RIGHT: 'MS_WHLR',
  MS_UP: 'MS_UP', MS_DOWN: 'MS_DOWN', MS_LEFT: 'MS_LEFT', MS_RIGHT: 'MS_RGHT',
  BOOTLOADER: 'QK_BOOT', SYS_RESET: 'QK_RBT', RGB_TOG: 'RM_TOGG',
}

/** 長押しで修飾になる MOD-TAP の書き方 */
const MOD_TAP: Record<string, string> = {
  LSHFT: 'LSFT_T', RSHFT: 'RSFT_T', LCTRL: 'LCTL_T', RCTRL: 'RCTL_T',
  LALT: 'LALT_T', RALT: 'RALT_T', LGUI: 'LGUI_T', RGUI: 'RGUI_T', HYPER: 'HYPR_T', MEH: 'MEH_T',
}

/** 内部コード → QMK のキーコード。QMK に無いものは null */
export function qmkKeycode(code: string | undefined): string | null {
  const kc = getKeycode(code)
  if (kc.code === 'TRANS') return '_______'
  if (kc.code === 'NONE') return 'XXXXXXX'
  if (kc.layerAction && kc.layerTarget !== undefined) return `${kc.layerAction}(${kc.layerTarget})`
  if (/^[A-Z]$/.test(kc.code)) return `KC_${kc.code}`
  if (/^N[0-9]$/.test(kc.code)) return `KC_${kc.code.slice(1)}`
  if (/^KP_N[0-9]$/.test(kc.code)) return `KC_P${kc.code.slice(4)}`
  if (/^F([1-9]|1[0-2])$/.test(kc.code)) return `KC_${kc.code}`
  if (kc.code.startsWith('MACRO_')) return `QK_MACRO_${Number(kc.code.slice(6)) - 1}`
  return DIRECT[kc.code] ?? null
}

function tapText(code: string | undefined): string {
  return qmkKeycode(code) ?? `XXXXXXX /* ${getKeycode(code).code} */`
}

export function qmkBindingText(b: Binding | undefined): string {
  if (!b || b.tap === 'TRANS') return '_______'
  if (!b.hold || b.hold === 'NONE' || b.hold === 'TRANS') return tapText(b.tap)

  const hold = getKeycode(b.hold)
  const tap = qmkKeycode(b.tap) ?? 'XXXXXXX'
  // 長押しがレイヤーなら layer-tap、修飾なら mod-tap。それ以外の長押しは QMK の基本機能では書けない
  if (hold.layerAction === 'MO' && hold.layerTarget !== undefined) return `LT(${hold.layerTarget}, ${tap})`
  if (MOD_TAP[hold.code]) return `${MOD_TAP[hold.code]}(${tap})`
  return `${tap} /* 長押し ${hold.code} は未対応 */`
}

/** ZMK のフレーバーに近い QMK の設定 */
const FLAVOR_CONFIG: Record<Flavor, string> = {
  'hold-preferred': '#define HOLD_ON_OTHER_KEY_PRESS',
  balanced: '#define PERMISSIVE_HOLD',
  'tap-preferred': '/* 既定の動作（単押し優先）なので追加の設定は不要 */',
}

/** QMK の keymap.c に貼れる形の「風」プレビューを作る */
export function toQmkKeymap(keymap: Keymap): string {
  const def = keyboardOf(keymap)
  const layoutMacro = def.qmkLayout ?? 'LAYOUT'
  const total = def.keys.length
  const encoders = bindableSensors(def).filter((s) => s.kind === 'encoder')
  const pads = bindableSensors(def).filter((s) => s.kind === 'pad')

  const layers = keymap.layers.map((layer, i) => {
    const grid = bindingsGrid(
      def, layer,
      (b, index) => qmkBindingText(b) + (index < total - 1 ? ',' : ''),
      '   ',
    )
    return [
      `    /* L${i} ${layer.name} */`,
      `    [${i}] = ${layoutMacro}(`,
      ...grid.map((line) => `        ${line}`),
      `    )${i < keymap.layers.length - 1 ? ',' : ''}`,
    ].join('\n')
  })

  const encoderMap = encoders.length === 0 ? [] : [
    '',
    '#if defined(ENCODER_MAP_ENABLE)',
    'const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS] = {',
    ...keymap.layers.map((layer, i) => {
      const cells = encoders.map((s) => {
        const slots = layer.sensors[s.id] ?? {}
        return `ENCODER_CCW_CW(${qmkKeycode(slots.ccw?.tap ?? 'TRANS') ?? 'XXXXXXX'}, ${qmkKeycode(slots.cw?.tap ?? 'TRANS') ?? 'XXXXXXX'})`
      })
      return `    [${i}] = { ${cells.join(', ')} },`
    }),
    '};',
    '#endif',
  ]

  const padNotes = pads.length === 0 ? [] : [
    '',
    `/* ${pads.map((p) => p.name).join('・')} のスワイプは QMK の標準機能に無いので、書き出していません */`,
  ]

  // QMK のコンボはキーの位置ではなくキーコードで書くので、有効なレイヤーでの割当を並べる
  const combos = keymap.combos.filter((c) => c.enabled && c.keys.length >= 2)
  const comboBlock = combos.length === 0 ? [] : [
    '',
    '/* COMBO_ENABLE = yes（rules.mk）が必要です */',
    ...combos.map((c, i) => {
      const layer = c.layers[0] ?? 0
      const codes = c.keys.map((id) => qmkBindingText(resolveKey(keymap, layer === 0 ? [0] : [0, layer], id).binding))
      return `const uint16_t PROGMEM combo${i}[] = {${codes.join(', ')}, COMBO_END}; /* ${c.name} */`
    }),
    'combo_t key_combos[] = {',
    ...combos.map((c, i) => `    COMBO(combo${i}, ${qmkBindingText(c.binding)}),`),
    '};',
  ]

  return [
    '/*',
    ` * ${keymap.name} — ${def.name}`,
    ' * ORCA MAP で書き出したキーマップのプレビューです（QMK の keymap.c 風）。',
    ' *',
    ' * config.h:',
    ` *   #define TAPPING_TERM ${keymap.settings.tappingTermMs}`,
    ` *   ${FLAVOR_CONFIG[keymap.settings.flavor]}`,
    ...(combos.length > 0 ? [` *   #define COMBO_TERM ${Math.max(...combos.map((c) => c.timeoutMs))}`] : []),
    ' */',
    '',
    '#include QMK_KEYBOARD_H',
    '',
    'const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {',
    layers.join('\n\n'),
    '};',
    ...encoderMap,
    ...padNotes,
    ...comboBlock,
    '',
  ].join('\n')
}
