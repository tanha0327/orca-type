import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { profileFromUser } from '../lib/auth'
import {
  fetchProfileRow, profileEnabled, resolveProfile, saveProfile, type Profile, type ProfileRow,
} from '../lib/profile'
import { syncXVerification } from '../lib/xVerification'

export interface ProfileNotice {
  kind: 'ok' | 'error'
  text: string
}

interface ProfileState {
  userId: string | null
  loaded: boolean
  row: ProfileRow | null
  profile: Profile | null
  /** プロフィール編集モーダルが開いているか */
  editorOpen: boolean
  /** 行が無い状態で開いた＝初回サインイン */
  isFirstSignIn: boolean
  /** X 連携から戻ってきたときの結果など、編集モーダルの上部に出すお知らせ */
  notice: ProfileNotice | null
  /** 公開テーブルの X 本人確認を同期するたびに増える。フィードのバッジを取り直す合図 */
  verificationRevision: number

  /** ログイン中のユーザーのプロフィールを読み込む。行が無ければ編集モーダルを自動で開く */
  load: (user: User) => Promise<void>
  reset: () => void
  openEditor: () => void
  /** お知らせ付きで編集モーダルを開く（X 連携から戻ってきたときの結果表示など） */
  openEditorWithNotice: (notice: ProfileNotice) => void
  closeEditor: () => void
  /** ログイン中のユーザーの X 連携状態を、他の人から見える本人確認バッジに反映する */
  syncVerification: () => Promise<void>
  save: (userId: string, input: { name: string; avatarUrl: string }) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  userId: null,
  loaded: false,
  row: null,
  profile: null,
  editorOpen: false,
  isFirstSignIn: false,
  notice: null,
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
        // X 連携から戻ってきた直後などで先に開いていたら、読み込み完了で閉じてしまわないようにする
        editorOpen: firstSignIn || get().editorOpen,
        isFirstSignIn: firstSignIn,
      })
    } catch {
      // プロフィールテーブルがまだ無い環境でも、Google の情報だけでアプリは動かす
      set({ profile: profileFromUser(user), loaded: true })
    }
  },

  reset: () => set({
    userId: null, loaded: false, row: null, profile: null, editorOpen: false, isFirstSignIn: false, notice: null,
  }),

  openEditor: () => set({ editorOpen: true, notice: null }),
  openEditorWithNotice: (notice) => set({ editorOpen: true, notice }),
  closeEditor: () => set({ editorOpen: false, notice: null }),

  syncVerification: async () => {
    try {
      await syncXVerification()
    } catch {
      // 本人確認のテーブル・関数がまだ無い環境でも、アプリは動かす（バッジが出ないだけ）
      return
    }
    set((s) => ({ verificationRevision: s.verificationRevision + 1 }))
  },

  save: async (userId, input) => {
    await saveProfile(userId, input)
    set({
      row: { user_id: userId, display_name: input.name, avatar_url: input.avatarUrl, updated_at: new Date().toISOString() },
      profile: { name: input.name, avatarUrl: input.avatarUrl },
      editorOpen: false,
      isFirstSignIn: false,
      notice: null,
    })
  },
}))
