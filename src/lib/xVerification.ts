import type { User, UserIdentity } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * X（旧 Twitter）のアカウント連携による本人確認。
 * 連携そのものは Supabase Auth の identity linking（linkIdentity）で行い、
 * 他の人にも見せる「@ユーザー名 で本人確認済み」は公開テーブル x_verifications から読む
 * （書き込めるのは DB 側の sync_x_verification() だけ。supabase/sql/005_x_verification.sql を参照）。
 */

export interface XVerification {
  userId: string
  /** X の数値のユーザー ID。@ユーザー名は変更されうるので、プロフィールへのリンクはこちらで張る */
  xUserId: string
  username: string
}

/** 連携には OAuth 2.0 の 'x' を使う。旧 OAuth 1.0a の 'twitter' で連携済みの人も本人確認済みとして扱う */
const LINK_PROVIDER = 'x'
const X_PROVIDERS = ['x', 'twitter']

/** X の認証ページへ移動する前に立てておき、戻ってきたときに結果を表示するための目印 */
const LINK_PENDING_KEY = 'orca:x-link-pending'

/** ストレージが使えないブラウザ設定でも、アプリの読み込み自体は止めないようにする */
function pendingFlag(action: 'get' | 'set' | 'remove'): boolean {
  try {
    if (action === 'set') sessionStorage.setItem(LINK_PENDING_KEY, '1')
    else if (action === 'remove') sessionStorage.removeItem(LINK_PENDING_KEY)
    else return sessionStorage.getItem(LINK_PENDING_KEY) !== null
  } catch {
    // 何もしない
  }
  return false
}

const LINK_ERROR_MESSAGES: Record<string, string> = {
  identity_already_exists: 'この X アカウントは、すでに別の ORCA MAP アカウントと連携されています',
  manual_linking_disabled: 'X 連携が有効になっていません（Supabase の「Allow manual linking」を ON にしてください）',
  provider_disabled: 'X ログインが有効になっていません（Supabase で X / Twitter (OAuth 2.0) を有効にしてください）',
  oauth_provider_not_supported: 'X ログインが有効になっていません（Supabase で X / Twitter (OAuth 2.0) を有効にしてください）',
  single_identity_not_deletable: 'ログイン手段が X だけのため、連携を解除できません',
  identity_not_found: 'X との連携が見つかりませんでした。ページを再読み込みしてください',
  access_denied: 'X での連携がキャンセルされました',
}

export function xVerificationEnabled(): boolean {
  return supabase !== null
}

export function xIdentityOf(user: User): UserIdentity | null {
  return user.identities?.find((i) => X_PROVIDERS.includes(i.provider)) ?? null
}

export function xUsernameOf(identity: UserIdentity): string | null {
  const data = identity.identity_data ?? {}
  return (data.user_name as string | undefined) || (data.preferred_username as string | undefined) || null
}

/** 自分の連携情報を、他人向けの表示と同じ形にする（公開テーブルの同期を待たずに出せるように） */
export function verificationFromUser(user: User): XVerification | null {
  const identity = xIdentityOf(user)
  const username = identity && xUsernameOf(identity)
  if (!identity || !username) return null
  return { userId: user.id, xUserId: identity.id, username }
}

export function xProfileUrl(v: XVerification): string {
  return `https://x.com/i/user/${encodeURIComponent(v.xUserId)}`
}

function linkErrorMessage(code: string | undefined, fallback: string): string {
  return (code && LINK_ERROR_MESSAGES[code]) || fallback
}

/** ログイン中のアカウントに X を紐づける。X の認証ページへリダイレクトし、終わるとこのページに戻ってくる */
export async function linkXAccount(): Promise<void> {
  if (!supabase) throw new Error('X 連携は設定されていません')
  pendingFlag('set')
  const { error } = await supabase.auth.linkIdentity({
    provider: LINK_PROVIDER,
    options: { redirectTo: window.location.origin },
  })
  if (error) {
    pendingFlag('remove')
    throw new Error(linkErrorMessage(error.code, error.message))
  }
}

export async function unlinkXAccount(user: User): Promise<void> {
  if (!supabase) throw new Error('X 連携は設定されていません')
  const identity = xIdentityOf(user)
  if (!identity) return
  const { error } = await supabase.auth.unlinkIdentity(identity)
  if (error) throw new Error(linkErrorMessage(error.code, error.message))
  // 手元のセッションの user.identities は古いままなので、取り直して authStore に反映させる
  await supabase.auth.refreshSession()
}

/** ログイン中のユーザーの連携状態を、公開テーブル x_verifications に反映する */
export async function syncXVerification(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('sync_x_verification')
  if (error) throw error
}

/** 指定したユーザーのうち、X で本人確認済みの人の情報を user_id ごとに返す */
export async function fetchXVerifications(userIds: string[]): Promise<Record<string, XVerification>> {
  const ids = [...new Set(userIds)]
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase
    .from('x_verifications')
    .select('user_id, x_user_id, x_username')
    .in('user_id', ids)
  if (error) throw error
  const result: Record<string, XVerification> = {}
  for (const row of data ?? []) {
    result[row.user_id] = { userId: row.user_id, xUserId: row.x_user_id, username: row.x_username }
  }
  return result
}

/**
 * X の認証ページから戻ってきた直後なら、その結果を返す（連携の途中でなければ null）。
 * 失敗したときは URL に error_description などが付いて戻ってくるので、読んだら URL から消す。
 */
export function takeXLinkResult(): { error: string | null } | null {
  if (!pendingFlag('get')) return null
  pendingFlag('remove')

  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const pick = (key: string) => hash.get(key) ?? url.searchParams.get(key)
  const code = pick('error_code') ?? pick('error') ?? undefined
  const description = pick('error_description')
  if (!code && !description) return { error: null }

  for (const key of ['error', 'error_code', 'error_description']) {
    hash.delete(key)
    url.searchParams.delete(key)
  }
  url.hash = hash.toString()
  window.history.replaceState(window.history.state, '', url.toString())

  return { error: linkErrorMessage(code, description ?? 'X との連携に失敗しました') }
}
