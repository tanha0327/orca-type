import { keyboardOf } from '../src/keyboards/registry'
import type { SharedKeymapRow } from './sharedKeymap'

/**
 * カード画像のデザインを変えたら 1 つ上げる。
 * /api/og の画像は 1 年キャッシュされ、X なども og:image の URL ごとに覚えているので、
 * URL を変えないと古いデザインのまま出続ける。
 */
export const OG_CARD_VERSION = 1

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function truncate(s: string, max: number): string {
  const chars = [...s]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : s
}

/** <meta property="og:xxx" content="..."> の content だけを差し替える */
function setMeta(html: string, property: string, value: string): string {
  const re = new RegExp(`(<meta\\s+property="${property}"\\s+content=")[^"]*(")`)
  // 置換文字列だと値の中の $ が特殊扱いされるので、関数で返す
  return html.replace(re, (_, head: string, tail: string) => `${head}${escapeAttr(value)}${tail}`)
}

/** index.html の OGP を、共有された配列 1 件ぶんの内容に差し替える */
export function withKeymapMeta(html: string, item: SharedKeymapRow, origin: string): string {
  const { keymap } = item
  const combos = keymap.combos.filter((c) => c.enabled).length
  const description = item.description?.trim()
    || `${keymap.layers.length} レイヤー・コンボ ${combos} 個の ${keyboardOf(keymap).name} のキーマップ。`
      + 'ORCA MAP で全レイヤーを見て、そのまま読み込んで編集できます。'
  const image = new URL('/api/og', origin)
  image.searchParams.set('k', item.id)
  image.searchParams.set('v', String(OG_CARD_VERSION))

  let out = html
  out = setMeta(out, 'og:title', `『${truncate(item.name, 60)}』${truncate(item.author, 30)} さんの配列 — ORCA MAP`)
  out = setMeta(out, 'og:description', truncate(description, 150))
  out = setMeta(out, 'og:image', image.toString())
  out = setMeta(out, 'og:image:alt', `『${truncate(item.name, 60)}』のキー配列と特徴`)
  return out
}
