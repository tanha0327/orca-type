import { PUBLIC_SITE_URL } from './site'
import { supabase } from './supabase'

/**
 * X（旧 Twitter）の「ポストで本人確認」。有料の X API は使わない。
 * ユーザーが確認コード入りのポストをして、その URL を貼ると、DB 側の verify_x_post() が
 * X の公開 oEmbed でポストの投稿者と本文を確かめ、公開テーブル x_verifications に記録する。
 * （supabase/sql/005_x_verification.sql を参照）
 */

export interface XVerification {
  userId: string
  username: string
  /** 確認に使ったポストの ID（記録用。確認後にポストを消してもバッジは残る） */
  postId: string
}

export function xVerificationEnabled(): boolean {
  return supabase !== null
}

/** バッジから開く X のプロフィール。確認に使ったポストは消されることがあるので、ポストではなくこちらを開く */
export function xProfileUrl(v: XVerification): string {
  return `https://x.com/${encodeURIComponent(v.username)}`
}

/** 確認コード入りのポストの投稿画面（X の Web Intent。API ではないので無料） */
export function xVerificationIntentUrl(code: string): string {
  const text = [
    'ORCA MAP で本人確認しました ✅',
    'Keychron Orca echo のキーマップを作って、みんなと共有できます ⌨️',
    '',
    `確認コード: ${code}`,
    '#Orcaecho',
  ].join('\n')
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(PUBLIC_SITE_URL)}`
}

/** 本人確認の関数がまだ DB に無い（SQL が未実行）ときのエラーか */
export function isXVerificationUnavailable(e: unknown): boolean {
  return !!e && typeof e === 'object' && 'code' in e && e.code === 'PGRST202'
}

/** ログイン中のユーザーの確認コード（ユーザーごとに決まっていて、何度取っても同じ） */
export async function fetchMyXVerificationCode(): Promise<string> {
  if (!supabase) throw new Error('本人確認は設定されていません')
  const { data, error } = await supabase.rpc('my_x_verification_code')
  if (error) throw error
  if (typeof data !== 'string' || !data) throw new Error('確認コードを取得できませんでした')
  return data
}

/** 貼られたポストの URL で本人確認する。確かめられなければ、理由を書いた Error を投げる */
export async function verifyXPost(userId: string, postUrl: string): Promise<XVerification> {
  if (!supabase) throw new Error('本人確認は設定されていません')
  const { data, error } = await supabase.rpc('verify_x_post', { post_url: postUrl })
  if (error) throw error
  const result = data as { ok: boolean; error?: string; username?: string; post_id?: string } | null
  if (!result?.ok || !result.username || !result.post_id) {
    throw new Error(result?.error ?? '本人確認に失敗しました')
  }
  return { userId, username: result.username, postId: result.post_id }
}

export async function removeXVerification(userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('x_verifications').delete().eq('user_id', userId)
  if (error) throw error
}

/** 指定したユーザーのうち、X で本人確認済みの人の情報を user_id ごとに返す */
export async function fetchXVerifications(userIds: string[]): Promise<Record<string, XVerification>> {
  const ids = [...new Set(userIds)]
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase
    .from('x_verifications')
    .select('user_id, x_username, post_id')
    .in('user_id', ids)
  if (error) throw error
  const result: Record<string, XVerification> = {}
  for (const row of data ?? []) {
    result[row.user_id] = { userId: row.user_id, username: row.x_username, postId: row.post_id }
  }
  return result
}
