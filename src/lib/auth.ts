import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function authEnabled(): boolean {
  return supabase !== null
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('ログイン機能は設定されていません')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('ログイン機能は設定されていません')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** 戻り値の needsEmailConfirmation は、確認メールのリンクを踏むまでログインできない場合に true */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ needsEmailConfirmation: boolean }> {
  if (!supabase) throw new Error('ログイン機能は設定されていません')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
  return { needsEmailConfirmation: !data.session }
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('ログイン機能は設定されていません')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** Google の user_metadata から表示名・アイコン URL を取り出す */
export function profileFromUser(user: User): { name: string; avatarUrl: string | null } {
  const meta = user.user_metadata ?? {}
  const name = (meta.full_name as string | undefined)
    || (meta.name as string | undefined)
    || user.email
    || '名無しさん'
  const avatarUrl = (meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null
  return { name, avatarUrl }
}
