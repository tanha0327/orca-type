import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isFeedSort, type FeedSort, type SharedKeymap } from '../lib/feed'

/**
 * 「みんなの配列」の表示状態。
 * タイムライン（メイン列）と、右上のあなたの配列・右下の並び替え（サイド列）で共有する。
 */
interface FeedState {
  sort: FeedSort
  /**
   * 投稿の大きい盤面と、右上のあなたの配列に出しているレイヤー。
   * 全部の投稿で同じレイヤーをそろえて出すので、スクロールしながら同じレイヤー同士を見比べられる
   */
  focusLayer: number
  /** 拡大モーダルの大きい盤面に、投稿ではなく自分の配列を出しているか */
  showMine: boolean
  /** 全体を大きく見るモーダルで開いている投稿 */
  viewer: SharedKeymap | null

  setSort: (sort: FeedSort) => void
  setFocusLayer: (n: number) => void
  setShowMine: (on: boolean) => void
  openViewer: (item: SharedKeymap | null) => void
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      sort: 'hot',
      focusLayer: 0,
      showMine: false,
      viewer: null,

      setSort: (sort) => set({ sort }),
      setFocusLayer: (n) => set({ focusLayer: n }),
      setShowMine: (on) => set({ showMine: on }),
      openViewer: (item) => set({ viewer: item }),
    }),
    {
      name: 'orca-map/feed',
      partialize: (s) => ({ sort: s.sort }),
      // 保存データが壊れていても、並び順は必ず既知の値にする
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<FeedState, 'sort'>>
        return { ...current, sort: isFeedSort(p.sort) ? p.sort : current.sort }
      },
    },
  ),
)
