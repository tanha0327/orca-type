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
 * 実物のキースイッチ 3D モデルを斜め上（アイソメ視点）から見て、
 * 上面・左面・右面の3面が見えるように投影したパス。
 * trimesh でハウジング／軸（ステム）のパーツに分離し、面ごと（top / left / right）
 * に shapely で三角メッシュを結合、Douglas-Peucker で単純化した。
 *
 * フラットアイコン風の参考画像に合わせ、ハウジングは単色（ネイビー）＋白い輪郭線、
 * 軸（ステム）だけ赤軸・青軸・茶軸の色を乗せるスタイルに変更。面ごとの塗り分けを
 * やめて白線だけで面の境界を表すことで、暗い色同士が輪郭線に埋もれて見づらくなる
 * 問題を避けている。
 */
type SwitchShade = 'top' | 'right' | 'left'
interface SwitchLayerPath { shade: SwitchShade, d: string }

/** ハウジング（上下まとめて1色のネイビー） */
const SWITCH_HOUSING_PATHS: SwitchLayerPath[] = [
  { shade: 'left', d: 'M 14.30 41.04 L 10.52 31.35 L 18.12 35.73 L 17.04 28.47 L 18.57 29.36 L 18.95 36.21 L 20.48 37.09 L 20.48 31.35 L 31.58 37.76 L 31.58 31.59 L 33.83 32.89 L 34.26 39.30 L 32.76 51.69 L 31.20 50.79 L 31.20 47.48 L 30.81 51.02 L 14.30 41.04 Z M 30.81 45.27 L 31.20 45.49 L 30.81 45.19 L 30.81 45.27 Z M 30.81 46.37 L 31.20 45.49 L 30.81 45.27 L 30.81 46.37 Z M 23.54 38.86 L 24.31 34.44 L 23.54 34.00 L 23.54 38.86 Z M 30.43 41.35 L 31.20 38.42 L 30.43 37.98 L 30.43 41.35 Z' },
  { shade: 'right', d: 'M 24.30 29.13 L 23.92 22.73 L 28.52 20.07 L 28.52 25.38 L 25.07 28.69 L 29.67 26.04 L 29.67 20.73 L 30.43 25.60 L 37.32 21.62 L 37.32 29.58 L 33.92 32.89 L 36.93 31.10 L 36.93 39.55 L 35.02 41.95 L 38.54 40.58 L 38.54 44.11 L 37.32 49.02 L 32.76 51.69 L 34.26 40.85 L 33.83 38.08 L 32.12 39.11 L 32.12 32.58 L 24.31 37.09 L 24.31 41.51 L 21.24 43.28 L 21.24 38.86 L 17.41 41.07 L 17.41 33.11 L 24.30 29.13 Z' },
  { shade: 'top', d: 'M 22.39 38.20 L 10.52 31.35 L 12.44 30.24 L 14.74 31.57 L 20.09 26.71 L 24.30 29.13 L 17.41 33.11 L 21.24 35.32 L 23.64 33.17 L 21.24 30.90 L 24.40 32.73 L 27.47 30.96 L 28.52 31.57 L 25.46 33.34 L 28.13 34.88 L 32.34 32.45 L 31.58 31.10 L 33.03 29.95 L 37.32 29.58 L 40.77 31.57 L 44.21 28.25 L 46.12 29.36 L 41.53 32.01 L 44.21 33.56 L 51.11 29.58 L 37.32 21.62 L 30.43 25.60 L 26.22 23.17 L 34.65 20.07 L 32.35 18.75 L 34.26 17.64 L 57.99 31.35 L 56.08 32.45 L 53.78 31.12 L 48.42 35.98 L 46.12 34.66 L 51.11 37.54 L 31.20 49.03 L 17.41 41.07 L 22.39 38.20 Z M 35.79 30.46 L 33.27 30.23 L 32.12 31.54 L 32.72 32.23 L 35.79 30.46 Z M 33.29 37.86 L 35.79 38.42 L 36.17 38.20 L 33.29 37.86 Z M 32.73 38.42 L 31.58 39.55 L 32.34 40.41 L 32.73 38.42 Z M 21.24 38.86 L 34.26 47.26 L 35.02 46.82 L 21.24 38.86 Z M 23.35 43.39 L 24.29 42.64 L 23.12 42.99 L 23.35 43.39 Z M 27.38 44.85 L 28.12 45.69 L 28.55 45.20 L 27.38 44.85 Z M 22.01 41.29 L 20.86 40.63 L 19.71 41.29 L 20.86 41.96 L 22.01 41.29 Z M 23.93 34.22 L 22.01 35.77 L 24.30 37.09 L 27.37 35.32 L 23.93 34.22 Z M 30.62 46.26 L 29.47 46.93 L 31.77 46.93 L 30.62 46.26 Z' },
  { shade: 'left', d: 'M 12.21 29.26 L 14.85 30.71 L 19.22 20.45 L 25.52 25.54 L 25.42 32.26 L 18.18 28.69 L 17.75 26.32 L 15.61 31.15 L 30.92 39.99 L 18.30 31.71 L 18.30 29.59 L 32.02 37.52 L 32.53 36.36 L 25.86 33.05 L 25.86 25.54 L 30.53 28.43 L 28.90 24.71 L 28.90 16.75 L 31.20 18.08 L 31.20 28.81 L 35.69 31.40 L 34.87 37.71 L 33.29 36.80 L 32.78 37.96 L 33.62 38.44 L 33.62 40.56 L 31.69 40.43 L 35.98 43.61 L 33.88 50.77 L 34.07 44.49 L 14.93 33.44 L 15.12 40.00 L 13.78 32.78 L 11.29 31.34 L 12.21 29.26 Z M 32.73 38.07 L 32.73 38.07 L 33.62 38.44 L 32.73 38.07 Z M 21.52 35.26 L 24.53 37.35 L 24.72 37.11 L 21.52 35.26 Z' },
  { shade: 'right', d: 'M 31.96 42.39 L 34.25 30.46 L 43.45 25.15 L 43.45 27.94 L 50.22 24.02 L 52.58 27.93 L 51.48 30.86 L 54.58 29.08 L 57.23 31.09 L 54.74 32.78 L 53.40 39.50 L 49.96 41.49 L 51.29 34.77 L 38.66 42.07 L 37.32 48.78 L 33.88 50.77 L 35.22 47.72 L 34.29 41.94 L 39.54 38.90 L 37.82 31.19 L 41.91 28.82 L 41.91 26.92 L 37.32 29.57 L 36.55 39.74 L 31.96 42.39 Z' },
  { shade: 'top', d: 'M 18.85 21.68 L 32.34 13.76 L 50.22 24.02 L 47.61 24.96 L 52.20 27.61 L 47.57 24.98 L 35.69 31.40 L 18.85 21.68 Z M 24.30 21.62 L 35.79 28.25 L 44.22 23.39 L 34.72 17.91 L 26.91 20.12 L 32.73 16.76 L 24.30 21.62 Z M 44.94 23.47 L 44.94 23.47 L 44.22 23.39 L 44.94 23.47 Z' },
]

/** 軸（ステム） */
const SWITCH_STEM_PATHS: SwitchLayerPath[] = [
  { shade: 'left', d: 'M 25.07 21.96 L 26.39 21.16 L 35.81 26.60 L 35.79 37.98 L 34.64 32.01 L 34.09 37.27 L 33.19 31.17 L 27.37 27.81 L 27.37 30.46 L 26.22 27.14 L 26.22 32.45 L 25.07 31.79 L 25.07 21.96 Z' },
  { shade: 'right', d: 'M 35.79 37.98 L 35.81 26.60 L 42.17 22.93 L 43.42 23.65 L 43.45 33.56 L 38.85 37.09 L 38.85 31.18 L 40.67 27.20 L 38.56 28.42 L 38.09 36.65 L 35.79 37.98 Z M 41.15 29.86 L 41.15 29.86 L 38.85 31.18 L 41.15 29.86 Z' },
  { shade: 'top', d: 'M 35.81 26.60 L 26.39 21.16 L 32.73 15.87 L 30.43 14.55 L 36.55 13.66 L 38.09 14.55 L 35.79 15.87 L 38.09 17.20 L 32.87 17.56 L 42.17 22.93 L 35.81 26.60 Z M 34.26 21.18 L 31.96 19.85 L 30.43 20.74 L 32.73 22.06 L 30.43 23.39 L 38.09 23.39 L 35.79 22.06 L 38.09 20.74 L 36.55 19.85 L 34.26 21.18 Z' },
]

/** ハウジングの色（単色ネイビー、面の塗り分けはせず白線だけで立体感を出す） */
const SWITCH_HOUSING_COLOR = '#16213a'

/** 軸（ステム）だけが軸色を持つ */
const SWITCH_STEM_COLORS: Record<'red' | 'blue' | 'brown', string> = {
  red: '#ea3f30',
  blue: '#3170ea',
  brown: '#b8752f',
}

/** キースイッチの斜め見下ろしアイコン。ハウジングはネイビー単色＋白線、軸だけ赤・青・茶に色分け */
function switchAvatar(axis: keyof typeof SWITCH_STEM_COLORS, bg = '#faf7f0'): string {
  const stemColor = SWITCH_STEM_COLORS[axis]
  const layer = (d: string, fill: string) =>
    `<path d="${d}" fill="${fill}" fill-rule="evenodd" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>`

  const housing = SWITCH_HOUSING_PATHS.map((p) => layer(p.d, SWITCH_HOUSING_COLOR)).join('')
  const stem = SWITCH_STEM_PATHS.map((p) => layer(p.d, stemColor)).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect x="4" y="4" width="56" height="56" rx="14" fill="${bg}" stroke="#111111" stroke-width="4"/>`
    + housing + stem + `</svg>`
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
