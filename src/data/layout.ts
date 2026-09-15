/**
 * Keychron Orca echo の物理レイアウト。
 *
 * 実機写真から起こした 49 キー（左 25 / 右 24）のカラムスタッガー配列。
 * 座標は「1 = キー 1 個分」のユニット。描画時に KEY_UNIT を掛ける。
 *
 *   左: 7 列 × 4 行 + 親指キー 1 + ロータリーエンコーダー + スクロールパッド
 *   右: 7 列 × 4 行 + 19mm トラックボール + スクロールパッド
 */

export type Half = 'L' | 'R'
export type KeyId = string

export interface KeyDef {
  id: KeyId
  half: Half
  col: number
  row: number
  /** 左上座標（ユニット） */
  x: number
  y: number
  w: number
  h: number
  kind: 'key' | 'thumb'
  /** 写真で esc だけオレンジのアクセントキーキャップ */
  accent?: boolean
}

export type SensorId = 'enc-l' | 'pad-l' | 'pad-r' | 'ball-r'

export interface SensorDef {
  id: SensorId
  half: Half
  kind: 'encoder' | 'pad' | 'ball'
  name: string
  short: string
  x: number
  y: number
  w: number
  h: number
}

export const KEY_UNIT = 54
export const KEY_GAP = 0.08

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

function build(half: Half, rows: number[][], stagger: number[]): KeyDef[] {
  const out: KeyDef[] = []
  rows.forEach((cols, row) => {
    for (const col of cols) {
      out.push({
        id: `${half}${row}${col}`,
        half,
        col,
        row,
        x: col,
        y: stagger[col] + row,
        w: 1,
        h: 1,
        kind: 'key',
      })
    }
  })
  return out
}

const leftGrid = build('L', ROWS_L, STAGGER_L)
const rightGrid = build('R', ROWS_R, STAGGER_R)

/** 左の親指キー（写真では fn1 の右下に張り出した大きめのキー） */
const leftThumb: KeyDef = {
  id: 'LT0', half: 'L', col: 5, row: 4,
  x: 4.62, y: 4.18, w: 1.15, h: 1, kind: 'thumb',
}

export const KEYS: readonly KeyDef[] = [
  ...leftGrid.map((k) => (k.id === 'L00' ? { ...k, accent: true } : k)), // esc をオレンジに
  leftThumb,
  ...rightGrid,
]

export const LEFT_KEYS = KEYS.filter((k) => k.half === 'L')
export const RIGHT_KEYS = KEYS.filter((k) => k.half === 'R')

export const SENSORS: readonly SensorDef[] = [
  {
    id: 'pad-l', half: 'L', kind: 'pad',
    name: '左スクロールパッド', short: 'PAD L',
    x: 6, y: 0.46, w: 1, h: 1.9,
  },
  {
    id: 'enc-l', half: 'L', kind: 'encoder',
    name: '左ロータリーエンコーダー', short: 'ENC',
    x: 5.85, y: 4.18, w: 0.62, h: 1.1,
  },
  {
    id: 'pad-r', half: 'R', kind: 'pad',
    name: '右スクロールパッド', short: 'PAD R',
    x: 0, y: 0.46, w: 1, h: 1.9,
  },
  {
    id: 'ball-r', half: 'R', kind: 'ball',
    name: '19mm トラックボール', short: 'BALL',
    x: 0.75, y: 4.02, w: 1.35, h: 1.35,
  },
]

export function getSensor(id: SensorId): SensorDef {
  const s = SENSORS.find((v) => v.id === id)
  if (!s) throw new Error(`unknown sensor: ${id}`)
  return s
}

const keyById = new Map<KeyId, KeyDef>(KEYS.map((k) => [k.id, k]))
export function getKey(id: KeyId): KeyDef | undefined {
  return keyById.get(id)
}

/** 盤面の外形サイズ（ユニット）。左右それぞれ。 */
export function halfExtent(half: Half) {
  const keys = KEYS.filter((k) => k.half === half)
  const sensors = SENSORS.filter((s) => s.half === half)
  const xs = [...keys.map((k) => k.x + k.w), ...sensors.map((s) => s.x + s.w)]
  const ys = [...keys.map((k) => k.y + k.h), ...sensors.map((s) => s.y + s.h)]
  // エンコーダーとトラックボールの脚注ラベルぶん、下に余白を足しておく
  return { w: Math.max(...xs), h: Math.max(...ys) + 0.34 }
}

/**
 * 手元の一般的なキーボードの `event.code` → Orca echo の KeyId 対応表。
 * シミュレーターはこれを通して「Orca echo だったらどう出力されるか」を解決する。
 */
export const CODE_TO_KEY: Record<string, KeyId> = {
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
