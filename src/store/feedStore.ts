import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isFeedSort, type FeedSort, type SharedKeymap } from '../lib/feed'

/**
 * 「みんなの配列」の表示状態。
 * タイムライン（メイン列）と、右上の比較パネル・右下の並び替え（サイド列）で共有する。
 */
interface FeedState {
  sort: FeedSort
  /** 右上に出している投稿 */
  pinned: SharedKeymap | null
  /** 自分で選んだ投稿の ID。リロードしても同じ投稿を右上に出す（自動で出した先頭の投稿は覚えない） */
  pinnedId: string | null
  /** 比較の大きい盤面に出しているレイヤー */
  focusLayer: number
  /** 大きい盤面に、投稿ではなく自分の配列を出しているか */
  showMine: boolean
  /** 全体を大きく見るモーダルで開いている投稿 */
  viewer: SharedKeymap | null
  /** タイムラインの読み込み状態（右上のパネルで「読み込み中」と「まだ無い」を出し分ける） */
  feedStatus: 'loading' | 'ready' | 'error'

  setSort: (sort: FeedSort) => void
  /** byUser が false なら「とりあえず先頭を出す」だけなので ID は覚えない */
  pin: (item: SharedKeymap | null, byUser: boolean) => void
  setFocusLayer: (n: number) => void
  setShowMine: (on: boolean) => void
  openViewer: (item: SharedKeymap | null) => void
  setFeedStatus: (status: FeedState['feedStatus']) => void
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      sort: 'hot',
      pinned: null,
      pinnedId: null,
      focusLayer: 0,
      showMine: false,
      viewer: null,
      feedStatus: 'loading',

      setSort: (sort) => set({ sort }),
      pin: (item, byUser) => set(byUser ? { pinned: item, pinnedId: item?.id ?? null } : { pinned: item }),
      setFocusLayer: (n) => set({ focusLayer: n }),
      setShowMine: (on) => set({ showMine: on }),
      openViewer: (item) => set({ viewer: item }),
      setFeedStatus: (feedStatus) => set({ feedStatus }),
    }),
    {
      name: 'orca-map/feed',
      partialize: (s) => ({ sort: s.sort, pinnedId: s.pinnedId }),
      // 保存データが壊れていても、並び順は必ず既知の値にする
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<FeedState, 'sort' | 'pinnedId'>>
        return {
          ...current,
          sort: isFeedSort(p.sort) ? p.sort : current.sort,
          pinnedId: typeof p.pinnedId === 'string' ? p.pinnedId : null,
        }
      },
    },
  ),
)
