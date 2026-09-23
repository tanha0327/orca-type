import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { profileFromUser } from '../lib/auth'
import {
  fetchProfileRow, profileEnabled, resolveProfile, saveProfile, type Profile, type ProfileRow,
} from '../lib/profile'

interface ProfileState {
  userId: string | null
  loaded: boolean
  row: ProfileRow | null
  profile: Profile | null
  /** プロフィール編集モーダルが開いているか */
  editorOpen: boolean
  /** 行が無い状態で開いた＝初回サインイン */
  isFirstSignIn: boolean

  /** ログイン中のユーザーのプロフィールを読み込む。行が無ければ編集モーダルを自動で開く */
  load: (user: User) => Promise<void>
  reset: () => void
  openEditor: () => void
  closeEditor: () => void
  save: (userId: string, input: { name: string; avatarUrl: string }) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  userId: null,
  loaded: false,
  row: null,
  profile: null,
  editorOpen: false,
  isFirstSignIn: false,

  load: async (user) => {
    if (get().userId === user.id && get().loaded) return
    // 読み込み中も Google の情報でひとまず表示しておく（読み込み完了までのちらつき防止）
    set({ userId: user.id, loaded: false, profile: profileFromUser(user) })

    if (!profileEnabled()) {
      set({ profile: profileFromUser(user), loaded: true })
      return
    }

    try {
      const row = await fetchProfileRow(user.id)
      const firstSignIn = row === null
      set({
        row,
        profile: resolveProfile(user, row),
        loaded: true,
        editorOpen: firstSignIn,
        isFirstSignIn: firstSignIn,
      })
    } catch {
      // プロフィールテーブルがまだ無い環境でも、Google の情報だけでアプリは動かす
      set({ profile: profileFromUser(user), loaded: true })
    }
  },

  reset: () => set({
    userId: null, loaded: false, row: null, profile: null, editorOpen: false, isFirstSignIn: false,
  }),

  openEditor: () => set({ editorOpen: true }),
  closeEditor: () => set({ editorOpen: false }),

  save: async (userId, input) => {
    await saveProfile(userId, input)
    set({
      row: { user_id: userId, display_name: input.name, avatar_url: input.avatarUrl, updated_at: new Date().toISOString() },
      profile: { name: input.name, avatarUrl: input.avatarUrl },
      editorOpen: false,
      isFirstSignIn: false,
    })
  },
}))
