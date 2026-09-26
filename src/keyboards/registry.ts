import { CODE_TO_KEYCODE, MAX_LAYERS, type Keycode } from '../data/keycodes'
import {
  DEFAULT_ESC_COLOR, LAYER_COLORS, NONE,
  type Binding, type Keymap, type Layer, type LayerColor, type TrackballConfig, type KeymapSettings,
} from '../data/types'
import { ANSI_60 } from './ansi60'
import { CORNE } from './corne'
import { ORCA_ECHO } from './orcaEcho'
import { ERGODOX_EZ } from './presets/ergodox'
import { IRIS } from './presets/iris'
import { KEYBALL44 } from './presets/keyball44'
import { KYRIA } from './presets/kyria'
import { LILY58 } from './presets/lily58'
import { MOONLANDER } from './presets/moonlander'
import { PLANCK } from './presets/planck'
import { PREONIC } from './presets/preonic'
import { SOFLE } from './presets/sofle'
import { FERRIS_SWEEP } from './presets/sweep'
import {
  SENSOR_SLOTS,
  type KeyboardDefinition, type KeyDef, type KeyId, type LayerSeed, type SensorBindings,
  type SensorDef, type SensorId,
} from './types'

/* ================================================================
   組み込みのキーボード
   新しい機種を足すときは、KeyboardDefinition を 1 つ書いてここに並べるだけでよい
   （presets/ の定義は、公開されている QMK / ZMK / KLE の定義から写したもの）。

   並びは Orca echo のあとに、よく知られている順。
   目安は QMK 0.22（2023 年）に集まっていたコミュニティのキーマップの数
   （Planck 203 / ErgoDox 122 / 60% 90 / Corne 62 / Iris 57 / Preonic 57 / Kyria 39 / Lily58 31 / Sofle 14）で、
   QMK の外で使われることが多い機種（Moonlander は ZSA の Oryx、Keyball は独自のリポジトリ、
   Sweep は ZMK が中心）は、いまの人気を見てその後ろに並べた。
   ================================================================ */

export const BUILTIN_KEYBOARDS: readonly KeyboardDefinition[] = [
  ORCA_ECHO,
  PLANCK,
  ERGODOX_EZ,
  ANSI_60,
  CORNE,
  IRIS,
  PREONIC,
  KYRIA,
  LILY58,
  SOFLE,
  MOONLANDER,
  KEYBALL44,
  FERRIS_SWEEP,
]

/** キーボードの指定が無い古い保存データは Orca echo のもの */
export const DEFAULT_KEYBOARD: KeyboardDefinition = ORCA_ECHO

const builtinById = new Map(BUILTIN_KEYBOARDS.map((d) => [d.id, d]))

export function getBuiltinKeyboard(id: string): KeyboardDefinition | undefined {
  return builtinById.get(id)
}

export function isBuiltinKeyboard(id: string): boolean {
  return builtinById.has(id)
}

/** キーマップが対象にしているキーボード定義。組み込み → 同梱の定義 → 既定 の順に探す */
export function keyboardOf(keymap: Pick<Keymap, 'keyboard' | 'keyboardDef'>): KeyboardDefinition {
  return builtinById.get(keymap.keyboard) ?? keymap.keyboardDef ?? DEFAULT_KEYBOARD
}

/* ---------------------------------------------------------------- 定義の索引 */

interface KeyboardIndex {
  keys: Map<KeyId, KeyDef>
  keyOrder: Map<KeyId, number>
  sensors: Map<SensorId, SensorDef>
}

const indexCache = new WeakMap<KeyboardDefinition, KeyboardIndex>()

function indexOf(def: KeyboardDefinition): KeyboardIndex {
  let idx = indexCache.get(def)
  if (!idx) {
    idx = {
      keys: new Map(def.keys.map((k) => [k.id, k])),
      keyOrder: new Map(def.keys.map((k, i) => [k.id, i])),
      sensors: new Map((def.sensors ?? []).map((s) => [s.id, s])),
    }
    indexCache.set(def, idx)
  }
  return idx
}

export function findKey(def: KeyboardDefinition, id: KeyId): KeyDef | undefined {
  return indexOf(def).keys.get(id)
}

/** ファームウェア上のキー番号（ZMK の key-positions など）。無ければ -1 */
export function keyPosition(def: KeyboardDefinition, id: KeyId): number {
  return indexOf(def).keyOrder.get(id) ?? -1
}

export function findSensor(def: KeyboardDefinition, id: SensorId): SensorDef | undefined {
  return indexOf(def).sensors.get(id)
}

/** レイヤーごとの割当を持つセンサー（トラックボールは除く） */
export function bindableSensors(def: KeyboardDefinition): SensorDef[] {
  return (def.sensors ?? []).filter((s) => SENSOR_SLOTS[s.kind].length > 0)
}

export function hasBall(def: KeyboardDefinition): boolean {
  return (def.sensors ?? []).some((s) => s.kind === 'ball')
}

/** 「左手 / 2 段 3 列」のような、キーの場所の説明 */
export function describeKey(def: KeyboardDefinition, id: KeyId): string {
  const k = findKey(def, id)
  if (!k) return ''
  const side = k.half ? `${k.half === 'L' ? '左' : '右'}手 / ` : ''
  const pos = k.thumb
    ? '親指'
    : k.row !== undefined && k.col !== undefined
      ? `${k.row + 1} 段 ${k.col + 1} 列`
      : `${keyPosition(def, id) + 1} 番目のキー`
  return side + pos
}

/* ---------------------------------------------------------------- キーマップを作る */

const DEFAULT_LAYER_NAMES = ['BASE', 'LOWER', 'RAISE', 'ADJUST', 'NAV', 'MOUSE', 'MEDIA', 'NUM']

export function defaultLayerName(id: number): string {
  return DEFAULT_LAYER_NAMES[id] ?? `L${id}`
}

export function defaultLayerColor(id: number): LayerColor {
  return LAYER_COLORS[id % LAYER_COLORS.length]
}

export const DEFAULT_TRACKBALL: TrackballConfig = {
  dpi: 800,
  angle: 0,
  invertX: false,
  invertY: false,
  snipeRatio: 0.35,
  scrollDivisor: 24,
  color: 'white',
}

export const DEFAULT_SETTINGS: KeymapSettings = {
  tappingTermMs: 200,
  flavor: 'balanced',
  bodyColor: 'white',
  escColor: DEFAULT_ESC_COLOR,
}

function fillSensorSlots(def: KeyboardDefinition, binding: Binding): Record<SensorId, SensorBindings> {
  return Object.fromEntries(bindableSensors(def).map((s) => [
    s.id,
    Object.fromEntries(SENSOR_SLOTS[s.kind].map((slot) => [slot, binding])),
  ]))
}

/** 白紙のレイヤー（キーもセンサーもすべて未割当） */
export function blankLayer(
  def: KeyboardDefinition, id: number,
  name = defaultLayerName(id), color: LayerColor = defaultLayerColor(id),
): Layer {
  return {
    id,
    name,
    color,
    keys: Object.fromEntries(def.keys.map((k) => [k.id, NONE])),
    sensors: fillSensorSlots(def, NONE),
  }
}

function layerFromSeed(def: KeyboardDefinition, seed: LayerSeed, id: number): Layer {
  if (!seed.keys) return blankLayer(def, id, seed.name, seed.color)
  const sensors: Record<SensorId, SensorBindings> = {}
  for (const [sid, slots] of Object.entries(seed.sensors ?? {})) sensors[sid] = { ...slots }
  return { id, name: seed.name, color: seed.color, keys: { ...seed.keys }, sensors }
}

/** そのキーボードの初期キーマップ */
export function createKeymap(def: KeyboardDefinition): Keymap {
  const seeds = def.defaultLayers ?? []
  const count = Math.min(MAX_LAYERS, Math.max(1, seeds.length, def.layerCount ?? 4))
  const layers = Array.from({ length: count }, (_, id) => (
    seeds[id] ? layerFromSeed(def, seeds[id], id) : blankLayer(def, id)
  ))
  return {
    version: 2,
    keyboard: def.id,
    // 組み込みに無いキーボードは、定義ごとキーマップに持たせる
    ...(isBuiltinKeyboard(def.id) ? {} : { keyboardDef: def }),
    name: def.defaultKeymapName ?? `${def.name} のキーマップ`,
    layers,
    combos: [],
    trackball: { ...DEFAULT_TRACKBALL },
    settings: { ...DEFAULT_SETTINGS },
  }
}

/* ---------------------------------------------------------------- 手元のキーボードからの読み替え */

/** キーコード → それを出す物理キーの event.code（最初に見つかったもの） */
const KEYCODE_TO_CODE = new Map<Keycode, string>()
for (const [code, kc] of Object.entries(CODE_TO_KEYCODE)) {
  if (!KEYCODE_TO_CODE.has(kc)) KEYCODE_TO_CODE.set(kc, code)
}

/**
 * 手元のキーボードの `event.code` → このキーボードの KeyId。
 * 定義に書かれた対応を優先し、残りのキーはベースレイヤー（L0）の割当が同じ物理キーに当てる
 * （L0 で A を出すキー ← 手元の A キー）。どの機種でも、文字キーはこれで自動的に打てる。
 */
export function buildCaptureMap(def: KeyboardDefinition, baseKeys: Record<KeyId, Binding> | undefined): Record<string, KeyId> {
  const map: Record<string, KeyId> = { ...def.capture }
  const mapped = new Set(Object.values(map))
  for (const k of def.keys) {
    if (mapped.has(k.id)) continue
    const tap = baseKeys?.[k.id]?.tap
    const code = tap ? KEYCODE_TO_CODE.get(tap) : undefined
    if (!code || code in map) continue
    map[code] = k.id
    mapped.add(k.id)
  }
  return map
}
