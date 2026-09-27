import { create } from 'zustand'
import { beginnerRecsEnabled, fetchBeginnerRecs, setBeginnerRec } from '../lib/beginnerRecs'
import { isFeatureUnavailableError } from '../lib/errors'

/**
 * みんなの配列の「分割初心者におすすめ」の数と、自分がおすすめした投稿。
 * 投稿カードの 🔰 ボタン・タグ、絞り込み、初心者向けのおすすめ欄で共有する。
 */
interface BeginnerRecState {
  /** 投稿 ID → おすすめした人の数 */
  counts: Record<string, number>
  /** 自分がおすすめした投稿の ID */
  mine: Set<string>
  /** 一度でも読み込めたか */
  loaded: boolean
  /** おすすめの機能が使えるか。null はまだ分からない、false は SQL 未実行などで使えない（ボタンなどを出さない） */
  available: boolean | null
  /** ログイン中のユーザー（いなければ null）として読み込み直す */
  load: (myUserId: string | null) => Promise<void>
  /** おすすめを付ける・外す。先に画面を変えて、失敗したら元に戻してエラーを投げる */
  toggle: (keymapId: string, userId: string) => Promise<void>
  /** 投稿した直後に、投稿者のおすすめを付ける */
  add: (keymapId: string, userId: string) => Promise<void>
  /** 消した投稿のおすすめを手元から消す */
  forget: (keymapId: string) => void
}

let loadSeq = 0

/** 付け外しの通信中の投稿。すばやく 2 回押して、付ける・外すが入れ違いに届かないように */
const pending = new Set<string>()

function withCount(counts: Record<string, number>, keymapId: string, delta: number): Record<string, number> {
  const next = { ...counts }
  const n = Math.max(0, (next[keymapId] ?? 0) + delta)
  if (n > 0) next[keymapId] = n
  else delete next[keymapId]
  return next
}

export const useBeginnerRecStore = create<BeginnerRecState>((set, get) => ({
  counts: {},
  mine: new Set(),
  loaded: false,
  available: null,

  load: async (myUserId) => {
    if (!beginnerRecsEnabled()) return
    const seq = ++loadSeq
    try {
      const recs = await fetchBeginnerRecs(myUserId)
      if (seq !== loadSeq) return
      set({ counts: recs.counts, mine: recs.mine, loaded: true, available: true })
    } catch (e) {
      // テーブルが無い環境でも一覧はそのまま出す（おすすめのボタンなどが出ないだけ）
      if (seq === loadSeq && isFeatureUnavailableError(e)) set({ available: false })
    }
  },

  toggle: async (keymapId, userId) => {
    if (pending.has(keymapId)) return
    const on = !get().mine.has(keymapId)
    const apply = (turnOn: boolean) => set((s) => {
      const mine = new Set(s.mine)
      if (turnOn) mine.add(keymapId)
      else mine.delete(keymapId)
      return { mine, counts: withCount(s.counts, keymapId, turnOn ? 1 : -1) }
    })
    pending.add(keymapId)
    apply(on)
    try {
      await setBeginnerRec(keymapId, userId, on)
    } catch (e) {
      apply(!on)
      throw e
    } finally {
      pending.delete(keymapId)
    }
  },

  add: async (keymapId, userId) => {
    if (get().mine.has(keymapId)) return
    await setBeginnerRec(keymapId, userId, true)
    set((s) => ({ mine: new Set(s.mine).add(keymapId), counts: withCount(s.counts, keymapId, 1) }))
  },

  forget: (keymapId) => set((s) => {
    const mine = new Set(s.mine)
    mine.delete(keymapId)
    const counts = { ...s.counts }
    delete counts[keymapId]
    return { mine, counts }
  }),
}))
