import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'
import {
  addToFolder, createFolder, deleteFolder, fetchMyFolders, foldersEnabled, removeFromFolder,
  renameFolder, setPositions, type FolderItem, type KeymapFolder,
} from '../lib/folders'

interface FolderState {
  userId: string | null
  loaded: boolean
  /** フォルダのテーブルがある（005_feed_folders.sql 実行済み）か */
  available: boolean
  folders: KeymapFolder[]
  itemsByFolder: Record<string, FolderItem[]>

  load: (user: User) => Promise<void>
  reset: () => void
  create: (name: string) => Promise<KeymapFolder>
  rename: (folderId: string, name: string) => Promise<void>
  remove: (folderId: string) => Promise<void>
  /** 投稿をフォルダに入れる／出す */
  toggleItem: (folderId: string, keymapId: string) => Promise<void>
  /** フォルダ内で 1 つ上（-1）／下（+1）へ動かす */
  move: (folderId: string, keymapId: string, dir: -1 | 1) => Promise<void>
  /** 投稿が削除されたら、どのフォルダからも外す（DB 側は on delete cascade で消える） */
  forgetKeymap: (keymapId: string) => void
}

function requireUser(userId: string | null): string {
  if (!userId) throw new Error('フォルダを使うにはログインしてください')
  return userId
}

export const useFolderStore = create<FolderState>((set, get) => ({
  userId: null,
  loaded: false,
  available: false,
  folders: [],
  itemsByFolder: {},

  load: async (user) => {
    if (get().userId === user.id && get().loaded) return
    set({ userId: user.id, loaded: false, folders: [], itemsByFolder: {} })
    if (!foldersEnabled()) {
      set({ loaded: true, available: false })
      return
    }
    try {
      const mine = await fetchMyFolders(user.id)
      // 読み込み中にログアウト・別ユーザーでログインしていたら捨てる
      if (get().userId !== user.id) return
      set({ ...mine, loaded: true, available: true })
    } catch {
      // テーブルがまだ無い環境でも、みんなの配列そのものは動かす
      if (get().userId !== user.id) return
      set({ loaded: true, available: false })
    }
  },

  reset: () => set({ userId: null, loaded: false, available: false, folders: [], itemsByFolder: {} }),

  create: async (name) => {
    const userId = requireUser(get().userId)
    const folder = await createFolder(userId, name)
    set((s) => ({
      folders: [...s.folders, folder],
      itemsByFolder: { ...s.itemsByFolder, [folder.id]: [] },
    }))
    return folder
  },

  rename: async (folderId, name) => {
    const prev = get().folders
    set({ folders: prev.map((f) => (f.id === folderId ? { ...f, name } : f)) })
    try {
      await renameFolder(folderId, name)
    } catch (e) {
      set({ folders: prev })
      throw e
    }
  },

  remove: async (folderId) => {
    const { folders, itemsByFolder } = get()
    const rest = { ...itemsByFolder }
    delete rest[folderId]
    set({ folders: folders.filter((f) => f.id !== folderId), itemsByFolder: rest })
    try {
      await deleteFolder(folderId)
    } catch (e) {
      set({ folders, itemsByFolder })
      throw e
    }
  },

  toggleItem: async (folderId, keymapId) => {
    const userId = requireUser(get().userId)
    const prevAll = get().itemsByFolder
    const items = prevAll[folderId] ?? []
    const inFolder = items.some((it) => it.keymapId === keymapId)

    if (inFolder) {
      set({ itemsByFolder: { ...prevAll, [folderId]: items.filter((it) => it.keymapId !== keymapId) } })
      try {
        await removeFromFolder(folderId, keymapId)
      } catch (e) {
        set({ itemsByFolder: prevAll })
        throw e
      }
      return
    }

    // 新しく入れたものはフォルダの末尾に置く
    const position = items.reduce((max, it) => Math.max(max, it.position), -1) + 1
    set({ itemsByFolder: { ...prevAll, [folderId]: [...items, { keymapId, position }] } })
    try {
      await addToFolder({ userId, folderId, keymapId, position })
    } catch (e) {
      set({ itemsByFolder: prevAll })
      throw e
    }
  },

  move: async (folderId, keymapId, dir) => {
    const prevAll = get().itemsByFolder
    const items = [...(prevAll[folderId] ?? [])].sort((a, b) => a.position - b.position)
    const from = items.findIndex((it) => it.keymapId === keymapId)
    const to = from + dir
    if (from < 0 || to < 0 || to >= items.length) return

    ;[items[from], items[to]] = [items[to], items[from]]
    // position が重複していても確実に並ぶよう 0, 1, 2… に振り直し、変わった行だけ送る
    const before = new Map((prevAll[folderId] ?? []).map((it) => [it.keymapId, it.position]))
    const next = items.map((it, i) => ({ keymapId: it.keymapId, position: i }))
    const changed = next.filter((it) => before.get(it.keymapId) !== it.position)

    set({ itemsByFolder: { ...prevAll, [folderId]: next } })
    try {
      await setPositions(folderId, changed)
    } catch (e) {
      set({ itemsByFolder: prevAll })
      throw e
    }
  },

  forgetKeymap: (keymapId) => {
    const itemsByFolder: Record<string, FolderItem[]> = {}
    for (const [id, items] of Object.entries(get().itemsByFolder)) {
      itemsByFolder[id] = items.filter((it) => it.keymapId !== keymapId)
    }
    set({ itemsByFolder })
  },
}))
