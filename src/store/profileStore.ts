import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { profileFromUser } from '../lib/auth'
import {
  fetchProfileRow, profileEnabled, resolveProfile, saveProfile, type Profile, type ProfileRow,
} from '../lib/profile'
import { fetchXVerifications, type XVerification } from '../lib/xVerification'

interface ProfileState {
  userId: string | null
  loaded: boolean
  row: ProfileRow | null
  profile: Profile | null
  /** プロフィール編集モーダルが開いているか */
  editorOpen: boolean
  /** 行が無い状態で開いた＝初回サインイン */
  isFirstSignIn: boolean
  /** ログイン中のユーザーの X 本人確認（未確認なら null） */
  verification: XVerification | null
  /** 自分の本人確認が変わるたびに増える。フィードのバッジを取り直す合図 */
  verificationRevision: number

  /** ログイン中のユーザーのプロフィールを読み込む。行が無ければ編集モーダルを自動で開く */
  load: (user: User) => Promise<void>
  reset: () => void
  openEditor: () => void
  closeEditor: () => void
  /** ログイン中のユーザーの X 本人確認を読み込む */
  loadVerification: (userId: string) => Promise<void>
  /** 本人確認した・取り消したときに、手元の状態とフィードのバッジを更新する */
  setVerification: (verification: XVerification | null) => void
  save: (userId: string, input: { name: string; avatarUrl: string }) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  userId: null,
  loaded: false,
  row: null,
  profile: null,
  editorOpen: false,
  isFirstSignIn: false,
  verification: null,
  verificationRevision: 0,

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
        // 読み込み中に自分で開いていたら、読み込み完了で閉じてしまわないようにする
        editorOpen: firstSignIn || get().editorOpen,
        isFirstSignIn: firstSignIn,
      })
    } catch {
      // プロフィールテーブルがまだ無い環境でも、Google の情報だけでアプリは動かす
      set({ profile: profileFromUser(user), loaded: true })
    }
  },

  reset: () => set({
    userId: null, loaded: false, row: null, profile: null, editorOpen: false, isFirstSignIn: false, verification: null,
  }),

  openEditor: () => set({ editorOpen: true }),
  closeEditor: () => set({ editorOpen: false }),

  loadVerification: async (userId) => {
    try {
      const found = await fetchXVerifications([userId])
      if (get().userId === userId) set({ verification: found[userId] ?? null })
    } catch {
      // 本人確認のテーブルがまだ無い環境でも、アプリは動かす（バッジが出ないだけ）
    }
  },

  setVerification: (verification) => set((s) => ({
    verification,
    verificationRevision: s.verificationRevision + 1,
  })),

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
