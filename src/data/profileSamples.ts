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
 * trimesh で下ハウジング／上ハウジング／軸（ステム）の3パーツに分離し、
 * 面ごと（top / left / right）に shapely で三角メッシュを結合。
 *
 * 最初は面ごとの細かい溝やタブも忠実に再現していたが、アイコンの表示サイズ
 * （数十px）では線が多すぎて潰れて見づらかったため、面ごとに「最大の1つの
 * まとまり」だけを残して細かい付属パーツ（脚の隙間の小片など）は間引き、
 * Douglas-Peucker で輪郭も単純化した。色は実物同様パーツ単位で分ける
 * （ハウジングは無彩色、軸だけが「赤軸・青軸・茶軸」の色を持つ）。
 * 下ハウジングは黒系だが、黒い輪郭線のままだと塗りと同化して溝が消えて
 * しまうため、下ハウジングだけ輪郭線をグレーにして視認性を確保している。
 */
type SwitchShade = 'top' | 'right' | 'left'
interface SwitchLayerPath { shade: SwitchShade, d: string }

/** 下ハウジング（黒系） */
const SWITCH_BOTTOM_HOUSING_PATHS: SwitchLayerPath[] = [
  { shade: 'left', d: 'M 14.23 41.17 L 10.45 31.46 L 18.06 35.85 L 16.97 28.58 L 18.89 36.33 L 20.42 37.21 L 20.42 31.46 L 31.55 37.88 L 31.55 31.70 L 33.80 33.00 L 34.22 39.43 L 32.72 51.84 L 31.16 47.62 L 30.77 51.16 L 14.23 41.17 Z M 30.77 45.40 L 31.16 45.63 L 30.77 45.32 L 30.77 45.40 Z M 30.77 46.51 L 31.16 45.63 L 30.77 45.41 L 30.77 46.51 Z M 23.49 38.98 L 24.25 34.56 L 23.49 34.11 L 23.49 38.98 Z M 30.39 41.47 L 31.16 38.54 L 30.39 38.10 L 30.39 41.47 Z' },
  { shade: 'right', d: 'M 24.25 29.24 L 23.87 22.83 L 28.47 20.17 L 28.47 25.48 L 25.02 28.80 L 29.62 26.14 L 29.62 20.83 L 30.39 25.70 L 37.29 21.72 L 37.29 29.69 L 33.88 33.00 L 36.90 31.21 L 36.90 39.67 L 34.99 42.08 L 38.51 40.70 L 38.51 44.25 L 37.29 49.17 L 32.72 51.84 L 34.22 40.97 L 33.80 38.21 L 32.08 39.23 L 32.08 32.70 L 24.25 37.21 L 24.25 41.64 L 21.19 43.41 L 21.19 38.98 L 17.35 41.20 L 17.35 33.23 L 24.25 29.24 Z' },
  { shade: 'top', d: 'M 22.34 38.32 L 10.45 31.46 L 14.67 31.68 L 20.04 26.81 L 24.25 29.24 L 17.35 33.23 L 21.18 35.44 L 23.59 33.29 L 21.19 31.02 L 24.35 32.84 L 27.42 31.07 L 25.41 33.45 L 28.09 35.00 L 32.99 30.06 L 37.29 29.69 L 40.74 31.68 L 44.19 28.36 L 46.11 29.46 L 41.51 32.12 L 44.19 33.67 L 51.10 29.69 L 37.29 21.72 L 30.39 25.70 L 26.18 23.27 L 34.61 20.17 L 32.31 18.84 L 34.22 17.73 L 57.99 31.46 L 53.78 31.23 L 48.41 36.10 L 46.11 34.78 L 51.10 37.66 L 31.16 49.17 L 17.35 41.20 L 22.34 38.32 Z M 35.76 30.57 L 33.24 30.34 L 32.08 31.65 L 32.69 32.34 L 35.76 30.57 Z M 33.26 37.98 L 35.76 38.54 L 36.14 38.32 L 33.26 37.98 Z M 32.69 38.54 L 31.55 39.67 L 32.31 40.54 L 32.69 38.54 Z M 21.19 38.99 L 34.22 47.40 L 34.99 46.96 L 21.19 38.99 Z M 23.29 43.53 L 24.24 42.77 L 23.06 43.12 L 23.29 43.53 Z M 27.33 44.99 L 28.08 45.83 L 28.51 45.33 L 27.33 44.99 Z M 20.80 42.09 L 20.80 40.76 L 19.65 41.42 L 20.80 42.09 Z M 23.87 34.34 L 21.95 35.89 L 24.25 37.21 L 27.32 35.44 L 23.87 34.34 Z M 30.58 46.40 L 29.43 47.07 L 31.73 47.07 L 30.58 46.40 Z' },
]

/** 上ハウジング（アイボリー系） */
const SWITCH_TOP_HOUSING_PATHS: SwitchLayerPath[] = [
  { shade: 'left', d: 'M 12.14 29.37 L 14.78 30.82 L 19.16 20.55 L 25.47 25.64 L 25.37 32.37 L 18.12 28.80 L 17.69 26.43 L 15.54 31.26 L 30.88 40.12 L 18.24 31.83 L 18.24 29.70 L 31.98 37.64 L 25.81 33.17 L 25.81 25.64 L 30.49 28.53 L 28.86 16.84 L 31.16 18.17 L 31.16 28.92 L 35.65 31.52 L 34.84 37.84 L 32.75 38.08 L 33.58 38.56 L 33.58 40.68 L 31.65 40.56 L 35.95 43.74 L 33.84 50.92 L 34.03 44.63 L 14.86 33.56 L 15.05 40.13 L 13.71 32.90 L 11.22 31.46 L 12.14 29.37 Z M 32.70 38.19 L 32.70 38.19 L 33.58 38.56 L 32.70 38.19 Z M 21.46 35.38 L 24.48 37.47 L 24.67 37.23 L 21.46 35.38 Z' },
  { shade: 'right', d: 'M 31.92 42.52 L 34.22 30.57 L 43.43 25.26 L 43.43 28.05 L 50.21 24.13 L 52.58 28.03 L 51.48 30.97 L 54.57 29.19 L 57.23 31.20 L 54.73 32.90 L 53.39 39.63 L 49.95 41.62 L 51.29 34.89 L 38.63 42.20 L 37.29 48.92 L 33.84 50.92 L 34.25 42.07 L 39.51 39.03 L 37.79 31.30 L 41.89 28.93 L 41.89 27.03 L 37.29 29.68 L 36.52 39.87 L 31.92 42.52 Z' },
  { shade: 'top', d: 'M 18.79 21.78 L 32.30 13.85 L 50.21 24.13 L 47.59 25.06 L 52.19 27.72 L 47.55 25.09 L 35.65 31.52 L 18.79 21.78 Z M 24.25 21.72 L 35.76 28.36 L 44.20 23.49 L 34.69 18.00 L 26.86 20.22 L 32.69 16.85 L 24.25 21.72 Z M 44.92 23.57 L 44.92 23.57 L 44.20 23.49 L 44.92 23.57 Z' },
]

/** 軸（ステム） */
const SWITCH_STEM_PATHS: SwitchLayerPath[] = [
  { shade: 'left', d: 'M 25.02 22.05 L 35.78 26.71 L 35.76 38.10 L 34.61 32.12 L 34.05 37.39 L 33.15 31.28 L 27.32 27.91 L 27.32 30.57 L 26.17 27.25 L 26.17 32.56 L 25.02 31.90 L 25.02 22.05 Z' },
  { shade: 'right', d: 'M 35.78 28.21 L 43.40 23.75 L 43.42 33.67 L 38.82 37.21 L 38.82 31.29 L 40.65 27.31 L 38.53 28.53 L 38.06 36.77 L 35.76 38.10 L 35.78 28.21 Z M 41.12 29.97 L 41.12 29.97 L 38.82 31.29 L 41.12 29.97 Z' },
  { shade: 'top', d: 'M 35.78 26.71 L 26.35 21.26 L 32.69 15.96 L 30.39 14.63 L 36.52 13.75 L 38.06 14.63 L 35.76 15.96 L 38.06 17.29 L 32.83 17.65 L 42.15 23.03 L 35.78 26.71 Z M 34.22 21.28 L 31.92 19.95 L 30.39 20.83 L 32.69 22.16 L 30.39 23.49 L 38.06 23.49 L 35.76 22.16 L 38.06 20.83 L 36.52 19.95 L 34.22 21.28 Z' },
]

/** 下ハウジング（不透明・黒系）の面ごとの色。輪郭線は塗りに埋もれないようグレーにする */
const SWITCH_BOTTOM_HOUSING_COLORS: Record<SwitchShade, string> = {
  top: '#5a5a62', right: '#46464e', left: '#323238',
}

/** 上ハウジング（アイボリー系）の面ごとの色 */
const SWITCH_TOP_HOUSING_COLORS: Record<SwitchShade, string> = {
  top: '#faf7f0', right: '#e8e2d0', left: '#cfc6ac',
}

/** 軸（ステム）だけが軸色を持つ。上面がいちばん明るく、左面がいちばん暗い簡易ライティング */
const SWITCH_STEM_COLORS: Record<'red' | 'blue' | 'brown', Record<SwitchShade, string>> = {
  red: { top: '#ff8478', right: '#ea3f30', left: '#a3241c' },
  blue: { top: '#6fabff', right: '#3170ea', left: '#1c4694' },
  brown: { top: '#e2a566', right: '#b8752f', left: '#7a4416' },
}

/** キースイッチの斜め見下ろしアイコン。ハウジングは無彩色、軸だけ赤・青・茶に色分け */
function switchAvatar(axis: keyof typeof SWITCH_STEM_COLORS, bg = '#faf7f0'): string {
  const stemColors = SWITCH_STEM_COLORS[axis]
  const layer = (d: string, fill: string, stroke: string) =>
    `<path d="${d}" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`

  // 下ハウジングは黒い輪郭線だと塗りに埋もれるので、グレーの輪郭線で溝を見えるようにする
  const bottomHousing = SWITCH_BOTTOM_HOUSING_PATHS
    .map((p) => layer(p.d, SWITCH_BOTTOM_HOUSING_COLORS[p.shade], '#6b6b72'))
    .join('')
  const topHousing = SWITCH_TOP_HOUSING_PATHS
    .map((p) => layer(p.d, SWITCH_TOP_HOUSING_COLORS[p.shade], '#111111'))
    .join('')
  const stem = SWITCH_STEM_PATHS
    .map((p) => layer(p.d, stemColors[p.shade], '#111111'))
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect x="4" y="4" width="56" height="56" rx="14" fill="${bg}" stroke="#111111" stroke-width="4"/>`
    + bottomHousing + topHousing + stem + `</svg>`
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
