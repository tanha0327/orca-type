import { normalizeKeymap } from '../src/data/normalize'
import type { Keymap } from '../src/data/types'
import { isCategoryId, type CategoryId } from '../src/engine/analyze'
import { isKeymapId } from '../src/lib/permalink'

/** OGP（カード画像・メタタグ）に使う投稿 1 件ぶんの情報 */
export interface SharedKeymapRow {
  id: string
  name: string
  author: string
  description: string | null
  keymap: Keymap
  /** 投稿時に選んだカテゴリ。無ければ表示側で自動判定する */
  category: CategoryId | null
}

/**
 * Vercel の Edge（middleware / api）から、投稿 1 件を Supabase の REST で直接取る。
 * supabase-js を持ち込むほどでもないので fetch だけで済ませる。
 * 環境変数はアプリと同じ VITE_SUPABASE_*（Vercel では関数からも読める）。
 * keymap はアプリの一覧と同じく normalizeKeymap で今の形にそろえる（古い形の投稿も描けるように）。
 * 見つからない・設定が無い・壊れた形のときは null。
 */
export async function fetchSharedKeymap(id: string, timeoutMs = 3000): Promise<SharedKeymapRow | null> {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key || !isKeymapId(id)) return null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `${base}/rest/v1/shared_keymaps?id=eq.${id}&select=*`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: ctrl.signal },
    )
    if (!res.ok) return null
    const rows: unknown = await res.json()
    const row = Array.isArray(rows) ? rows[0] : null
    const keymap = row ? normalizeKeymap(row.keymap) : null
    if (!row || !keymap) return null
    return {
      id: row.id,
      name: String(row.name ?? ''),
      author: String(row.author ?? ''),
      description: row.description ?? null,
      keymap,
      category: isCategoryId(row.category) ? row.category : null,
    }
  } finally {
    clearTimeout(timer)
  }
}
