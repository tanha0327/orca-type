import { getKeycode, type Keycode } from '../data/keycodes.js'
import {
  isTrans,
  type Binding, type Combo, type Flavor, type Keymap,
} from '../data/types.js'
import type { KeyId, SensorId, SensorSlot } from '../keyboards/types.js'

/** レイヤースタック（下から上）。常に L0 が土台。 */
export function computeLayerStack(toggled: readonly number[], momentary: readonly number[]): number[] {
  const stack = [0]
  for (const n of [...toggled].sort((a, b) => a - b)) {
    if (!stack.includes(n)) stack.push(n)
  }
  // momentary は押した順。同じレイヤーが既にあっても最上位へ持ち上げる
  for (const n of momentary) {
    const at = stack.indexOf(n)
    if (at >= 0) stack.splice(at, 1)
    stack.push(n)
  }
  return stack
}

export interface Resolved {
  binding: Binding
  /** どのレイヤーで解決されたか */
  layerId: number
}

const NONE_BINDING: Binding = { tap: 'NONE' }

/** スタックの上から順に見て、最初の「透過でない」割当を返す */
export function resolveKey(keymap: Keymap, stack: readonly number[], keyId: KeyId): Resolved {
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = keymap.layers[stack[i]]
    if (!layer) continue
    const b = layer.keys[keyId]
    if (!isTrans(b)) return { binding: b, layerId: layer.id }
  }
  return { binding: NONE_BINDING, layerId: 0 }
}

/** エンコーダーの回転・パッドのスワイプも、キーと同じようにスタックの上から透過を飛ばして解決する */
export function resolveSensor(
  keymap: Keymap, stack: readonly number[], sensor: SensorId, slot: SensorSlot,
): Resolved {
  for (let i = stack.length - 1; i >= 0; i--) {
    const b = keymap.layers[stack[i]]?.sensors[sensor]?.[slot]
    if (!isTrans(b)) return { binding: b!, layerId: stack[i] }
  }
  return { binding: NONE_BINDING, layerId: 0 }
}

export function effectiveTerm(binding: Binding, keymap: Keymap): number {
  return binding.tappingTermMs ?? keymap.settings.tappingTermMs
}

export function effectiveFlavor(binding: Binding, keymap: Keymap): Flavor {
  return binding.flavor ?? keymap.settings.flavor
}

/** 現在のレイヤースタックで有効なコンボ */
export function activeCombos(keymap: Keymap, stack: readonly number[]): Combo[] {
  const top = stack[stack.length - 1] ?? 0
  return keymap.combos.filter((c) => c.enabled && c.layers.includes(top))
}

/** HUD やキーキャップに出す短い表記 */
export function glyphOf(code: Keycode | undefined): string {
  const kc = getKeycode(code)
  if (kc.code === 'NONE') return ''
  return kc.label || kc.code
}

export function nameOf(code: Keycode | undefined): string {
  return getKeycode(code).name
}

/** 修飾キーの記号（⇧ ⌃ ⌥ ⌘）。修飾でなければ undefined */
export function modSymbolOf(code: Keycode | undefined): string | undefined {
  return getKeycode(code).modSymbol
}

export function layerActionOf(code: Keycode | undefined) {
  const kc = getKeycode(code)
  if (kc.layerAction === undefined || kc.layerTarget === undefined) return undefined
  return { action: kc.layerAction, target: kc.layerTarget }
}

/** 「⇧ + A」のような組み合わせ表記を組み立てる */
export function combinationLabel(mods: readonly string[], main: string): string {
  const parts = [...mods, main].filter(Boolean)
  return parts.join(' + ')
}
