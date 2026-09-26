import { NONE, bind, type Binding } from '../../data/types'
import { sanitizeKeyboardDefinition } from '../../data/normalize'
import { boardBounds, keyCenter } from '../geometry'
import type {
  Firmware, Half, KeyboardDefinition, KeyDef, KeyId, SensorDef,
} from '../types'
import { parseKle, plainLabel, type KleKey } from './kle'
import { guessKeycode } from './legends'
import { parseLenientJson } from './lenientJson'

/* ================================================================
   キーボード定義の取り込み

   自作キーボードの配列は、ほぼどれかの形で公開されている。
     - QMK:  keyboards/<name>/info.json・keyboard.json の layouts
     - VIA / Vial: 定義 JSON（layouts.keymap が KLE 形式）
     - KLE:  keyboard-layout-editor の Raw data / JSON
     - ZMK:  physical layout（&key_physical_attrs を並べた .dtsi）
   どれを貼っても KeyboardDefinition に直せるようにしておけば、機種ごとに定義を書かなくても使える。
   ================================================================ */

export type ImportFormat = 'qmk' | 'via' | 'kle' | 'zmk' | 'definition'

export const IMPORT_FORMAT_LABEL: Record<ImportFormat, string> = {
  qmk: 'QMK info.json / keyboard.json',
  via: 'VIA / Vial 定義 JSON',
  kle: 'keyboard-layout-editor (KLE)',
  zmk: 'ZMK physical layout',
  definition: 'ORCA MAP キーボード定義',
}

export interface ImportCandidate {
  /** 同じファイルに複数の配列があるときの呼び名（LAYOUT_split_3x6_3 など） */
  label: string
  def: KeyboardDefinition
}

export interface ImportResult {
  format: ImportFormat
  candidates: ImportCandidate[]
  /** 最初に選んでおく候補 */
  defaultIndex: number
}

/** 取り込んだ 1 キーぶんの素の情報 */
interface RawKey {
  x: number
  y: number
  w: number
  h: number
  r?: number
  rx?: number
  ry?: number
  matrix?: [number, number]
  /** 印字の候補（推測に使う順） */
  legends: string[]
}

interface RawSensor {
  kind: SensorDef['kind']
  half?: Half
  /** 取り込み元に位置があれば（VIA のエンコーダーなど） */
  rect?: { x: number; y: number; w: number; h: number }
}

interface BuildInput {
  name: string
  source: NonNullable<KeyboardDefinition['source']>
  firmware: Firmware
  keys: RawKey[]
  /** 分割キーボードか（わからなければ undefined で、キーの並びのすき間から推測する） */
  split?: boolean
  sensors?: RawSensor[]
  usb?: { vid: string; pid: string }
  /** QMK の LAYOUT マクロ名 */
  qmkLayout?: string
  /**
   * キーの並びがファームウェアの順ではない（VIA / KLE は見た目の都合で並んでいる）。
   * マトリクス位置があれば、書き出しに使えるよう段ごと・左から右の順に並べ直す
   */
  visualOrder?: boolean
}

/* ---------------------------------------------------------------- 入口 */

/**
 * 貼り付けたテキスト（またはファイルの中身）を読み、形式を見分けてキーボード定義にする。
 * 読めなければ、理由を書いた Error を投げる。
 */
export function importKeyboard(text: string, fileName = ''): ImportResult {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

  if (/&key_physical_attrs\b/.test(text)) return fromZmk(text, baseName)

  let data: unknown
  try {
    data = parseLenientJson(text)
  } catch (e) {
    throw new Error(`読めない形式です（${e instanceof Error ? e.message : 'JSON として読めません'}）`)
  }

  if (Array.isArray(data)) return fromKle(data, baseName)
  if (isObj(data)) {
    if (isObj(data.layouts) && Array.isArray(data.layouts.keymap)) return fromVia(data, baseName)
    if (isObj(data.layouts)) return fromQmk(data, baseName)
    if (Array.isArray(data.keys) && typeof data.name === 'string') return fromDefinition(data)
    if (Array.isArray(data.layers) && Array.isArray(data.combos)) {
      throw new Error('これはキーマップの JSON です。「書き出し」画面の「JSON を読み込む」から読み込んでください')
    }
  }
  throw new Error('キーボードの配列が見つかりません。QMK の info.json、VIA の定義 JSON、KLE の Raw data、ZMK の physical layout に対応しています')
}

/* ---------------------------------------------------------------- QMK */

function fromQmk(info: Obj, baseName: string): ImportResult {
  const layouts = Object.entries(info.layouts as Obj)
    .filter(([, v]) => isObj(v) && Array.isArray(v.layout) && v.layout.length > 0)
  if (layouts.length === 0) throw new Error('info.json に layouts がありません')

  const name = str(info.keyboard_name) || baseName || 'QMK キーボード'
  const split = isObj(info.split) ? info.split.enabled !== false : undefined
  const sensors = qmkEncoders(info, !!split)
  const usb = isObj(info.usb) && typeof info.usb.vid === 'string' && typeof info.usb.pid === 'string'
    ? { vid: info.usb.vid, pid: info.usb.pid }
    : undefined

  const candidates = layouts.map(([layoutName, v]) => {
    const keys: RawKey[] = ((v as Obj).layout as unknown[]).filter(isObj).map((k) => ({
      x: numOr(k.x, 0),
      y: numOr(k.y, 0),
      w: numOr(k.w, 1),
      h: numOr(k.h, 1),
      ...rotation(k.r, k.rx, k.ry),
      ...(isMatrix(k.matrix) ? { matrix: k.matrix } : {}),
      legends: typeof k.label === 'string' ? [k.label] : [],
    }))
    return {
      label: layoutName,
      def: build({ name, source: 'qmk', firmware: 'qmk', keys, split, sensors, usb, qmkLayout: layoutName }, layoutName),
    }
  })

  // 「LAYOUT」があればそれ、無ければ（全部入りの LAYOUT_all を除いて）いちばんキーの多い配列
  const plain = candidates.findIndex((c) => c.label === 'LAYOUT')
  const pool = candidates.filter((c) => c.label !== 'LAYOUT_all')
  const biggest = (pool.length > 0 ? pool : candidates)
    .reduce((a, b) => (b.def.keys.length > a.def.keys.length ? b : a))
  return { format: 'qmk', candidates, defaultIndex: plain >= 0 ? plain : candidates.indexOf(biggest) }
}

/** QMK の encoder 設定からエンコーダーの数を数える（分割の右手側は、別指定が無ければ左手と同じ数） */
function qmkEncoders(info: Obj, split: boolean): RawSensor[] {
  const count = (v: unknown) => (isObj(v) && Array.isArray(v.rotary) ? v.rotary.length : 0)
  const left = count(info.encoder)
  const rightSpec = isObj(info.split) && isObj(info.split.encoder) ? info.split.encoder.right : undefined
  const right = split ? (rightSpec !== undefined ? count(rightSpec) : left) : 0
  return [
    ...Array.from({ length: left }, () => ({ kind: 'encoder' as const, half: split ? 'L' as const : undefined })),
    ...Array.from({ length: right }, () => ({ kind: 'encoder' as const, half: 'R' as const })),
  ]
}

/* ---------------------------------------------------------------- VIA / Vial */

/**
 * 読み方は VIA 本体（@the-via/reader の kle-parser）に合わせる。
 *   左上 = 「行,列」 / 右下 = 「配列オプション番号,選択肢」 / 中央 = 「e0」のようなエンコーダー番号
 */
function fromVia(via: Obj, baseName: string): ImportResult {
  const { keys: kle } = parseKle((via.layouts as Obj).keymap, 0)
  const keys: RawKey[] = []
  const encoders = new Map<number, { key: KleKey; clickable: boolean }>()

  for (const k of kle) {
    if (k.decal || k.ghost) continue
    // 既定の選択肢（0）以外の配列オプションは取り込まない（VIA も最初は 0 を選んだ状態で表示する）
    const option = /^(\d+)\s*[,，]\s*(\d+)$/.exec(plainLabel(k.labels[8]))
    if (option && option[2] !== '0') continue
    const enc = /^[eE](\d+)$/.exec(plainLabel(k.labels[4]))
    const hasMatrix = /^\d+\s*[,，]\s*\d+$/.test(plainLabel(k.labels[0]))
    if (enc) {
      const idx = Number(enc[1])
      if (!encoders.has(idx)) encoders.set(idx, { key: k, clickable: hasMatrix })
      // 行,列 も書いてあるエンコーダーは押し込みがキーとしても使える
      if (!hasMatrix) continue
    }
    keys.push(kleRawKey(k))
  }
  if (keys.length === 0) throw new Error('VIA の定義にキーがありません')

  const vid = hexId(via.vendorId)
  const pid = hexId(via.productId)
  const name = str(via.name) || baseName || 'VIA キーボード'
  // 押し込みキーと重なる位置には置けないので、押し込みのあるエンコーダーは盤面の下に並べる
  const sensors: RawSensor[] = [...encoders.entries()].sort(([a], [b]) => a - b).map(([, e]) => ({
    kind: 'encoder' as const,
    ...(e.clickable || e.key.r ? {} : { rect: { x: e.key.x, y: e.key.y, w: e.key.w, h: e.key.h } }),
  }))
  const def = build({
    name, source: 'via', firmware: 'qmk', keys, sensors, visualOrder: true,
    ...(vid && pid ? { usb: { vid, pid } } : {}),
  })
  return { format: 'via', candidates: [{ label: name, def }], defaultIndex: 0 }
}

/* ---------------------------------------------------------------- KLE */

function fromKle(rows: unknown[], baseName: string): ImportResult {
  const { meta, keys: kle } = parseKle(rows)
  const keys = kle.filter((k) => !k.decal && !k.ghost).map(kleRawKey)
  if (keys.length === 0) throw new Error('KLE のデータにキーがありません')
  const name = str(meta.name) || baseName || 'KLE キーボード'
  const def = build({ name, source: 'kle', firmware: 'qmk', keys, visualOrder: true })
  return { format: 'kle', candidates: [{ label: name, def }], defaultIndex: 0 }
}

function kleRawKey(k: KleKey): RawKey {
  const labels = k.labels.map(plainLabel)
  // 左上が「行,列」ならマトリクス位置（VIA や QMK 向けの KLE）で、印字ではない
  const m = /^(\d+)\s*[,，]\s*(\d+)$/.exec(labels[0] ?? '')
  return {
    x: k.x, y: k.y, w: k.w, h: k.h,
    ...rotation(k.r, k.rx, k.ry),
    ...(m ? { matrix: [Number(m[1]), Number(m[2])] as [number, number] } : {}),
    // 2 段印字（! と 1）は Shift なしの下段を先に見る
    legends: m ? [] : [labels[6], labels[0], labels[4], ...labels].filter((l): l is string => !!l),
  }
}

/* ---------------------------------------------------------------- ZMK */

function fromZmk(source: string, baseName: string): ImportResult {
  // コメントを落としてから読む
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  const marker = /compatible\s*=\s*"zmk,physical-layout"/g
  const starts = [...text.matchAll(marker)].map((m) => m.index ?? 0)
  const segments = starts.length > 0
    ? starts.map((at, i) => ({ at, body: text.slice(at, starts[i + 1] ?? text.length) }))
    : [{ at: 0, body: text }]

  const sensors = zmkSensors(text)
  const candidates: ImportCandidate[] = []
  for (const seg of segments) {
    const keysProp = /\bkeys\s*=([^;]*);/.exec(seg.body)?.[1] ?? seg.body
    const keys: RawKey[] = [...keysProp.matchAll(/&key_physical_attrs((?:\s+\(?\s*-?\d+\s*\)?){7})/g)]
      .map((m) => {
        const [w, h, x, y, r, rx, ry] = (m[1].match(/-?\d+/g) ?? []).map((n) => Number(n) / 100)
        return { x, y, w, h, ...rotation(r, rx, ry), legends: [] }
      })
    if (keys.length === 0) continue

    // ノードのラベル（foostan_corne_6col_layout: ... {）と display-name から呼び名を作る
    const before = text.slice(0, seg.at)
    const nodeLabel = [...before.matchAll(/([A-Za-z_][\w]*)\s*:\s*[\w-]+\s*\{/g)].pop()?.[1] ?? ''
    const display = /display-name\s*=\s*"([^"]*)"/.exec(seg.body)?.[1] ?? ''
    const pretty = nodeLabel.replace(/_layout$/, '').replace(/_/g, ' ').trim()
    const name = pretty || baseName || 'ZMK キーボード'
    const label = [pretty, display && `（${display}）`].filter(Boolean).join(' ') || name
    candidates.push({ label, def: build({ name, source: 'zmk', firmware: 'zmk', keys, sensors }, label) })
  }
  if (candidates.length === 0) throw new Error('&key_physical_attrs からキーを読み取れませんでした')
  return { format: 'zmk', candidates, defaultIndex: 0 }
}

/** zmk,keymap-sensors の sensors = <&left_encoder &right_encoder> を数える（貼ってあれば） */
function zmkSensors(text: string): RawSensor[] {
  const at = text.search(/"zmk,keymap-sensors"/)
  if (at < 0) return []
  const list = /\bsensors\s*=\s*<([^>]*)>/.exec(text.slice(at))?.[1] ?? ''
  return (list.match(/&[\w-]+/g) ?? []).map((ref) => ({
    kind: 'encoder' as const,
    half: /left/i.test(ref) ? 'L' as const : /right/i.test(ref) ? 'R' as const : undefined,
  }))
}

/* ---------------------------------------------------------------- ORCA MAP の定義 JSON */

function fromDefinition(data: Obj): ImportResult {
  const def = sanitizeKeyboardDefinition(data)
  if (!def) throw new Error('キーボード定義の形が正しくありません')
  // 組み込みと同じ ID を名乗れないよう、取り込んだものは必ず custom: の ID にする
  const own = def.id.startsWith('custom:') ? def : { ...def, id: customId(def.name, def.keys) }
  return { format: 'definition', candidates: [{ label: own.name, def: own }], defaultIndex: 0 }
}

/* ---------------------------------------------------------------- 定義を組み立てる */

function build(input: BuildInput, variant?: string): KeyboardDefinition {
  if (input.keys.length === 0) throw new Error('キーがありません')

  // マトリクス位置が全部そろっていて重ならなければ、それを ID にする（取り込み直しても ID が変わらない）
  const matrixIds = input.keys.map((k) => (k.matrix ? `m${k.matrix[0]}_${k.matrix[1]}` : ''))
  const useMatrix = matrixIds.every(Boolean) && new Set(matrixIds).size === matrixIds.length

  let keys: KeyDef[] = input.keys.map((k, i) => ({
    id: useMatrix ? matrixIds[i] : `k${i}`,
    x: round(k.x), y: round(k.y), w: round(k.w), h: round(k.h),
    ...(k.r ? { r: round(k.r), rx: round(k.rx ?? 0), ry: round(k.ry ?? 0) } : {}),
    ...(k.matrix ? { matrix: k.matrix } : {}),
    ...(k.legends[0] ? { legend: k.legends[0].slice(0, 24) } : {}),
  }))

  const halves = inferHalves(keys, input)
  if (halves) keys = keys.map((k, i) => ({ ...k, half: halves[i] }))

  let raws = input.keys
  if (input.visualOrder && keys.every((k) => k.matrix)) {
    // 分割キーボードは右手が後半の行なので、左右で同じ段を 1 段として扱う（QMK の LAYOUT の並び）
    const rows = Math.max(...keys.map((k) => k.matrix![0])) + 1
    const rowOf = (k: KeyDef) => (halves ? k.matrix![0] % Math.ceil(rows / 2) : k.matrix![0])
    const order = keys.map((_, i) => i).sort((a, b) => (
      rowOf(keys[a]) - rowOf(keys[b]) || keyCenter(keys[a])[0] - keyCenter(keys[b])[0]
    ))
    keys = order.map((i) => keys[i])
    raws = order.map((i) => input.keys[i])
  }

  const def: KeyboardDefinition = {
    id: customId(variant ? `${input.name} ${variant}` : input.name, keys),
    name: input.name.slice(0, 80),
    firmware: input.firmware,
    keys,
    layerCount: 4,
    source: input.source,
    ...(input.usb ? { usb: input.usb } : {}),
    ...(input.qmkLayout ? { qmkLayout: input.qmkLayout } : {}),
  }
  const sensors = placeSensors(def, input.sensors ?? [])
  if (sensors.length > 0) def.sensors = sensors

  // 印字からベースレイヤーの下書きを作る（読めなかったキーは未割当）
  const center = boardCenterX(def)
  const base: Record<KeyId, Binding> = {}
  raws.forEach((raw, i) => {
    const k = keys[i]
    const right = k.half ? k.half === 'R' : keyCenter(k)[0] > center
    const code = guessKeycode(raw.legends, right)
    base[k.id] = code ? bind(code) : NONE
  })
  def.defaultLayers = [{ name: 'BASE', color: 'gray', keys: base }]

  const clean = sanitizeKeyboardDefinition(def)
  if (!clean) throw new Error('取り込んだ配列が大きすぎるか、座標が正しくありません')
  return clean
}

/** 分割キーボードの左右。マトリクスの行（分割は右手が後半の行）→ キーの並びの大きなすき間 の順で決める */
function inferHalves(keys: KeyDef[], input: BuildInput): Half[] | null {
  if (input.split === false) return null
  const rows = keys.map((k) => k.matrix?.[0])
  if (input.split && rows.every((r) => r !== undefined)) {
    const total = Math.max(...(rows as number[])) + 1
    return rows.map((r) => ((r as number) >= total / 2 ? 'R' : 'L'))
  }
  const xs = keys.map((k) => keyCenter(k)[0])
  const sorted = [...xs].sort((a, b) => a - b)
  let gap = 0
  let at = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > gap) { gap = sorted[i] - sorted[i - 1]; at = (sorted[i] + sorted[i - 1]) / 2 }
  }
  // キーの中心どうしが 1.4u 以上離れている縦のすき間があり、左右どちらにも 2 割以上のキーがあれば分割とみなす
  const leftCount = xs.filter((x) => x < at).length
  if (gap < 1.4 || leftCount < keys.length * 0.2 || leftCount > keys.length * 0.8) return null
  return xs.map((x) => (x < at ? 'L' : 'R'))
}

/** 位置のわからないセンサー（エンコーダーなど）は、盤面の下に左右に分けて並べる */
function placeSensors(def: KeyboardDefinition, raw: RawSensor[]): SensorDef[] {
  if (raw.length === 0) return []
  const b = boardBounds(def)
  const y = b.minY + b.h + 0.3
  const size = 0.8
  let left = 0
  let right = 0
  return raw.map((s, i) => {
    const side = s.half === 'L' ? '左' : s.half === 'R' ? '右' : ''
    const rect = s.rect ?? {
      x: s.half === 'R' ? b.minX + b.w - size - right++ * 1.1 : b.minX + left++ * 1.1,
      y,
      w: size,
      h: size,
    }
    return {
      id: `enc${i}`,
      kind: s.kind,
      name: `${side}エンコーダー ${i + 1}`,
      short: `ENC${i + 1}`,
      ...(s.half ? { half: s.half } : {}),
      x: round(rect.x), y: round(rect.y), w: round(rect.w), h: round(rect.h),
    }
  })
}

function boardCenterX(def: KeyboardDefinition): number {
  const b = boardBounds({ ...def, sensors: undefined })
  return b.minX + b.w / 2
}

/* ---------------------------------------------------------------- 小道具 */

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const numOr = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const round = (n: number) => Math.round(n * 1000) / 1000
const isMatrix = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0)

function rotation(r: unknown, rx: unknown, ry: unknown): Pick<RawKey, 'r' | 'rx' | 'ry'> {
  const angle = numOr(r, 0)
  return angle ? { r: angle, rx: numOr(rx, 0), ry: numOr(ry, 0) } : {}
}

function hexId(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffff) return `0x${v.toString(16).toUpperCase().padStart(4, '0')}`
  if (typeof v === 'string' && /^0x[0-9a-f]{1,4}$/i.test(v)) return v
  return undefined
}

/** 名前と配列から、取り込み直しても同じになる ID を作る */
export function customId(name: string, keys: readonly KeyDef[]): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'keyboard'
  const geometry = keys.map((k) => `${k.x},${k.y},${k.w},${k.h},${k.r ?? 0}`).join(';')
  let h = 0x811c9dc5
  for (let i = 0; i < geometry.length; i++) {
    h ^= geometry.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `custom:${slug}-${h.toString(16).padStart(8, '0')}`
}
