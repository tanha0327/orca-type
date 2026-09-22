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
