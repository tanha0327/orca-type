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
 * 実物のキースイッチ 3D モデル（前面図）を単純化して輪郭線だけにしたパス。
 * shapely で三角メッシュの投影シルエットを取り、Douglas-Peucker で間引いた座標。
 */
const SWITCH_SILHOUETTE_PATH = 'M 15.78 35.40 L 15.78 33.31 L 16.31 33.31 L 19.29 22.85 L 27.82 22.32 L 27.82 15.00 '
  + 'L 36.18 15.00 L 36.18 22.32 L 44.70 22.85 L 47.69 33.31 L 48.22 33.31 L 48.22 35.40 L 46.65 35.40 L 46.65 38.76 '
  + 'L 44.62 43.77 L 43.51 43.77 L 43.25 49.00 L 41.67 49.00 L 41.42 43.77 L 36.18 43.77 L 36.18 47.95 L 35.14 49.00 '
  + 'L 28.86 49.00 L 27.82 47.95 L 27.82 43.77 L 22.58 43.77 L 22.32 49.00 L 20.75 49.00 L 20.49 43.77 L 19.41 43.77 '
  + 'L 17.35 38.69 L 17.35 35.40 L 15.78 35.40 Z'

/** キースイッチの線画アイコン（軸の色を背景に、線はインクカラー） */
function switchAvatar(bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect x="4" y="4" width="56" height="56" rx="14" fill="${bg}" stroke="#111111" stroke-width="5"/>`
    + `<path d="${SWITCH_SILHOUETTE_PATH}" fill="none" stroke="#111111" stroke-width="3.4" `
    + `stroke-linejoin="round" stroke-linecap="round"/></svg>`
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
  { id: 'switch-red', label: 'いろは赤軸', url: switchAvatar('#ef4444') },
  { id: 'switch-blue', label: 'いろは青軸', url: switchAvatar('#3b82f6') },
  { id: 'switch-brown', label: 'いろは茶軸', url: switchAvatar('#a9663e') },
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
