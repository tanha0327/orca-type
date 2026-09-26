import type { Keycode } from '../../data/keycodes'

/**
 * キーキャップの印字（KLE の印字や QMK の label）から、いちばんありそうなキーコードを推測する。
 * 取り込んだキーボードのベースレイヤーの下書きと、手元のキーボードからの読み替えに使う。
 * 左右で別コードがある修飾キーは、盤面のどちら側にあるかで決める。
 */

const PLAIN: Record<string, Keycode> = {
  esc: 'ESC', escape: 'ESC',
  tab: 'TAB',
  caps: 'CAPS', 'caps lock': 'CAPS', capslock: 'CAPS',
  enter: 'ENTER', return: 'ENTER', ent: 'ENTER', ret: 'ENTER', '⏎': 'ENTER', '↵': 'ENTER', '⌤': 'ENTER',
  space: 'SPACE', spc: 'SPACE', spacebar: 'SPACE', '␣': 'SPACE',
  backspace: 'BSPC', 'back space': 'BSPC', bksp: 'BSPC', bspc: 'BSPC', bs: 'BSPC', '⌫': 'BSPC',
  del: 'DEL', delete: 'DEL', '⌦': 'DEL',
  ins: 'INS', insert: 'INS',
  home: 'HOME', end: 'END',
  pgup: 'PG_UP', 'pg up': 'PG_UP', 'page up': 'PG_UP', pageup: 'PG_UP',
  pgdn: 'PG_DN', 'pg dn': 'PG_DN', 'page down': 'PG_DN', pagedown: 'PG_DN',
  left: 'LEFT', '←': 'LEFT', right: 'RIGHT', '→': 'RIGHT', up: 'UP', '↑': 'UP', down: 'DOWN', '↓': 'DOWN',
  menu: 'K_APP', app: 'K_APP', apps: 'K_APP',
  'print screen': 'PSCRN', prtsc: 'PSCRN', prtscr: 'PSCRN', psc: 'PSCRN', 'prt sc': 'PSCRN',
  fn: 'FN_1', lower: 'FN_1', raise: 'FN_2', adjust: 'FN_3',
  英数: 'LANG2', かな: 'LANG1',
  '-': 'MINUS', '=': 'EQUAL', '[': 'LBKT', ']': 'RBKT', '\\': 'BSLH', ';': 'SEMI',
  "'": 'SQT', '`': 'GRAVE', ',': 'COMMA', '.': 'DOT', '/': 'FSLH',
  '!': 'EXCL', '@': 'AT', '#': 'HASH', $: 'DLLR', '%': 'PRCNT', '^': 'CARET', '&': 'AMPS', '*': 'STAR',
  '(': 'LPAR', ')': 'RPAR', '{': 'LBRC', '}': 'RBRC', _: 'UNDER', '+': 'PLUS', '|': 'PIPE',
  '~': 'TILDE', ':': 'COLON', '"': 'DQT', '<': 'LT', '>': 'GT', '?': 'QMARK',
}

/** 左右で別のコードを持つ修飾キー */
const SIDED: Record<string, [Keycode, Keycode]> = {
  shift: ['LSHFT', 'RSHFT'], '⇧': ['LSHFT', 'RSHFT'],
  ctrl: ['LCTRL', 'RCTRL'], control: ['LCTRL', 'RCTRL'], ctl: ['LCTRL', 'RCTRL'], '⌃': ['LCTRL', 'RCTRL'],
  alt: ['LALT', 'RALT'], opt: ['LALT', 'RALT'], option: ['LALT', 'RALT'], '⌥': ['LALT', 'RALT'],
  win: ['LGUI', 'RGUI'], gui: ['LGUI', 'RGUI'], cmd: ['LGUI', 'RGUI'], command: ['LGUI', 'RGUI'],
  super: ['LGUI', 'RGUI'], meta: ['LGUI', 'RGUI'], os: ['LGUI', 'RGUI'], '⌘': ['LGUI', 'RGUI'],
}

function guessOne(text: string, rightSide: boolean): Keycode | undefined {
  const t = text.trim().toLowerCase()
  if (!t) return undefined
  if (/^[a-z]$/.test(t)) return t.toUpperCase()
  if (/^[0-9]$/.test(t)) return `N${t}`
  const f = /^f([1-9]|1[0-2])$/.exec(t)
  if (f) return `F${f[1]}`
  if (t in PLAIN) return PLAIN[t]
  // 「L Shift」「Right Ctrl」「RAlt」のような左右つきの書き方
  const sided = /^(l|r|left|right)\s*[-_]?\s*(.+)$/.exec(t)
  if (sided && sided[2] in SIDED) return SIDED[sided[2]][sided[1].startsWith('r') ? 1 : 0]
  if (t in SIDED) return SIDED[t][rightSide ? 1 : 0]
  return undefined
}

/**
 * 印字の候補（優先順）から推測する。
 * 「!」と「1」の 2 段印字は、Shift なしの側（下段）を先に渡すと数字キーになる。
 */
export function guessKeycode(labels: (string | undefined)[], rightSide: boolean): Keycode | undefined {
  for (const label of labels) {
    if (!label) continue
    const code = guessOne(label, rightSide)
    if (code) return code
  }
  return undefined
}
