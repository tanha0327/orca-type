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

export function feedEnabled(): boolean {
  return supabase !== null
}

/**
 * 新しい順に最大 50 件。壊れた形の keymap が紛れ込んでいても落ちないよう弾く。
 * user_id / avatar_url をまだ持たないテーブルでも一覧は出せるよう、列は * で取って埋める。
 */
export async function fetchFeed(): Promise<SharedKeymap[]> {
  if (!supabase) throw new Error('共有フィードは設定されていません')
  const { data, error } = await supabase
    .from('shared_keymaps')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).filter((row) => isValidKeymapShape(row.keymap)).map(toSharedKeymap)
}

/** 共有リンク（?k=<投稿ID>）から開くときの 1 件取得。削除済み・壊れた形なら null */
export async function fetchKeymapById(id: string): Promise<SharedKeymap | null> {
  if (!supabase) throw new Error('共有フィードは設定されていません')
  const { data, error } = await supabase
    .from('shared_keymaps')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data && isValidKeymapShape(data.keymap) ? toSharedKeymap(data) : null
}

/** user_id / avatar_url をまだ持たない古いテーブルの行も受けられるよう、その列は省略可にしておく */
type SharedKeymapRow = Omit<SharedKeymap, 'description' | 'user_id' | 'avatar_url'> & {
  description?: string | null
  user_id?: string | null
  avatar_url?: string | null
}

function toSharedKeymap(row: SharedKeymapRow): SharedKeymap {
  return {
    id: row.id,
    name: row.name,
    author: row.author,
    description: row.description ?? null,
    keymap: row.keymap,
    created_at: row.created_at,
    user_id: row.user_id ?? null,
    avatar_url: row.avatar_url ?? null,
  }
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
