import type { User } from '@supabase/supabase-js'
import { profileFromUser } from './auth'
import { supabase } from './supabase'

export interface Profile {
  name: string
  avatarUrl: string | null
}

export interface ProfileRow {
  user_id: string
  display_name: string
  avatar_url: string
  updated_at: string
}

export function profileEnabled(): boolean {
  return supabase !== null
}

/** 自分のプロフィール行を取る。無ければ null（＝初回サインイン扱い） */
export async function fetchProfileRow(userId: string): Promise<ProfileRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveProfile(userId: string, input: { name: string; avatarUrl: string }): Promise<void> {
  if (!supabase) throw new Error('プロフィール機能は設定されていません')
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    display_name: input.name,
    avatar_url: input.avatarUrl,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

/** 自前のアイコン画像を `avatars/<user_id>/...` にアップロードして公開 URL を返す */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('アップロード機能は設定されていません')
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('画像は 2MB 以下にしてください')

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'png'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/** プロフィール行があればそれを、無ければ Google のアカウント情報を使う */
export function resolveProfile(user: User, row: ProfileRow | null): Profile {
  if (row) return { name: row.display_name, avatarUrl: row.avatar_url }
  return profileFromUser(user)
}
