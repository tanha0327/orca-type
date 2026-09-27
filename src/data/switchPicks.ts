import type { Keymap, SwitchPick } from './types.js'

/*
 * 配列に添えたキースイッチの読み書き。編集画面のストアや保存データの検査（起動時に読み込む）からも使うので、
 * キースイッチのカタログ（switches.ts。開いたときに読み込む画面で使う）とは別のファイルにしている
 */

/** 同じスイッチか。ID があれば ID で、無ければ名前（大文字小文字・空白の違いは無視）で比べる */
export function samePick(a: SwitchPick, b: SwitchPick): boolean {
  if (a.id || b.id) return a.id === b.id
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  return norm(a.name) === norm(b.name)
}

/** 配列に添えられたキースイッチ。無い配列は空 */
export function switchesOf(km: Keymap): SwitchPick[] {
  return km.settings?.switches ?? []
}

/** 配列のキースイッチを付け替える（空なら持たない形に戻す） */
export function withSwitches(km: Keymap, picks: readonly SwitchPick[]): Keymap {
  const { switches: _drop, ...settings } = km.settings
  return { ...km, settings: picks.length > 0 ? { ...settings, switches: [...picks] } : settings }
}
