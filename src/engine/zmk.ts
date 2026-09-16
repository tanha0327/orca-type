import { getKeycode } from '../data/keycodes'
import { KEYS, type KeyId } from '../data/layout'
import type { Binding, Keymap, Layer } from '../data/types'

/** 内部コード → ZMK の振る舞い表記 */
function behavior(code: string | undefined): string {
  const kc = getKeycode(code)
  if (kc.code === 'TRANS') return '&trans'
  if (kc.code === 'NONE') return '&none'
  if (kc.layerAction && kc.layerTarget !== undefined) {
    const op = kc.layerAction === 'MO' ? 'mo' : kc.layerAction === 'TG' ? 'tog' : 'to'
    return `&${op} ${kc.layerTarget}`
  }
  if (kc.category === 'bt') {
    if (kc.code.startsWith('BT_SEL_')) return `&bt BT_SEL ${kc.code.slice(7)}`
    if (kc.code === 'BT_CLR') return '&bt BT_CLR'
    if (kc.code === 'BT_NXT') return '&bt BT_NXT'
    if (kc.code === 'OUT_TOG') return '&out OUT_TOG'
  }
  if (kc.code.startsWith('MB')) return `&mkp ${kc.code}`
  if (kc.code.startsWith('MSC_')) return `&msc ${kc.code.replace('MSC_', '')}`
  if (kc.code.startsWith('MS_')) return `&mmv ${kc.code.replace('MS_', 'MOVE_')}`
  if (kc.code.startsWith('MACRO_')) return `&macro_${kc.code.slice(6)}`
  if (kc.code === 'SNIPE' || kc.code === 'SCRL_MODE') return `&${kc.code.toLowerCase()}`
  if (kc.code === 'STUDIO_UNLOCK') return '&studio_unlock'
  if (kc.code === 'BOOTLOADER') return '&bootloader'
  if (kc.code === 'SYS_RESET') return '&sys_reset'
  if (kc.code === 'RGB_TOG') return '&rgb_ug RGB_TOG'
  return `&kp ${kc.code}`
}

function bindingText(b: Binding | undefined): string {
  if (!b || b.tap === 'TRANS') return '&trans'
  if (!b.hold || b.hold === 'NONE') return behavior(b.tap)

  const holdKc = getKeycode(b.hold)
  const tapKc = getKeycode(b.tap)
  // 長押しがレイヤーなら layer-tap、それ以外は mod-tap
  if (holdKc.layerAction === 'MO' && holdKc.layerTarget !== undefined) {
    return `&lt ${holdKc.layerTarget} ${tapKc.code}`
  }
  return `&mt ${holdKc.code} ${tapKc.code}`
}

function padCell(text: string, width: number): string {
  return text.padEnd(width, ' ')
}

const ROWS = [0, 1, 2, 3]

function keysOfRow(half: 'L' | 'R', row: number): KeyId[] {
  return KEYS
    .filter((k) => k.half === half && k.row === row && k.kind === 'key')
    .sort((a, b) => a.col - b.col)
    .map((k) => k.id)
}

function layerBlock(layer: Layer, keymap: Keymap): string {
  const lines: string[] = []
  const cells: string[][] = []

  for (const row of ROWS) {
    const left = keysOfRow('L', row).map((id) => bindingText(layer.keys[id]))
    const right = keysOfRow('R', row).map((id) => bindingText(layer.keys[id]))
    cells.push([...left, '|', ...right])
  }
  // 親指 + トラックボール列
  cells.push([bindingText(layer.keys['LT0']), '|'])

  const width = Math.max(
    ...cells.flat().map((c) => c.length),
  ) + 2

  for (const row of cells) {
    lines.push('                ' + row.map((c) => (c === '|' ? ' | ' : padCell(c, width))).join('').trimEnd())
  }

  const sensor = [
    `&inc_dec_kp ${getKeycode(layer.encoder.cw.tap).code} ${getKeycode(layer.encoder.ccw.tap).code}`,
  ]

  const padComment = (name: string, cfg: Layer['padL']) =>
    `            /* ${name}: ↑${getKeycode(cfg.up.tap).code}  ↓${getKeycode(cfg.down.tap).code}` +
    `  タップ${getKeycode(cfg.tap.tap).code} */`

  const id = layer.id
  const slug = layer.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `layer_${id}`

  return [
    `        ${slug}_layer {`,
    `            display-name = "${layer.name}";`,
    padComment('左スクロールパッド', layer.padL),
    padComment('右スクロールパッド', layer.padR),
    `            bindings = <`,
    ...lines,
    `            >;`,
    `            sensor-bindings = <${sensor.join(' ')}>;`,
    `        };`,
  ].join('\n') + (keymap.layers.length - 1 === id ? '' : '\n')
}

function comboBlock(keymap: Keymap): string {
  if (keymap.combos.length === 0) return ''
  const items = keymap.combos.map((c) => {
    const positions = c.keys
      .map((id) => KEYS.findIndex((k) => k.id === id))
      .filter((n) => n >= 0)
      .join(' ')
    const slug = c.id.replace(/[^a-z0-9]+/gi, '_')
    return [
      `        ${slug} {`,
      `            /* ${c.name} */`,
      `            timeout-ms = <${c.timeoutMs}>;`,
      `            key-positions = <${positions}>;`,
      `            bindings = <${bindingText(c.binding)}>;`,
      `            layers = <${c.layers.join(' ')}>;`,
      `        };`,
    ].join('\n')
  })
  return [
    '',
    '    combos {',
    '        compatible = "zmk,combos";',
    ...items,
    '    };',
  ].join('\n')
}

/** Keychron Launcher / ZMK に貼れる形の「風」プレビューを作る */
export function toZmkKeymap(keymap: Keymap): string {
  return [
    '/*',
    ` * ${keymap.name} — Keychron Orca echo`,
    ' * ORCA TYPE で書き出したキーマップのプレビューです。',
    ` * タッピングターム ${keymap.settings.tappingTermMs}ms / フレーバー ${keymap.settings.flavor}`,
    ` * トラックボール ${keymap.trackball.dpi}dpi / 角度 ${keymap.trackball.angle}° / 精密 ${Math.round(keymap.trackball.snipeRatio * 100)}%`,
    ' */',
    '',
    '/ {',
    '    keymap {',
    '        compatible = "zmk,keymap";',
    '',
    ...keymap.layers.map((l) => layerBlock(l, keymap)),
    '    };',
    comboBlock(keymap),
    '};',
    '',
  ].join('\n')
}
