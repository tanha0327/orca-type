/**
 * プロフィールの「持っているキーボード」で選べる、よく知られているキーボードの一覧。
 * 一覧に無いものは名前を入力して追加できる。保存するのは、一覧にあるものはその ID、無いものは入力された名前。
 *
 * ID は、編集画面が対応しているキーボードの ID（Orca echo なら keychron-orca-echo）とそろえてある。
 * 「持っているキーボード向けの配列」を探すときに、投稿された配列のキーボードとそのまま突き合わせられるように。
 */

export interface CatalogKeyboard {
  id: string
  name: string
  /** 左右に分かれている（分割キーボード） */
  split: boolean
  /** 名前を入力して追加したときに、この一覧のキーボードだと見なす別名 */
  aliases?: string[]
}

export const ORCA_ECHO_KEYBOARD_ID = 'keychron-orca-echo'

export const KEYBOARD_CATALOG: readonly CatalogKeyboard[] = [
  // 分割キーボード
  { id: ORCA_ECHO_KEYBOARD_ID, name: 'Keychron Orca echo', split: true, aliases: ['Orca echo', 'Orca', 'オルカエコー', 'オルカ'] },
  { id: 'foostan-corne-6col', name: 'Corne', split: true, aliases: ['crkbd', 'Corne Cherry', 'Corne Chocolate'] },
  { id: 'yowkees-keyball44', name: 'Keyball44', split: true },
  { id: 'yowkees-keyball39', name: 'Keyball39', split: true },
  { id: 'yowkees-keyball61', name: 'Keyball61', split: true },
  { id: 'kata0510-lily58', name: 'Lily58', split: true },
  { id: 'josefadamcik-sofle', name: 'Sofle', split: true },
  { id: 'splitkb-kyria', name: 'Kyria', split: true },
  { id: 'keebio-iris', name: 'Iris', split: true },
  { id: 'claw44', name: 'Claw44', split: true },
  { id: 'helix', name: 'Helix', split: true },
  { id: 'ferris-sweep', name: 'Ferris Sweep', split: true, aliases: ['Sweep'] },
  { id: 'zsa-ergodox-ez', name: 'ErgoDox EZ', split: true, aliases: ['ErgoDox'] },
  { id: 'zsa-moonlander', name: 'Moonlander', split: true, aliases: ['Moonlander Mark I'] },
  { id: 'zsa-voyager', name: 'Voyager', split: true, aliases: ['ZSA Voyager'] },
  { id: 'moergo-glove80', name: 'Glove80', split: true },
  { id: 'kinesis-advantage360', name: 'Advantage360', split: true, aliases: ['Kinesis Advantage360'] },
  { id: 'keychron-q11', name: 'Keychron Q11', split: true },
  { id: 'mistel-barocco', name: 'Barocco', split: true, aliases: ['Mistel Barocco'] },
  { id: 'dygma-raise', name: 'Dygma Raise', split: true },
  { id: 'dygma-defy', name: 'Dygma Defy', split: true },
  { id: 'bastardkb-charybdis', name: 'Charybdis', split: true },
  { id: 'dactyl-manuform', name: 'Dactyl Manuform', split: true },
  // 一体型のキーボード
  { id: 'olkb-planck', name: 'Planck', split: false },
  { id: 'olkb-preonic', name: 'Preonic', split: false },
  { id: 'qmk-60-ansi', name: '60% キーボード', split: false, aliases: ['60%'] },
  { id: 'pfu-hhkb', name: 'HHKB', split: false, aliases: ['Happy Hacking Keyboard'] },
  { id: 'topre-realforce', name: 'REALFORCE', split: false, aliases: ['リアルフォース'] },
  { id: 'apple-magic-keyboard', name: 'Magic Keyboard', split: false, aliases: ['Apple Magic Keyboard'] },
  { id: 'logicool-mx-keys', name: 'MX Keys', split: false, aliases: ['Logicool MX Keys', 'Logitech MX Keys'] },
  { id: 'laptop', name: 'ノートパソコンのキーボード', split: false, aliases: ['ノートパソコン', 'ノートPC', 'Laptop'] },
]

/** プロフィールに登録できるキーボードの数（DB 側は 20 まで受け付ける） */
export const MAX_OWNED_KEYBOARDS = 12

/** 一覧に無いキーボードの名前の長さ */
export const MAX_KEYBOARD_NAME = 40

/** 全角・半角、大文字・小文字、空白や記号の違いを無視して名前を比べるための形 */
function simplify(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[\s\-_・/()（）]/g, '')
}

const catalogById = new Map(KEYBOARD_CATALOG.map((k) => [k.id, k]))

const catalogByName = new Map<string, CatalogKeyboard>()
for (const k of KEYBOARD_CATALOG) {
  for (const name of [k.name, k.id, ...(k.aliases ?? [])]) catalogByName.set(simplify(name), k)
}

/** 保存されている値（ID か名前）が一覧のキーボードなら、その定義 */
export function catalogKeyboard(value: string): CatalogKeyboard | undefined {
  return catalogById.get(value)
}

/** 画面に出す名前。一覧のキーボードはその名前、それ以外は入力された名前のまま */
export function keyboardLabel(value: string): string {
  return catalogById.get(value)?.name ?? value
}

/**
 * 入力された名前を保存する値にする。一覧のキーボード（別名を含む）ならその ID、
 * 無ければ前後の空白を除いた名前。空なら null
 */
export function keyboardValueFromInput(text: string): string | null {
  const name = text.replace(/\s+/g, ' ').trim().slice(0, MAX_KEYBOARD_NAME)
  if (!name) return null
  return catalogByName.get(simplify(name))?.id ?? name
}

/** 同じキーボードか（一覧の ID 同士・名前同士を、表記の揺れを無視して比べる） */
export function sameKeyboard(a: string, b: string): boolean {
  return a === b || simplify(keyboardLabel(a)) === simplify(keyboardLabel(b))
}

/** DB から来た値を信用せずに整える（文字列以外・空・重複を除き、DB の上限の 20 台で切る） */
export function sanitizeKeyboards(x: unknown): string[] {
  if (!Array.isArray(x)) return []
  const out: string[] = []
  for (const v of x) {
    if (typeof v !== 'string') continue
    const value = v.trim().slice(0, MAX_KEYBOARD_NAME)
    if (!value || out.some((o) => sameKeyboard(o, value))) continue
    out.push(value)
    if (out.length >= 20) break
  }
  return out
}
