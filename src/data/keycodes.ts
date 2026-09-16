/**
 * ZMK 準拠のキーコードカタログ。
 * Orca echo は ZMK ファームなので、コード名は ZMK の behavior/keycode 名に寄せている。
 */

export type KeycodeCategory =
  | 'basic'
  | 'number'
  | 'symbol'
  | 'mod'
  | 'nav'
  | 'fn'
  | 'media'
  | 'mouse'
  | 'bt'
  | 'layer'
  | 'macro'
  | 'system'

export const CATEGORY_LABEL: Record<KeycodeCategory, string> = {
  basic: '基本',
  number: '数字',
  symbol: '記号',
  mod: '修飾',
  nav: 'ナビ',
  fn: 'ファンクション',
  media: 'メディア',
  mouse: 'マウス',
  bt: 'Bluetooth',
  layer: 'レイヤー',
  macro: 'マクロ',
  system: 'システム',
}

export const CATEGORY_ORDER: KeycodeCategory[] = [
  'basic', 'number', 'symbol', 'mod', 'nav', 'fn', 'media', 'mouse', 'bt', 'layer', 'macro', 'system',
]

export type Keycode = string

export interface KeycodeDef {
  code: Keycode
  /** キーキャップに出す主表記 */
  label: string
  /** キーキャップ右上に出す Shift 時の表記（US 配列のペア） */
  shifted?: string
  /** ピッカーや HUD で使う正式名 */
  name: string
  category: KeycodeCategory
  /** 検索用の読み・別名 */
  keywords?: string[]
  /** 修飾キーなら、その記号（HUD の「⇧ + A」表示に使う） */
  modSymbol?: string
  /** レイヤー系の挙動 */
  layerAction?: 'MO' | 'TG' | 'TO'
  layerTarget?: number
  /** ラベルが長くフォントを落とす必要があるか */
  wide?: boolean
}

const defs: KeycodeDef[] = []
const def = (d: KeycodeDef) => { defs.push(d); return d }

/* ---------------------------------------------------------------- 基本 */
def({ code: 'NONE', label: '', name: '未割当', category: 'basic', keywords: ['なし', 'none', 'blank'] })
def({ code: 'TRANS', label: '▽', name: '透過（下のレイヤーを使う）', category: 'basic', keywords: ['trans', 'とうか', '透過'], wide: true })

for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  def({ code: ch, label: ch, name: ch, category: 'basic', keywords: [ch.toLowerCase()] })
}

def({ code: 'SPACE', label: 'space', name: 'スペース', category: 'basic', keywords: ['スペース', '空白'], wide: true })
def({ code: 'ENTER', label: 'enter', name: 'Enter', category: 'basic', keywords: ['エンター', '改行', 'return'], wide: true })
def({ code: 'BSPC', label: '←', name: 'Backspace', category: 'basic', keywords: ['バックスペース', '削除', 'delete'] })
def({ code: 'DEL', label: 'del', name: 'Delete', category: 'basic', keywords: ['デリート', '削除'], wide: true })
def({ code: 'TAB', label: 'tab', name: 'Tab', category: 'basic', keywords: ['タブ'], wide: true })
def({ code: 'ESC', label: 'esc', name: 'Escape', category: 'basic', keywords: ['エスケープ'], wide: true })
def({ code: 'CAPS', label: 'caps', name: 'Caps Lock', category: 'basic', keywords: ['キャップス'], wide: true })
def({ code: 'LANG1', label: 'かな', name: 'かな（変換）', category: 'basic', keywords: ['かな', '日本語', 'IME'], wide: true })
def({ code: 'LANG2', label: '英数', name: '英数（無変換）', category: 'basic', keywords: ['えいすう', '英数', 'IME'], wide: true })

/* ---------------------------------------------------------------- 数字 */
const numberPairs: [string, string, string][] = [
  ['N1', '1', '!'], ['N2', '2', '@'], ['N3', '3', '#'], ['N4', '4', '$'], ['N5', '5', '%'],
  ['N6', '6', '^'], ['N7', '7', '&'], ['N8', '8', '*'], ['N9', '9', '('], ['N0', '0', ')'],
]
for (const [code, label, shifted] of numberPairs) {
  def({ code, label, shifted, name: `${label}（Shift で ${shifted}）`, category: 'number', keywords: [label, shifted] })
}
for (let i = 0; i <= 9; i++) {
  def({ code: `KP_N${i}`, label: `${i}`, name: `テンキー ${i}`, category: 'number', keywords: ['テンキー', 'keypad', `${i}`] })
}

/* ---------------------------------------------------------------- 記号 */
const symbolPairs: [string, string, string, string][] = [
  ['MINUS', '-', '_', 'ハイフン'],
  ['EQUAL', '=', '+', 'イコール'],
  ['LBKT', '[', '{', '左角括弧'],
  ['RBKT', ']', '}', '右角括弧'],
  ['BSLH', '\\', '|', 'バックスラッシュ'],
  ['SEMI', ';', ':', 'セミコロン'],
  ['SQT', "'", '"', 'クォート'],
  ['GRAVE', '`', '~', 'バッククォート'],
  ['COMMA', ',', '<', 'カンマ'],
  ['DOT', '.', '>', 'ピリオド'],
  ['FSLH', '/', '?', 'スラッシュ'],
]
for (const [code, label, shifted, jp] of symbolPairs) {
  def({ code, label, shifted, name: `${jp} ${label}`, category: 'symbol', keywords: [jp, label, shifted] })
}
const soloSymbols: [string, string, string][] = [
  ['EXCL', '!', 'エクスクラメーション'],
  ['AT', '@', 'アットマーク'],
  ['HASH', '#', 'シャープ'],
  ['DLLR', '$', 'ドル'],
  ['PRCNT', '%', 'パーセント'],
  ['CARET', '^', 'キャレット'],
  ['AMPS', '&', 'アンパサンド'],
  ['STAR', '*', 'アスタリスク'],
  ['LPAR', '(', '左丸括弧'],
  ['RPAR', ')', '右丸括弧'],
  ['LBRC', '{', '左波括弧'],
  ['RBRC', '}', '右波括弧'],
  ['UNDER', '_', 'アンダースコア'],
  ['PLUS', '+', 'プラス'],
  ['PIPE', '|', 'パイプ'],
  ['TILDE', '~', 'チルダ'],
  ['COLON', ':', 'コロン'],
  ['DQT', '"', 'ダブルクォート'],
  ['LT', '<', '小なり'],
  ['GT', '>', '大なり'],
  ['QMARK', '?', 'クエスチョン'],
]
for (const [code, label, jp] of soloSymbols) {
  def({ code, label, name: `${jp} ${label}`, category: 'symbol', keywords: [jp, label] })
}

/* ---------------------------------------------------------------- 修飾 */
const mods: [string, string, string, string][] = [
  ['LSHFT', 'shift', '⇧', '左 Shift'],
  ['RSHFT', 'shift', '⇧', '右 Shift'],
  ['LCTRL', 'ctrl', '⌃', '左 Control'],
  ['RCTRL', 'ctrl', '⌃', '右 Control'],
  ['LALT', 'opt', '⌥', '左 Option / Alt'],
  ['RALT', 'opt', '⌥', '右 Option / Alt'],
  ['LGUI', '⌘', '⌘', '左 Command / Win'],
  ['RGUI', '⌘', '⌘', '右 Command / Win'],
]
for (const [code, label, sym, jp] of mods) {
  def({ code, label, name: jp, category: 'mod', modSymbol: sym, keywords: [jp, sym, label], wide: label.length > 2 })
}
def({ code: 'HYPER', label: 'hyper', name: 'Hyper（⌃⌥⇧⌘）', category: 'mod', modSymbol: '✦', keywords: ['ハイパー'], wide: true })
def({ code: 'MEH', label: 'meh', name: 'Meh（⌃⌥⇧）', category: 'mod', modSymbol: '◆', keywords: ['めぇ'], wide: true })

/* ---------------------------------------------------------------- ナビ */
const navs: [string, string, string][] = [
  ['LEFT', '←', '左矢印'],
  ['RIGHT', '→', '右矢印'],
  ['UP', '↑', '上矢印'],
  ['DOWN', '↓', '下矢印'],
  ['HOME', 'home', '行頭 Home'],
  ['END', 'end', '行末 End'],
  ['PG_UP', 'pgup', 'ページアップ'],
  ['PG_DN', 'pgdn', 'ページダウン'],
  ['INS', 'ins', 'インサート'],
]
for (const [code, label, jp] of navs) {
  def({ code, label, name: jp, category: 'nav', keywords: [jp, label, 'やじるし', 'カーソル'], wide: label.length > 2 })
}

/* ---------------------------------------------------------------- ファンクション */
for (let i = 1; i <= 12; i++) {
  def({ code: `F${i}`, label: `F${i}`, name: `F${i}`, category: 'fn', keywords: [`f${i}`, 'ファンクション'] })
}
def({ code: 'PSCRN', label: 'prtsc', name: 'Print Screen', category: 'fn', keywords: ['スクショ', 'プリントスクリーン'], wide: true })

/* ---------------------------------------------------------------- メディア */
const media: [string, string, string][] = [
  ['C_VOL_UP', 'VOL+', '音量を上げる'],
  ['C_VOL_DN', 'VOL−', '音量を下げる'],
  ['C_MUTE', 'MUTE', 'ミュート'],
  ['C_PP', '▶︎❙❙', '再生 / 一時停止'],
  ['C_NEXT', '▶▶', '次の曲'],
  ['C_PREV', '◀◀', '前の曲'],
  ['C_STOP', '■', '停止'],
  ['C_BRI_UP', '☀+', '画面を明るく'],
  ['C_BRI_DN', '☀−', '画面を暗く'],
]
for (const [code, label, jp] of media) {
  def({ code, label, name: jp, category: 'media', keywords: [jp, 'おんりょう', '音量', 'メディア'], wide: label.length > 3 })
}

/* ---------------------------------------------------------------- マウス */
const mouse: [string, string, string, string[]][] = [
  ['MB1', 'LMB', '左クリック', ['クリック', '左']],
  ['MB2', 'RMB', '右クリック', ['クリック', '右']],
  ['MB3', 'MMB', '中クリック', ['クリック', '中', 'ホイール']],
  ['MB4', 'MB4', '戻る（サイドボタン）', ['もどる', '戻る']],
  ['MB5', 'MB5', '進む（サイドボタン）', ['すすむ', '進む']],
  ['MSC_WHEEL_UP', '⇑', '上スクロール', ['スクロール', '縦', 'うえ']],
  ['MSC_WHEEL_DOWN', '⇓', '下スクロール', ['スクロール', '縦', 'した']],
  ['MSC_HWHEEL_LEFT', '⇐', '左スクロール（水平）', ['スクロール', '横', '水平', 'ひだり', '左右']],
  ['MSC_HWHEEL_RIGHT', '⇒', '右スクロール（水平）', ['スクロール', '横', '水平', 'みぎ', '左右']],
  ['MS_UP', '↑ PTR', 'ポインタを上へ', ['ポインタ', 'カーソル']],
  ['MS_DOWN', '↓ PTR', 'ポインタを下へ', ['ポインタ', 'カーソル']],
  ['MS_LEFT', '← PTR', 'ポインタを左へ', ['ポインタ', 'カーソル']],
  ['MS_RIGHT', '→ PTR', 'ポインタを右へ', ['ポインタ', 'カーソル']],
  ['SNIPE', 'SNIPE', '精密モード（DPI を落とす）', ['せいみつ', '精密', 'スナイプ', 'トラックボール']],
  ['SCRL_MODE', 'SCRL', 'スクロールモード（ボールでスクロール）', ['スクロール', 'トラックボール', 'モード']],
]
for (const [code, label, jp, kw] of mouse) {
  def({ code, label, name: jp, category: 'mouse', keywords: kw, wide: label.length > 3 })
}

/* ---------------------------------------------------------------- Bluetooth / 無線 */
for (let i = 0; i < 5; i++) {
  def({
    code: `BT_SEL_${i}`, label: `B${i + 1}`, name: `Bluetooth プロファイル ${i + 1}`,
    category: 'bt', keywords: ['ぶるーとぅーす', 'bt', 'プロファイル', `${i + 1}`],
  })
}
def({ code: 'BT_CLR', label: 'BT✕', name: '現在のプロファイルを消去', category: 'bt', keywords: ['クリア', '消去'] })
def({ code: 'BT_NXT', label: 'BT▸', name: '次のプロファイルへ', category: 'bt', keywords: ['つぎ', '次'] })
def({ code: 'OUT_TOG', label: '((•))', name: '出力切替（USB ⇄ 無線）', category: 'bt', keywords: ['むせん', '無線', '切替', 'usb'], wide: true })

/* ---------------------------------------------------------------- レイヤー */
export const LAYER_COUNT = 8
/** キーキャップに fn1/fn2/fn3 と印字されているレイヤー（実機写真準拠） */
const FN_LAYERS = new Set([1, 2, 3])
for (let n = 0; n < LAYER_COUNT; n++) {
  if (FN_LAYERS.has(n)) {
    def({ code: `FN_${n}`, label: `fn${n}`, name: `fn${n}（レイヤー ${n} を押している間だけ有効）`, category: 'layer', layerAction: 'MO', layerTarget: n, keywords: ['もーめんたり', 'momentary', 'レイヤー', 'fn', `fn${n}`, `${n}`] })
  } else {
    def({ code: `MO_${n}`, label: `MO${n}`, name: `レイヤー ${n} を押している間だけ有効`, category: 'layer', layerAction: 'MO', layerTarget: n, keywords: ['もーめんたり', 'momentary', 'レイヤー', `${n}`] })
  }
  def({ code: `TG_${n}`, label: `TG${n}`, name: `レイヤー ${n} をトグル`, category: 'layer', layerAction: 'TG', layerTarget: n, keywords: ['トグル', 'toggle', 'レイヤー', `${n}`] })
  def({ code: `TO_${n}`, label: `TO${n}`, name: `レイヤー ${n} に切り替える`, category: 'layer', layerAction: 'TO', layerTarget: n, keywords: ['きりかえ', '切替', 'レイヤー', `${n}`] })
}

/* ---------------------------------------------------------------- マクロ */
for (let i = 1; i <= 6; i++) {
  def({ code: `MACRO_${i}`, label: `M${i}`, name: `マクロ ${i}`, category: 'macro', keywords: ['マクロ', `m${i}`] })
}

/* ---------------------------------------------------------------- システム */
def({ code: 'STUDIO_UNLOCK', label: 'unlock', name: 'ZMK Studio ロック解除', category: 'system', keywords: ['スタジオ', 'ロック'], wide: true })
def({ code: 'BOOTLOADER', label: 'boot', name: 'ブートローダー', category: 'system', keywords: ['ぶーと'], wide: true })
def({ code: 'SYS_RESET', label: 'reset', name: 'リセット', category: 'system', keywords: ['りせっと'], wide: true })
def({ code: 'RGB_TOG', label: 'RGB', name: 'バックライト ON/OFF', category: 'system', keywords: ['らいと', 'ライト', 'rgb'] })

/* ---------------------------------------------------------------- 索引 */
export const KEYCODES: readonly KeycodeDef[] = defs

const byCode = new Map<Keycode, KeycodeDef>(defs.map((d) => [d.code, d]))

const FALLBACK: KeycodeDef = { code: 'NONE', label: '', name: '未割当', category: 'basic' }

export function getKeycode(code: Keycode | undefined): KeycodeDef {
  if (!code) return FALLBACK
  return byCode.get(code) ?? { code, label: code, name: code, category: 'basic' }
}

/** ピッカーの検索。コード名・正式名・キーワード・表記のいずれかに前方/部分一致 */
export function searchKeycodes(query: string, category?: KeycodeCategory): KeycodeDef[] {
  const q = query.trim().toLowerCase()
  return defs.filter((d) => {
    if (category && d.category !== category) return false
    if (!q) return true
    if (d.code.toLowerCase().includes(q)) return true
    if (d.name.toLowerCase().includes(q)) return true
    if (d.label.toLowerCase() === q) return true
    return d.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false
  })
}
