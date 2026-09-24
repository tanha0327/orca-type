import { isValidKeymapShape, type Keymap } from '../data/types'
import { supabase } from './supabase'

export interface SharedKeymap {
  id: string
  name: string
  author: string
  description: string | null
  keymap: Keymap
  created_at: string
  user_id: string | null
  avatar_url: string | null
}

export interface FeedExtras {
  likeCounts: Record<string, number>
  likedByMe: Set<string>
  commentCounts: Record<string, number>
}

export interface KeymapComment {
  id: string
  keymap_id: string
  user_id: string
  author_name: string
  avatar_url: string | null
  body: string
  created_at: string
}

/** みんなの配列の並び順 */
export type FeedSort = 'hot' | 'popular' | 'new' | 'old'

export const FEED_SORTS: readonly FeedSort[] = ['hot', 'popular', 'new', 'old']

export function isFeedSort(x: unknown): x is FeedSort {
  return FEED_SORTS.includes(x as FeedSort)
}

export interface FeedPage {
  items: SharedKeymap[]
  /** いいね・コメントのテーブルが読めず、今熱い／人気の代わりに新しい順で返したとき true */
  rankFallback: boolean
}

const FEED_LIMIT = 50

/** 今熱い・人気の順位付けで見る、直近の投稿の数（これより古い投稿は候補に入らない） */
const RANK_POOL = 1000

/** 今熱い: 投稿・いいね・コメントの勢いが半分になるまでの時間 */
const HOT_HALF_LIFE_MS = 72 * 3600 * 1000

/** コメントはいいねの半分の重みで数える（何回でも書けるので） */
const HOT_COMMENT_WEIGHT = 0.5

export function feedEnabled(): boolean {
  return supabase !== null
}

/**
 * 壊れた形の keymap が紛れ込んでいても落ちないよう弾く。
 * user_id / avatar_url をまだ持たないテーブルでも一覧は出せるよう、列は * で取って埋める。
 */
function toSharedKeymaps(rows: any[] | null): SharedKeymap[] {
  return (rows ?? [])
    .filter((row) => isValidKeymapShape(row.keymap))
    .map((row) => ({
      id: row.id,
      name: row.name,
      author: row.author,
      description: row.description ?? null,
      keymap: row.keymap,
      created_at: row.created_at,
      user_id: row.user_id ?? null,
      avatar_url: row.avatar_url ?? null,
    }))
}

/** 指定の並び順で最大 50 件 */
export async function fetchFeed(sort: FeedSort): Promise<FeedPage> {
  if (!supabase) throw new Error('共有フィードは設定されていません')

  if (sort === 'hot' || sort === 'popular') {
    let ids: string[]
    try {
      ids = await fetchRankedIds(sort)
    } catch {
      // いいね・コメントのテーブルがまだ無い環境でも、一覧そのものは新しい順で出す
      return { items: (await fetchFeed('new')).items, rankFallback: true }
    }
    if (ids.length === 0) return { items: [], rankFallback: false }
    const { data, error } = await supabase.from('shared_keymaps').select('*').in('id', ids)
    if (error) throw error
    const byId = new Map(toSharedKeymaps(data).map((item) => [item.id, item]))
    return {
      items: ids.flatMap((id) => byId.get(id) ?? []),
      rankFallback: false,
    }
  }

  const { data, error } = await supabase
    .from('shared_keymaps')
    .select('*')
    .order('created_at', { ascending: sort === 'old' })
    .limit(FEED_LIMIT)
  if (error) throw error
  return { items: toSharedKeymaps(data), rankFallback: false }
}

interface RankRow {
  id: string
  created_at: string
  keymap_likes: { created_at: string }[] | null
  keymap_comments: { created_at: string }[] | null
}

/**
 * 今熱い／人気の上位 50 件の ID を順番どおりに返す。
 * いいね・コメントは投稿ごとの件数で並べ替えられない（PostgREST では集計順に並べられない）ので、
 * 直近の投稿にいいね・コメントの日時をぶら下げて取り、こちらで点数を付けて並べる。
 */
async function fetchRankedIds(sort: 'hot' | 'popular'): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('shared_keymaps')
    .select('id, created_at, keymap_likes(created_at), keymap_comments(created_at)')
    .order('created_at', { ascending: false })
    .limit(RANK_POOL)
  if (error) throw error

  const rows = (data ?? []) as RankRow[]
  const now = Date.now()
  // 経過時間に応じて 1 → 0 に減っていく重み。未来の日時（時計のずれ）は 1 として扱う
  const fresh = (iso: string) => 0.5 ** (Math.max(0, now - Date.parse(iso)) / HOT_HALF_LIFE_MS)

  const ranked = rows.map((row) => {
    const likes = row.keymap_likes ?? []
    const comments = row.keymap_comments ?? []
    const score = sort === 'popular'
      ? likes.length
      // 投稿そのものも「いいね 1 つ分」の勢いから始まるので、新着はしばらく上に出る
      : fresh(row.created_at)
        + likes.reduce((sum, l) => sum + fresh(l.created_at), 0)
        + HOT_COMMENT_WEIGHT * comments.reduce((sum, c) => sum + fresh(c.created_at), 0)
    return { id: row.id, score, comments: comments.length, createdAt: Date.parse(row.created_at) }
  })

  ranked.sort((a, b) => (
    b.score - a.score
    || b.comments - a.comments
    || b.createdAt - a.createdAt
  ))
  return ranked.slice(0, FEED_LIMIT).map((r) => r.id)
}

/** 右上に固定していた投稿を、一覧に無くても（並び順を変えた後など）1 件だけ取り直す */
export async function fetchSharedKeymap(id: string): Promise<SharedKeymap | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('shared_keymaps').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return toSharedKeymaps(data ? [data] : [])[0] ?? null
}

/** 一覧に出す投稿分の、いいね数・自分がいいね済みか・コメント数をまとめて取得する */
export async function fetchFeedExtras(keymapIds: string[], myUserId: string | null): Promise<FeedExtras> {
  const empty: FeedExtras = { likeCounts: {}, likedByMe: new Set(), commentCounts: {} }
  if (!supabase || keymapIds.length === 0) return empty

  const [likesRes, commentsRes] = await Promise.all([
    supabase.from('keymap_likes').select('keymap_id, user_id').in('keymap_id', keymapIds),
    supabase.from('keymap_comments').select('keymap_id').in('keymap_id', keymapIds),
  ])
  if (likesRes.error) throw likesRes.error
  if (commentsRes.error) throw commentsRes.error

  const likeCounts: Record<string, number> = {}
  const likedByMe = new Set<string>()
  for (const row of likesRes.data ?? []) {
    likeCounts[row.keymap_id] = (likeCounts[row.keymap_id] ?? 0) + 1
    if (myUserId && row.user_id === myUserId) likedByMe.add(row.keymap_id)
  }

  const commentCounts: Record<string, number> = {}
  for (const row of commentsRes.data ?? []) {
    commentCounts[row.keymap_id] = (commentCounts[row.keymap_id] ?? 0) + 1
  }

  return { likeCounts, likedByMe, commentCounts }
}

/** 投稿にはログインが必要（RLS 側でも auth.uid() = user_id を要求している） */
export async function shareKeymap(input: {
  name: string
  author: string
  description: string
  keymap: Keymap
  userId: string
  avatarUrl: string | null
}): Promise<void> {
  if (!supabase) throw new Error('共有フィードは設定されていません')
  const { error } = await supabase.from('shared_keymaps').insert({
    name: input.name,
    author: input.author,
    description: input.description || null,
    keymap: input.keymap,
    user_id: input.userId,
    avatar_url: input.avatarUrl,
  })
  if (error) throw error
}

/** ログイン中のユーザーとして、いいねの ON/OFF を切り替える */
export async function toggleLike(keymapId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (!supabase) throw new Error('いいね機能は設定されていません')
  if (currentlyLiked) {
    const { error } = await supabase
      .from('keymap_likes')
      .delete()
      .eq('keymap_id', keymapId)
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('keymap_likes')
      .insert({ keymap_id: keymapId, user_id: userId })
    if (error) throw error
  }
}

export async function fetchComments(keymapId: string): Promise<KeymapComment[]> {
  if (!supabase) throw new Error('コメント機能は設定されていません')
  const { data, error } = await supabase
    .from('keymap_comments')
    .select('id, keymap_id, user_id, author_name, avatar_url, body, created_at')
    .eq('keymap_id', keymapId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function postComment(input: {
  keymapId: string
  userId: string
  authorName: string
  avatarUrl: string | null
  body: string
}): Promise<void> {
  if (!supabase) throw new Error('コメント機能は設定されていません')
  const { error } = await supabase.from('keymap_comments').insert({
    keymap_id: input.keymapId,
    user_id: input.userId,
    author_name: input.authorName,
    avatar_url: input.avatarUrl,
    body: input.body,
  })
  if (error) throw error
}

export async function deleteComment(commentId: string): Promise<void> {
  if (!supabase) throw new Error('コメント機能は設定されていません')
  const { error } = await supabase.from('keymap_comments').delete().eq('id', commentId)
  if (error) throw error
}

/** 自分の投稿を削除する（RLS により本人以外は削除できない） */
export async function deleteKeymap(keymapId: string): Promise<void> {
  if (!supabase) throw new Error('共有フィードは設定されていません')
  const { error } = await supabase.from('shared_keymaps').delete().eq('id', keymapId)
  if (error) throw error
}
