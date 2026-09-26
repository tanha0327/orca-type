/**
 * keyboard-layout-editor（KLE）の Raw data を、キーの位置と印字の一覧に直す。
 * VIA / Vial の定義ファイル（layouts.keymap）も同じ形式。
 *
 * 位置の決め方は KLE 本体（serial.js）と同じ。rx / ry が出てきたら、x と y を回転の中心に戻す
 * （npm の kle-serial はここを戻さないが、データを作っている KLE 本体の読み方に合わせる）。
 */

export interface KleKey {
  x: number
  y: number
  w: number
  h: number
  r: number
  rx: number
  ry: number
  /**
   * 印字。添字は KLE の正規化後の位置
   * （0 左上 / 1 中上 / 2 右上 / 3 左中 / 4 中央 / 5 右中 / 6 左下 / 7 中下 / 8 右下 / 9〜11 手前）
   */
  labels: string[]
  decal: boolean
  ghost: boolean
}

export interface KleLayout {
  meta: Record<string, unknown>
  keys: KleKey[]
}

/**
 * 保存形式の印字の並び → 正規化後の位置。揃え（a）ごとに違う。
 * @ijprest/kle-serial の labelMap と同じ表。
 */
const LABEL_MAP: number[][] = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10], // 0 = no centering
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10], // 1 = center x
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10], // 2 = center y
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10], // 3 = center x & y
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1], // 4 = center front (default)
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1], // 5 = center front & x
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1], // 6 = center front & y
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1], // 7 = center front & x & y
]

function reorderLabels(raw: string[], align: number): string[] {
  const map = LABEL_MAP[align] ?? LABEL_MAP[4]
  const out: string[] = []
  raw.forEach((label, i) => {
    const to = map[i]
    if (label && to !== undefined && to >= 0) out[to] = label
  })
  return out
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

/** initialAlign: KLE 本体は 4、VIA の読み込みは 0 から始める */
export function parseKle(rows: unknown, initialAlign = 4): KleLayout {
  if (!Array.isArray(rows)) throw new Error('KLE のデータは配列です')

  let meta: Record<string, unknown> = {}
  const keys: KleKey[] = []
  const current = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, decal: false, ghost: false }
  const cluster = { x: 0, y: 0 }
  let align = initialAlign

  rows.forEach((row, r) => {
    if (!Array.isArray(row)) {
      if (r === 0 && row && typeof row === 'object') meta = row as Record<string, unknown>
      return
    }
    for (const item of row) {
      if (typeof item === 'string') {
        keys.push({
          x: current.x, y: current.y, w: current.w, h: current.h,
          r: current.r, rx: current.rx, ry: current.ry,
          labels: reorderLabels(item.split('\n'), align),
          decal: current.decal, ghost: current.ghost,
        })
        current.x += current.w
        current.w = 1
        current.h = 1
        current.decal = false
        continue
      }
      if (!item || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      const rot = num(p.r)
      const rx = num(p.rx)
      const ry = num(p.ry)
      if (rot !== undefined) current.r = rot
      if (rx !== undefined) { current.rx = cluster.x = rx; current.x = cluster.x; current.y = cluster.y }
      if (ry !== undefined) { current.ry = cluster.y = ry; current.x = cluster.x; current.y = cluster.y }
      const a = num(p.a)
      if (a !== undefined) align = a
      current.x += num(p.x) ?? 0
      current.y += num(p.y) ?? 0
      const w = num(p.w)
      const h = num(p.h)
      if (w) current.w = w
      if (h) current.h = h
      if (p.d) current.decal = true
      if (p.g !== undefined) current.ghost = !!p.g
    }
    // 行の終わり
    current.y += 1
    current.x = current.rx
  })

  return { meta, keys }
}

/** KLE の印字に混ざる HTML を落として、ただの文字にする */
export function plainLabel(label: string | undefined): string {
  if (!label) return ''
  return label
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}
