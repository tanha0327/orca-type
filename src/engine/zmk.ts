import { getKeycode } from '../data/keycodes'
import type { Binding, Keymap, Layer } from '../data/types'
import { bindableSensors, hasBall, keyboardOf, keyPosition } from '../keyboards/registry'
import type { KeyboardDefinition, KeyDef } from '../keyboards/types'

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

/**
 * キーを書き出す順（= 定義の順）のまま、見た目の段ごとに改行する。
 * 左から右へ並べていって x が戻ったら次の段。分割キーボードは左右の境目に | を挟む。
 */
export function visualRows(def: KeyboardDefinition): KeyDef[][] {
  const rows: KeyDef[][] = []
  let prev: KeyDef | undefined
  for (const k of def.keys) {
    if (!prev || k.x < prev.x - 0.01) rows.push([])
    rows[rows.length - 1].push(k)
    prev = k
  }
  return rows
}

/**
 * レイヤーの割当を、段ごとに桁をそろえた文字列の行にする（ZMK / QMK の書き出しで共通）。
 * 分割キーボードの左右の境目には separator を挟む。
 */
export function bindingsGrid(
  def: KeyboardDefinition,
  layer: Layer,
  cell: (b: Binding | undefined, index: number) => string,
  separator = ' | ',
): string[] {
  let index = 0
  const rows = visualRows(def).map((row) => row.flatMap((k, i) => {
    const text = cell(layer.keys[k.id], index++)
    const prev = row[i - 1]
    return prev?.half && k.half && prev.half !== k.half ? [SEPARATOR, text] : [text]
  }))
  const width = Math.max(...rows.flat().map((c) => c.length)) + 2
  return rows.map((row) => row.map((c) => (c === SEPARATOR ? separator : c.padEnd(width, ' '))).join('').trimEnd())
}

const SEPARATOR = '\u0000|'

const code = (b: Binding | undefined) => getKeycode(b?.tap ?? 'TRANS').code

function layerBlock(layer: Layer, def: KeyboardDefinition, last: boolean): string {
  const encoders = bindableSensors(def).filter((s) => s.kind === 'encoder')
  const pads = bindableSensors(def).filter((s) => s.kind === 'pad')

  const sensorCells = encoders.map((s) => {
    const slots = layer.sensors[s.id] ?? {}
    const cw = slots.cw
    const ccw = slots.ccw
    if ((!cw || cw.tap === 'TRANS') && (!ccw || ccw.tap === 'TRANS')) return '&trans'
    return `&inc_dec_kp ${code(cw)} ${code(ccw)}`
  })

  const padComment = pads.map((s) => {
    const slots = layer.sensors[s.id] ?? {}
    return `            /* ${s.name}: ↑${code(slots.up)}  ↓${code(slots.down)}  タップ${code(slots.tap)} */`
  })

  const slug = layer.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `layer_${layer.id}`

  return [
    `        ${slug}_layer {`,
    `            display-name = "${layer.name}";`,
    ...padComment,
    `            bindings = <`,
    ...bindingsGrid(def, layer, bindingText).map((line) => `                ${line}`),
    `            >;`,
    ...(sensorCells.length > 0 ? [`            sensor-bindings = <${sensorCells.join(' ')}>;`] : []),
    `        };`,
  ].join('\n') + (last ? '' : '\n')
}

function comboBlock(keymap: Keymap, def: KeyboardDefinition): string {
  if (keymap.combos.length === 0) return ''
  const items = keymap.combos.map((c) => {
    const positions = c.keys
      .map((id) => keyPosition(def, id))
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

/** ZMK の .keymap に貼れる形の「風」プレビューを作る */
export function toZmkKeymap(keymap: Keymap): string {
  const def = keyboardOf(keymap)
  return [
    '/*',
    ` * ${keymap.name} — ${def.name}`,
    ' * ORCA MAP で書き出したキーマップのプレビューです。',
    ` * タッピングターム ${keymap.settings.tappingTermMs}ms / フレーバー ${keymap.settings.flavor}`,
    ...(hasBall(def)
      ? [` * トラックボール ${keymap.trackball.dpi}dpi / 角度 ${keymap.trackball.angle}° / 精密 ${Math.round(keymap.trackball.snipeRatio * 100)}%`]
      : []),
    ' */',
    '',
    '/ {',
    '    keymap {',
    '        compatible = "zmk,keymap";',
    '',
    ...keymap.layers.map((l, i) => layerBlock(l, def, i === keymap.layers.length - 1)),
    '    };',
    comboBlock(keymap, def),
    '};',
    '',
  ].join('\n')
}

