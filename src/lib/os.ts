import { isKeymapOs, type Keymap, type KeymapOs } from '../data/types.js'

export interface OsTagDef {
  id: KeymapOs
  label: string
  emoji: string
  /** ツールチップ・投稿モーダル用 */
  help: string
}

/** 表示順 */
export const OS_TAGS: readonly OsTagDef[] = [
  { id: 'mac', label: 'Mac', emoji: '🍎', help: 'Mac で使っている配列（⌘ や 英数／かな を前提にした割当）' },
  { id: 'windows', label: 'Windows', emoji: '🪟', help: 'Windows で使っている配列（Ctrl・Win や 変換／無変換 を前提にした割当）' },
]

const OS_TAG_BY_ID = new Map<KeymapOs, OsTagDef>(OS_TAGS.map((t) => [t.id, t]))

export function getOsTag(id: KeymapOs): OsTagDef {
  return OS_TAG_BY_ID.get(id)!
}

/** 投稿された配列の OS タグ。タグの無い古い投稿や、壊れた値は null */
export function osOf(km: Keymap): KeymapOs | null {
  const os = km.settings?.os
  return isKeymapOs(os) ? os : null
}

/** 配列の OS タグを付け替える（null ならタグを外す） */
export function withOs(km: Keymap, os: KeymapOs | null): Keymap {
  const { os: _drop, ...settings } = km.settings
  return { ...km, settings: os ? { ...settings, os } : settings }
}

/**
 * いま使っているパソコンの OS。投稿モーダルの初期値に使う。
 * スマホやタブレット、Linux など、Mac / Windows と言い切れないときは null
 */
export function detectOs(): KeymapOs | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } }
  if (nav.userAgentData?.mobile || /iphone|ipad|ipod|android/i.test(nav.userAgent)) return null
  const platform = `${nav.userAgentData?.platform ?? ''} ${nav.platform ?? ''} ${nav.userAgent}`
  // iPad の Safari は Mac と名乗るので、タッチ画面かどうかで見分ける
  if (/\bmac/i.test(platform)) return nav.maxTouchPoints > 1 ? null : 'mac'
  if (/windows|win32|win64/i.test(platform)) return 'windows'
  return null
}
