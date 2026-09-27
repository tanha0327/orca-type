import { create } from 'zustand'
import { isFeatureUnavailableError } from '../lib/errors'
import { fetchProfileTags, profileTagsEnabled, type ProfileTags } from '../lib/profileTags'

/**
 * プロフィールの公開タグ（持っているキーボード・分割初心者）の手元の控え。
 * 自分のタグ（プロフィール編集・初心者向けのおすすめ）と、みんなの配列に出てくる人のタグ（🔰 のバッジ・
 * 投稿者のカード）を同じところに持つので、自分のタグを保存するとタイムラインの 🔰 もすぐに変わる。
 */
interface ProfileTagsState {
  /**
   * user_id → タグ。null は「取りに行ったが、その人はまだタグを設定していない」。
   * まだ取りに行っていない人は入らない
   */
  byUser: Record<string, ProfileTags | null>
  /** タグの機能が使えるか。null はまだ分からない、false は SQL 未実行などで使えない（タグの欄を出さない） */
  available: boolean | null
  /** まだ取りに行っていないユーザーのタグを取ってくる */
  ensure: (userIds: string[]) => Promise<void>
  /** そのユーザーのタグを取り直す（別の端末で変えたかもしれない自分のタグを、ログインしたときに読むなど） */
  refresh: (userId: string) => Promise<void>
  /** 保存したタグを、取り直さずに画面へ反映する */
  setTags: (userId: string, tags: ProfileTags) => void
}

/** 取りに行ったことのある（取りに行っている最中の）ユーザー。同じ人を何度も取りに行かないように */
const requested = new Set<string>()

export const useProfileTagsStore = create<ProfileTagsState>((set, get) => ({
  byUser: {},
  available: null,

  ensure: async (userIds) => {
    if (!profileTagsEnabled() || get().available === false) return
    const ids = [...new Set(userIds)].filter((id) => !requested.has(id))
    if (ids.length === 0) return
    for (const id of ids) requested.add(id)
    try {
      const found = await fetchProfileTags(ids)
      set((s) => {
        const byUser = { ...s.byUser }
        for (const id of ids) byUser[id] = found[id] ?? null
        return { byUser, available: true }
      })
    } catch (e) {
      // テーブルが無い環境でもアプリは動かす（タグが出ないだけ）。一時的な失敗なら次の機会に取り直す
      for (const id of ids) requested.delete(id)
      if (isFeatureUnavailableError(e)) set({ available: false })
    }
  },

  refresh: async (userId) => {
    requested.delete(userId)
    await get().ensure([userId])
  },

  setTags: (userId, tags) => {
    requested.add(userId)
    set((s) => ({ byUser: { ...s.byUser, [userId]: tags }, available: true }))
  },
}))

/**
 * そのユーザーのタグ。null はタグ未設定、undefined はまだ読み込んでいない
 * （ログインせずに投稿された古い配列など、ユーザーが分からないときも undefined）
 */
export function useProfileTags(userId: string | null | undefined): ProfileTags | null | undefined {
  return useProfileTagsStore((s) => (userId ? s.byUser[userId] : undefined))
}
