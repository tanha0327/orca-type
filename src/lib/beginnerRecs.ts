import { sameKeyboard } from '../data/keyboardCatalog'
import { keyboardOf } from '../keyboards/registry'
import { isCustomKeyboardId } from '../keyboards/types'
import type { SharedKeymap } from './feed'
import { supabase } from './supabase'

/**
 * みんなの配列の「分割初心者におすすめ」。いいねと同じく、投稿ごと・ユーザーごとに 1 つ付けられる
 * （keymap_beginner_recs。supabase/sql/008_profile_tags_and_beginner_recs.sql）。
 * 投稿者が投稿するときに付けることも、慣れている人がほかの人の投稿にあとから付けることもできる。
 */
export interface BeginnerRecs {
  /** 投稿 ID → おすすめした人の数 */
  counts: Record<string, number>
  /** 自分がおすすめした投稿の ID */
  mine: Set<string>
}

/** 読み込むおすすめの数（新しいものから。Supabase の API が 1 回に返せる行数の上限） */
const RECS_LIMIT = 1000

export function beginnerRecsEnabled(): boolean {
  return supabase !== null
}

export async function fetchBeginnerRecs(myUserId: string | null): Promise<BeginnerRecs> {
  const recs: BeginnerRecs = { counts: {}, mine: new Set() }
  if (!supabase) return recs
  const { data, error } = await supabase
    .from('keymap_beginner_recs')
    .select('keymap_id, user_id')
    .order('created_at', { ascending: false })
    .limit(RECS_LIMIT)
  if (error) throw error
  for (const row of data ?? []) {
    recs.counts[row.keymap_id] = (recs.counts[row.keymap_id] ?? 0) + 1
    if (myUserId && row.user_id === myUserId) recs.mine.add(row.keymap_id)
  }
  return recs
}

/** ログイン中のユーザーとして、おすすめを付ける・外す */
export async function setBeginnerRec(keymapId: string, userId: string, on: boolean): Promise<void> {
  if (!supabase) throw new Error('おすすめ機能は設定されていません')
  if (on) {
    const { error } = await supabase.from('keymap_beginner_recs').insert({ keymap_id: keymapId, user_id: userId })
    // 別のタブなどで既におすすめしていた（主キーの重複）なら、付いている状態なのでそのままでよい
    if (error && error.code !== '23505') throw error
  } else {
    const { error } = await supabase
      .from('keymap_beginner_recs')
      .delete()
      .eq('keymap_id', keymapId)
      .eq('user_id', userId)
    if (error) throw error
  }
}

/**
 * 投稿がどのキーボードの配列か。組み込みのキーボードはその ID（プロフィールの一覧と同じ ID）、
 * 取り込んだキーボードは、プロフィールに名前で登録したものと比べられるよう定義の名前
 */
export function keyboardIdOfPost(item: SharedKeymap): string {
  const id = item.keymap.keyboard
  return isCustomKeyboardId(id) ? keyboardOf(item.keymap).name : id
}

/**
 * 分割初心者の人に見せる「おすすめ」の並び。自分の投稿は除いて、
 * 持っているキーボードの配列 → おすすめした人が多い順 → いいねが多い順 → 新しい順。
 */
export function rankBeginnerPicks(
  items: SharedKeymap[],
  opts: {
    counts: Record<string, number>
    likeCounts: Record<string, number>
    ownedKeyboards: string[]
    myUserId: string | null
  },
): SharedKeymap[] {
  const owns = (item: SharedKeymap) => opts.ownedKeyboards.some((k) => sameKeyboard(k, keyboardIdOfPost(item)))
  const recs = (item: SharedKeymap) => opts.counts[item.id] ?? 0
  const likes = (item: SharedKeymap) => opts.likeCounts[item.id] ?? 0
  return items
    .filter((item) => recs(item) > 0 && (!opts.myUserId || item.user_id !== opts.myUserId))
    .sort((a, b) => (
      Number(owns(b)) - Number(owns(a))
      || recs(b) - recs(a)
      || likes(b) - likes(a)
      || Date.parse(b.created_at) - Date.parse(a.created_at)
    ))
}
