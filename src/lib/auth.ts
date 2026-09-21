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
