import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CategoryId } from '../engine/analyze'
import {
  isFeedSort, isFolderSort, type FeedSort, type FolderSort, type SharedKeymap,
} from '../lib/feed'

/** タイムラインで見ているフォルダ。すべて／カテゴリ（全員共通の自動フォルダ）／自分のフォルダ */
export type FeedFolder =
  | { kind: 'all' }
  | { kind: 'category'; id: CategoryId }
  | { kind: 'mine'; folderId: string }

/**
 * 「みんなの配列」の表示状態。
 * タイムライン（メイン列）と、右上のあなたの配列・右下の並び替え（サイド列）で共有する。
 */
interface FeedState {
  sort: FeedSort
  /** 自分のフォルダを開いているときの並び順（タイムラインの並び順とは別に覚える） */
  folderSort: FolderSort
  /** 見ているフォルダ。ユーザーごとのものなので保存はしない */
  folder: FeedFolder
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
  setFolderSort: (sort: FolderSort) => void
  setFolder: (folder: FeedFolder) => void
  setFocusLayer: (n: number) => void
  setShowMine: (on: boolean) => void
  openViewer: (item: SharedKeymap | null) => void
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      sort: 'hot',
      folderSort: 'manual',
      folder: { kind: 'all' },
      focusLayer: 0,
      showMine: false,
      viewer: null,

      setSort: (sort) => set({ sort }),
      setFolderSort: (folderSort) => set({ folderSort }),
      setFolder: (folder) => set({ folder }),
      setFocusLayer: (n) => set({ focusLayer: n }),
      setShowMine: (on) => set({ showMine: on }),
      openViewer: (item) => set({ viewer: item }),
    }),
    {
      name: 'orca-map/feed',
      partialize: (s) => ({ sort: s.sort, folderSort: s.folderSort }),
      // 保存データが壊れていても、並び順は必ず既知の値にする
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<FeedState, 'sort' | 'folderSort'>>
        return {
          ...current,
          sort: isFeedSort(p.sort) ? p.sort : current.sort,
          folderSort: isFolderSort(p.folderSort) ? p.folderSort : current.folderSort,
        }
      },
    },
  ),
)
