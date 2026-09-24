/**
 * プロフィール設定モーダルで出すサンプル。
 * アイコンは実際の画像を用意してもらうまでのプレースホルダー（キーキャップ風の即席 SVG）。
 * 名前は「よかったら採用する」用の候補で、決定ではない。
 */

function keycapAvatar(bg: string, glyph: string, fg = '#111111'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect x="4" y="4" width="56" height="56" rx="14" fill="${bg}" stroke="${fg}" stroke-width="5"/>`
    + `<text x="32" y="41" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" `
    + `text-anchor="middle" fill="${fg}">${glyph}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * 実物のキースイッチ 3D モデルを正面から見たシルエット。
 * trimesh でハウジング（上下まとめて）／軸（ステム）に分離し、
 * 正面投影（X-Z平面）で shapely により三角メッシュを結合、
 * Douglas-Peucker で単純化した。
 *
 * 以前は斜め見下ろし（アイソメ）視点で3面を塗り分けていたが、線が多く
 * 「一発でキースイッチとわかる」形として見づらいとの指摘があったため、
 * 正面シルエット1本にして輪郭を強調する形に変更。軸（ステム）はハウジングに
 * 隠れる部分を shapely の差分（difference）で切り取り、実際に飛び出して
 * 見える部分だけを色付きで表示している。
 */
const SWITCH_HOUSING_PATH = 'M 17.18 45.85 L 14.77 39.87 L 14.77 36.00 L 12.92 36.00 L 12.92 33.54 L 13.54 33.54 L 17.05 21.23 L 46.94 21.23 L 50.46 33.54 L 51.08 33.54 L 51.08 36.00 L 49.23 36.00 L 49.23 39.96 L 46.85 45.85 L 45.54 45.85 L 45.24 52.00 L 43.38 52.00 L 43.08 45.85 L 36.92 45.85 L 36.92 50.77 L 35.69 52.00 L 28.31 52.00 L 27.08 50.77 L 27.08 45.85 L 20.92 45.85 L 20.62 52.00 L 18.77 52.00 L 18.46 45.85 L 17.18 45.85 Z'

/** 軸（ステム）のうち、ハウジングから飛び出して見える部分だけ */
const SWITCH_STEM_PATH = 'M 24.43 20.62 L 27.08 20.62 L 27.08 12.00 L 36.92 12.00 L 36.92 20.62 L 39.57 20.62 L 40.19 21.23 L 23.81 21.23 L 24.43 20.62 Z'

const SWITCH_HOUSING_COLOR = '#e8e2d0'

/** 軸（ステム）だけが軸色を持つ */
const SWITCH_STEM_COLORS: Record<'red' | 'blue' | 'brown', string> = {
  red: '#ea3f30',
  blue: '#3170ea',
  brown: '#b8752f',
}

/** キースイッチの正面シルエットアイコン。線は黒・細めで輪郭を強調し、軸だけ赤・青・茶に色分け */
function switchAvatar(axis: keyof typeof SWITCH_STEM_COLORS, bg = '#faf7f0'): string {
  const layer = (d: string, fill: string) =>
    `<path d="${d}" fill="${fill}" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect x="4" y="4" width="56" height="56" rx="14" fill="${bg}" stroke="#111111" stroke-width="4"/>`
    + layer(SWITCH_HOUSING_PATH, SWITCH_HOUSING_COLOR)
    + layer(SWITCH_STEM_PATH, SWITCH_STEM_COLORS[axis])
    + `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export interface SampleAvatar {
  id: string
  label: string
  url: string
}

/** キーボードのキーをモチーフにしたサンプルアイコン */
export const SAMPLE_AVATARS: SampleAvatar[] = [
  { id: 'cmd', label: 'コマンド', url: keycapAvatar('#7b5cff', '⌘', '#faf7f0') },
  { id: 'enter', label: 'エンター', url: keycapAvatar('#a8e10c', '⏎') },
  { id: 'shift', label: 'シフト', url: keycapAvatar('#ff3d71', '⇧', '#faf7f0') },
  { id: 'fn', label: 'ファンクション', url: keycapAvatar('#fb923c', 'Fn') },
  { id: 'option', label: 'オプション', url: keycapAvatar('#38bdf8', '⌥') },
  { id: 'space', label: 'スペース', url: keycapAvatar('#f6ce7c', '␣') },
  { id: 'ctrl', label: 'コントロール', url: keycapAvatar('#22c55e', '⌃') },
  { id: 'delete', label: 'デリート', url: keycapAvatar('#ff3d71', '⌫', '#faf7f0') },
  { id: 'star', label: 'アクセント', url: keycapAvatar('#111111', '✦', '#faf7f0') },
  { id: 'ball', label: 'トラックボール', url: keycapAvatar('#9ca3af', '◍') },
  { id: 'switch-red', label: 'いろは赤軸', url: switchAvatar('red') },
  { id: 'switch-blue', label: 'いろは青軸', url: switchAvatar('blue') },
  { id: 'switch-brown', label: 'いろは茶軸', url: switchAvatar('brown') },
]

/** 名前を決めかねている人向けの候補（約20種） */
export const SAMPLE_NAMES: string[] = [
  'はやおしオルカ',
  'コトコト打鍵士',
  '静音キーマスター',
  '秒速タイパー',
  'シャチのキーボーダー',
  '連打の名手',
  'トラックボール遣い',
  'レイヤー職人',
  'コンボ設計士',
  '深海のタイピスト',
  '潜行オルカ',
  'カチカチ探検隊',
  'ホームポジション番長',
  'ミスタイプ撲滅委員',
  '打鍵音マニア',
  '配列コレクター',
  'ノーミス航海士',
  'キーキャップ愛好家',
  '高速シャチ',
  'サイレントタイパー',
]
