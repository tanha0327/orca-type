/**
 * ゆるい JSON パーサー。
 * QMK の info.json はコメントや末尾のカンマを含むことがあり（hjson として読まれる）、
 * keyboard-layout-editor の「Raw data」はキーを引用符で囲まず、外側の [] も付かない。
 * どれも JSON.parse では読めないので、JSON5 のうち必要なぶんだけを読む。
 */
export function parseLenientJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    /* 下のゆるいパーサーで読み直す */
  }
  try {
    return new Parser(text).parseDocument()
  } catch (e) {
    // KLE の Raw data は行の配列を並べただけで外側の [] が無い
    const trimmed = text.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return new Parser(`[${trimmed}]`).parseDocument()
      } catch {
        /* 元のエラーを投げる */
      }
    }
    throw e
  }
}

class Parser {
  private i = 0
  private readonly s: string

  constructor(s: string) {
    this.s = s
  }

  parseDocument(): unknown {
    const v = this.value()
    this.skip()
    if (this.i < this.s.length) this.fail('余分な文字があります')
    return v
  }

  private fail(msg: string): never {
    const line = this.s.slice(0, this.i).split('\n').length
    throw new Error(`${line} 行目: ${msg}`)
  }

  /** 空白とコメントを読み飛ばす */
  private skip() {
    const s = this.s
    while (this.i < s.length) {
      const c = s[this.i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '﻿') {
        this.i++
      } else if (c === '/' && s[this.i + 1] === '/') {
        while (this.i < s.length && s[this.i] !== '\n') this.i++
      } else if (c === '/' && s[this.i + 1] === '*') {
        const end = s.indexOf('*/', this.i + 2)
        this.i = end < 0 ? s.length : end + 2
      } else if (c === '#') {
        // hjson の # コメント
        while (this.i < s.length && s[this.i] !== '\n') this.i++
      } else {
        break
      }
    }
  }

  private value(): unknown {
    this.skip()
    const c = this.s[this.i]
    if (c === '{') return this.object()
    if (c === '[') return this.array()
    if (c === '"' || c === "'") return this.string()
    if (c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9')) return this.number()
    const word = this.identifier()
    if (word === 'true') return true
    if (word === 'false') return false
    if (word === 'null') return null
    return this.fail(`読めない値です: ${word || c}`)
  }

  private object(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    this.i++ // {
    for (;;) {
      this.skip()
      if (this.s[this.i] === '}') { this.i++; return out }
      const c = this.s[this.i]
      const key = c === '"' || c === "'" ? this.string() : this.identifier()
      if (!key) this.fail('キーがありません')
      this.skip()
      if (this.s[this.i] !== ':') this.fail(': がありません')
      this.i++
      const v = this.value()
      // プロトタイプを書き換える名前は取り込まない
      if (key !== '__proto__') out[key] = v
      this.skip()
      if (this.s[this.i] === ',') { this.i++; continue }
      if (this.s[this.i] === '}') { this.i++; return out }
      this.fail(', か } がありません')
    }
  }

  private array(): unknown[] {
    const out: unknown[] = []
    this.i++ // [
    for (;;) {
      this.skip()
      if (this.s[this.i] === ']') { this.i++; return out }
      out.push(this.value())
      this.skip()
      if (this.s[this.i] === ',') { this.i++; continue }
      if (this.s[this.i] === ']') { this.i++; return out }
      this.fail(', か ] がありません')
    }
  }

  private string(): string {
    const quote = this.s[this.i++]
    let out = ''
    while (this.i < this.s.length) {
      const c = this.s[this.i++]
      if (c === quote) return out
      if (c !== '\\') { out += c; continue }
      const e = this.s[this.i++]
      if (e === 'n') out += '\n'
      else if (e === 't') out += '\t'
      else if (e === 'r') out += '\r'
      else if (e === 'b') out += '\b'
      else if (e === 'f') out += '\f'
      else if (e === 'u') {
        out += String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16))
        this.i += 4
      } else if (e === '\n') {
        /* 行継続 */
      } else out += e
    }
    return this.fail('文字列が閉じていません')
  }

  private number(): number {
    const m = this.match(NUMBER_RE)
    if (!m) this.fail('数値が読めません')
    const n = Number(m.replace(/^\+/, ''))
    if (!Number.isFinite(n)) this.fail('数値が読めません')
    return n
  }

  private identifier(): string {
    return this.match(IDENT_RE) ?? ''
  }

  /** 今の位置から正規表現に一致するぶんを読み進める（大きなファイルでも文字列を切り出さない） */
  private match(re: RegExp): string | null {
    re.lastIndex = this.i
    const m = re.exec(this.s)
    if (!m) return null
    this.i += m[0].length
    return m[0]
  }
}

const NUMBER_RE = /[+-]?(?:0x[0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y
const IDENT_RE = /[A-Za-z_$][\w$]*/y
