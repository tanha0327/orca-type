import { MAX_LAYERS, type Keycode } from './keycodes'
import {
  isValidKeymapShape, LAYER_COLORS, TRACKBALL_COLORS, ESC_COLORS,
  type Binding, type Combo, type Flavor, type Keymap, type KeymapSettings, type Layer,
  type LayerColor, type TrackballConfig,
} from './types'
import {
  DEFAULT_KEYBOARD, DEFAULT_SETTINGS, DEFAULT_TRACKBALL, defaultLayerColor, defaultLayerName,
  isBuiltinKeyboard,
} from '../keyboards/registry'
import {
  SENSOR_SLOTS,
  type Half, type KeyboardDefinition, type KeyDef, type LayerSeed, type SensorBindings,
  type SensorDef, type SensorKind, type SensorSlot,
} from '../keyboards/types'

/* ================================================================
   外から来たキーマップ・キーボード定義を取り込む前の正規化

   localStorage の古い保存データ、読み込んだ JSON ファイル、共有フィードの投稿は、
   どれも形を信用せずにここを通す。古い形（Orca echo 専用だった v1）はここで今の形に直す。
   ================================================================ */

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' ? v.slice(0, max) : undefined

/** キー・センサー・コンボの ID。オブジェクトのキーに使うので、プロトタイプを触る名前は通さない */
const ID_RE = /^[A-Za-z0-9_.:-]{1,48}$/
const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype'])
export const isSafeId = (v: unknown): v is string =>
  typeof v === 'string' && ID_RE.test(v) && !FORBIDDEN_IDS.has(v)

const KEYCODE_RE = /^[A-Za-z0-9_]{1,40}$/
const FLAVORS: Flavor[] = ['hold-preferred', 'balanced', 'tap-preferred']
const SENSOR_KINDS: SensorKind[] = ['encoder', 'pad', 'ball']

/** 定義に置けるキー・センサーの上限（巨大なデータで固まらないように） */
export const MAX_KEYS = 400
export const MAX_SENSORS = 16

/* ---------------------------------------------------------------- 割当 */

/** v1 で MO_1/MO_2/MO_3 と呼んでいたキーコードを fn1/fn2/fn3 の新コードへ */
const LEGACY_KEYCODE: Record<string, Keycode> = {
  MO_1: 'FN_1',
  MO_2: 'FN_2',
  MO_3: 'FN_3',
}

function keycode(v: unknown): Keycode | undefined {
  if (typeof v !== 'string' || !KEYCODE_RE.test(v)) return undefined
  return LEGACY_KEYCODE[v] ?? v
}

export function sanitizeBinding(v: unknown): Binding | undefined {
  if (!isObj(v)) return undefined
  const tap = keycode(v.tap)
  if (!tap) return undefined
  const hold = keycode(v.hold)
  return {
    tap,
    ...(hold ? { hold } : {}),
    ...(isNum(v.tappingTermMs, 0, 5000) ? { tappingTermMs: v.tappingTermMs } : {}),
    ...(FLAVORS.includes(v.flavor as Flavor) ? { flavor: v.flavor as Flavor } : {}),
  }
}

function sanitizeBindings(v: unknown): Record<string, Binding> {
  const out: Record<string, Binding> = {}
  if (!isObj(v)) return out
  for (const [id, raw] of Object.entries(v)) {
    if (!isSafeId(id)) continue
    const b = sanitizeBinding(raw)
    if (b) out[id] = b
  }
  return out
}

const ALL_SLOTS = new Set<string>(Object.values(SENSOR_SLOTS).flat())

function sanitizeSensorBindings(v: unknown): Record<string, SensorBindings> {
  const out: Record<string, SensorBindings> = {}
  if (!isObj(v)) return out
  for (const [id, slots] of Object.entries(v)) {
    if (!isSafeId(id) || !isObj(slots)) continue
    const s: SensorBindings = {}
    for (const [slot, raw] of Object.entries(slots)) {
      const b = ALL_SLOTS.has(slot) ? sanitizeBinding(raw) : undefined
      if (b) s[slot as SensorSlot] = b
    }
    out[id] = s
  }
  return out
}

const layerColor = (v: unknown, id: number): LayerColor =>
  LAYER_COLORS.includes(v as LayerColor) ? (v as LayerColor) : defaultLayerColor(id)

/* ---------------------------------------------------------------- キーボード定義 */

function sanitizeHalf(v: unknown): Half | undefined {
  return v === 'L' || v === 'R' ? v : undefined
}

function sanitizeKey(v: unknown): KeyDef | null {
  if (!isObj(v) || !isSafeId(v.id)) return null
  if (!isNum(v.x, -500, 500) || !isNum(v.y, -500, 500)) return null
  if (!isNum(v.w, 0.1, 30) || !isNum(v.h, 0.1, 30)) return null
  const k: KeyDef = { id: v.id, x: v.x, y: v.y, w: v.w, h: v.h }
  if (isNum(v.r, -360, 360) && v.r !== 0) {
    k.r = v.r
    k.rx = isNum(v.rx, -500, 500) ? v.rx : 0
    k.ry = isNum(v.ry, -500, 500) ? v.ry : 0
  }
  if (Array.isArray(v.matrix) && v.matrix.length === 2 && v.matrix.every((n) => isNum(n, 0, 255))) {
    k.matrix = [v.matrix[0] as number, v.matrix[1] as number]
  }
  const half = sanitizeHalf(v.half)
  if (half) k.half = half
  if (isNum(v.row, 0, 255)) k.row = Math.round(v.row)
  if (isNum(v.col, 0, 255)) k.col = Math.round(v.col)
  if (v.thumb === true) k.thumb = true
  if (v.accent === true) k.accent = true
  const legend = str(v.legend, 24)
  if (legend) k.legend = legend
  return k
}

function sanitizeSensor(v: unknown): SensorDef | null {
  if (!isObj(v) || !isSafeId(v.id) || !SENSOR_KINDS.includes(v.kind as SensorKind)) return null
  if (!isNum(v.x, -500, 500) || !isNum(v.y, -500, 500)) return null
  if (!isNum(v.w, 0.1, 30) || !isNum(v.h, 0.1, 30)) return null
  const kind = v.kind as SensorKind
  const s: SensorDef = {
    id: v.id,
    kind,
    name: str(v.name, 40)?.trim() || v.id,
    short: str(v.short, 12)?.trim() || v.id,
    x: v.x, y: v.y, w: v.w, h: v.h,
  }
  const half = sanitizeHalf(v.half)
  if (half) s.half = half
  return s
}

function sanitizeSeed(v: unknown, id: number): LayerSeed | null {
  if (!isObj(v)) return null
  return {
    name: str(v.name, 40) ?? defaultLayerName(id),
    color: layerColor(v.color, id),
    ...(v.keys !== undefined ? { keys: sanitizeBindings(v.keys) } : {}),
    ...(v.sensors !== undefined ? { sensors: sanitizeSensorBindings(v.sensors) } : {}),
  }
}

const HEX_ID_RE = /^0x[0-9A-Fa-f]{1,4}$/
const SOURCES = ['qmk', 'via', 'kle', 'zmk'] as const

/** キーボード定義として使える形なら、余計なものを落として返す。使えなければ null */
export function sanitizeKeyboardDefinition(v: unknown): KeyboardDefinition | null {
  if (!isObj(v) || !isSafeId(v.id)) return null
  const name = str(v.name, 80)?.trim()
  if (!name) return null
  if (!Array.isArray(v.keys) || v.keys.length === 0 || v.keys.length > MAX_KEYS) return null

  const keys: KeyDef[] = []
  const keyIds = new Set<string>()
  for (const raw of v.keys) {
    const k = sanitizeKey(raw)
    if (!k || keyIds.has(k.id)) return null
    keyIds.add(k.id)
    keys.push(k)
  }

  const sensors: SensorDef[] = []
  if (Array.isArray(v.sensors)) {
    const ids = new Set<string>()
    for (const raw of v.sensors.slice(0, MAX_SENSORS)) {
      const s = sanitizeSensor(raw)
      if (s && !ids.has(s.id)) { ids.add(s.id); sensors.push(s) }
    }
  }

  const def: KeyboardDefinition = {
    id: v.id,
    name,
    firmware: v.firmware === 'qmk' ? 'qmk' : 'zmk',
    keys,
  }
  const maker = str(v.maker, 80)?.trim()
  if (maker) def.maker = maker
  if (sensors.length > 0) def.sensors = sensors
  if (isNum(v.layerCount, 1, MAX_LAYERS)) def.layerCount = Math.round(v.layerCount)
  if (Array.isArray(v.defaultLayers)) {
    def.defaultLayers = v.defaultLayers.slice(0, MAX_LAYERS)
      .map((s, i) => sanitizeSeed(s, i))
      .filter((s): s is LayerSeed => !!s)
  }
  const kmName = str(v.defaultKeymapName, 80)?.trim()
  if (kmName) def.defaultKeymapName = kmName
  if (isObj(v.capture)) {
    const capture: Record<string, string> = {}
    for (const [code, keyId] of Object.entries(v.capture)) {
      if (/^[A-Za-z0-9]{1,32}$/.test(code) && typeof keyId === 'string' && keyIds.has(keyId)) capture[code] = keyId
    }
    def.capture = capture
  }
  if (typeof v.qmkLayout === 'string' && /^LAYOUT\w{0,60}$/.test(v.qmkLayout)) def.qmkLayout = v.qmkLayout
  const hashtag = str(v.hashtag, 40)
  if (hashtag && /^[\p{L}\p{N}_]+$/u.test(hashtag)) def.hashtag = hashtag
  if (isObj(v.usb) && typeof v.usb.vid === 'string' && typeof v.usb.pid === 'string'
    && HEX_ID_RE.test(v.usb.vid) && HEX_ID_RE.test(v.usb.pid)) {
    def.usb = { vid: v.usb.vid, pid: v.usb.pid }
  }
  if (SOURCES.includes(v.source as typeof SOURCES[number])) def.source = v.source as typeof SOURCES[number]
  return def
}

/* ---------------------------------------------------------------- キーマップ */

function normalizeLayer(v: unknown, id: number): Layer {
  const l = isObj(v) ? v : {}
  // v1（Orca echo 専用）はセンサーの割当を encoder / padL / padR に持っていた
  const sensors = l.sensors !== undefined
    ? sanitizeSensorBindings(l.sensors)
    : sanitizeSensorBindings({ 'enc-l': l.encoder, 'pad-l': l.padL, 'pad-r': l.padR })
  return {
    id,
    name: str(l.name, 40) ?? defaultLayerName(id),
    color: layerColor(l.color, id),
    keys: sanitizeBindings(l.keys),
    sensors,
  }
}

function normalizeCombo(v: unknown, layerCount: number): Combo | null {
  if (!isObj(v) || !isSafeId(v.id) || !Array.isArray(v.keys)) return null
  return {
    id: v.id,
    name: str(v.name, 40) ?? '',
    keys: v.keys.filter(isSafeId),
    binding: sanitizeBinding(v.binding) ?? { tap: 'NONE' },
    timeoutMs: isNum(v.timeoutMs, 1, 5000) ? v.timeoutMs : 50,
    layers: Array.isArray(v.layers)
      ? v.layers.filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < layerCount)
      : [0],
    enabled: v.enabled !== false,
  }
}

function normalizeTrackball(v: unknown): TrackballConfig {
  const t = isObj(v) ? v : {}
  const d = DEFAULT_TRACKBALL
  return {
    dpi: isNum(t.dpi, 1, 100000) ? t.dpi : d.dpi,
    angle: isNum(t.angle, -360, 360) ? t.angle : d.angle,
    invertX: typeof t.invertX === 'boolean' ? t.invertX : d.invertX,
    invertY: typeof t.invertY === 'boolean' ? t.invertY : d.invertY,
    snipeRatio: isNum(t.snipeRatio, 0, 10) ? t.snipeRatio : d.snipeRatio,
    scrollDivisor: isNum(t.scrollDivisor, 1, 1000) ? t.scrollDivisor : d.scrollDivisor,
    color: TRACKBALL_COLORS.includes(t.color as TrackballConfig['color']) ? t.color as TrackballConfig['color'] : d.color,
  }
}

function normalizeSettings(v: unknown): KeymapSettings {
  const s = isObj(v) ? v : {}
  const d = DEFAULT_SETTINGS
  return {
    tappingTermMs: isNum(s.tappingTermMs, 1, 5000) ? s.tappingTermMs : d.tappingTermMs,
    flavor: FLAVORS.includes(s.flavor as Flavor) ? s.flavor as Flavor : d.flavor,
    bodyColor: s.bodyColor === 'black' ? 'black' : 'white',
    escColor: ESC_COLORS.includes(s.escColor as NonNullable<KeymapSettings['escColor']>)
      ? s.escColor as NonNullable<KeymapSettings['escColor']>
      : d.escColor,
  }
}

/**
 * 外から来たキーマップを今の形にそろえる。使えない形なら null。
 * キーボードの指定が無ければ（v1 の保存データ）Orca echo のキーマップとみなす。
 * 組み込みに無いキーボードで、定義も同梱されていなければ、盤面を描けないので null。
 */
export function normalizeKeymap(v: unknown): Keymap | null {
  if (!isValidKeymapShape(v)) return null
  const raw = v as unknown as Obj & { layers: unknown[]; combos: unknown[] }

  const embedded = raw.keyboardDef !== undefined ? sanitizeKeyboardDefinition(raw.keyboardDef) : null
  const keyboard = isSafeId(raw.keyboard) ? raw.keyboard : (embedded?.id ?? DEFAULT_KEYBOARD.id)
  const builtin = isBuiltinKeyboard(keyboard)
  if (!builtin && (!embedded || embedded.id !== keyboard)) return null

  const layers = raw.layers.slice(0, MAX_LAYERS).map((l, i) => normalizeLayer(l, i))
  if (layers.length === 0) return null

  return {
    version: 2,
    keyboard,
    ...(!builtin && embedded ? { keyboardDef: embedded } : {}),
    name: str(raw.name, 80) ?? 'キーマップ',
    layers,
    combos: raw.combos
      .map((c) => normalizeCombo(c, layers.length))
      .filter((c): c is Combo => !!c),
    trackball: normalizeTrackball(raw.trackball),
    settings: normalizeSettings(raw.settings),
  }
}
