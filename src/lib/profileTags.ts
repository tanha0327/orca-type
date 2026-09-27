import { sanitizeKeyboards } from '../data/keyboardCatalog'
import { supabase } from './supabase'

/**
 * プロフィールの公開タグ（持っているキーボード・分割初心者）。
 * 表示名・アイコン（profiles。本人しか読めない）とは別の profile_tags テーブルに置き、
 * みんなの配列でほかの人にも見せる（supabase/sql/008_profile_tags_and_beginner_recs.sql）。
 */
export interface ProfileTags {
  /** 持っているキーボード（一覧にあるものは ID、無いものは入力された名前）。登録した順 */
  keyboards: string[]
  /** 分割キーボード初心者。名前の横に 🔰 を出し、初心者におすすめの配列を見せる */
  splitBeginner: boolean
}

export const EMPTY_PROFILE_TAGS: ProfileTags = { keyboards: [], splitBeginner: false }

export function profileTagsEnabled(): boolean {
  return supabase !== null
}

/** 指定したユーザーのうち、タグを設定したことのある人のタグを user_id ごとに返す */
export async function fetchProfileTags(userIds: string[]): Promise<Record<string, ProfileTags>> {
  const ids = [...new Set(userIds)]
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase
    .from('profile_tags')
    .select('user_id, keyboards, split_beginner')
    .in('user_id', ids)
  if (error) throw error
  const result: Record<string, ProfileTags> = {}
  for (const row of data ?? []) {
    result[row.user_id] = {
      keyboards: sanitizeKeyboards(row.keyboards),
      splitBeginner: row.split_beginner === true,
    }
  }
  return result
}

/** 自分のタグを保存する（RLS により本人の行しか書けない） */
export async function saveProfileTags(userId: string, tags: ProfileTags): Promise<void> {
  if (!supabase) throw new Error('プロフィール機能は設定されていません')
  const { error } = await supabase.from('profile_tags').upsert({
    user_id: userId,
    keyboards: tags.keyboards,
    split_beginner: tags.splitBeginner,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export function sameProfileTags(a: ProfileTags, b: ProfileTags): boolean {
  return a.splitBeginner === b.splitBeginner
    && a.keyboards.length === b.keyboards.length
    && a.keyboards.every((k, i) => k === b.keyboards[i])
}
