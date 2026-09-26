import { supabase } from './supabase'

/* ================================================================
   自分用のフォルダ（みんなの配列の投稿を保存・整理する）。
   RLS で本人の行しか読み書きできない（006_feed_folders.sql）。
   ================================================================ */

export interface KeymapFolder {
  id: string
  name: string
  created_at: string
}

export interface FolderItem {
  keymapId: string
  /** フォルダ内の手動の並び順（小さいほど上） */
  position: number
}

export interface MyFolders {
  folders: KeymapFolder[]
  itemsByFolder: Record<string, FolderItem[]>
}

export const FOLDER_NAME_MAX = 40

export function foldersEnabled(): boolean {
  return supabase !== null
}

function client() {
  if (!supabase) throw new Error('フォルダ機能は設定されていません')
  return supabase
}

/** 自分のフォルダと、それぞれの中身（position 順）をまとめて取る */
export async function fetchMyFolders(userId: string): Promise<MyFolders> {
  const db = client()
  const [foldersRes, itemsRes] = await Promise.all([
    db.from('keymap_folders')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    db.from('keymap_folder_items')
      .select('folder_id, keymap_id, position')
      .eq('user_id', userId)
      .order('position', { ascending: true }),
  ])
  if (foldersRes.error) throw foldersRes.error
  if (itemsRes.error) throw itemsRes.error

  const itemsByFolder: Record<string, FolderItem[]> = {}
  for (const f of foldersRes.data ?? []) itemsByFolder[f.id] = []
  for (const row of itemsRes.data ?? []) {
    itemsByFolder[row.folder_id]?.push({ keymapId: row.keymap_id, position: row.position })
  }
  return { folders: foldersRes.data ?? [], itemsByFolder }
}

export async function createFolder(userId: string, name: string): Promise<KeymapFolder> {
  const { data, error } = await client()
    .from('keymap_folders')
    .insert({ user_id: userId, name })
    .select('id, name, created_at')
    .single()
  if (error) throw error
  return data
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const { error } = await client().from('keymap_folders').update({ name }).eq('id', folderId)
  if (error) throw error
}

/** 中身（keymap_folder_items）は on delete cascade で一緒に消える */
export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await client().from('keymap_folders').delete().eq('id', folderId)
  if (error) throw error
}

export async function addToFolder(input: {
  userId: string
  folderId: string
  keymapId: string
  position: number
}): Promise<void> {
  const { error } = await client().from('keymap_folder_items').insert({
    user_id: input.userId,
    folder_id: input.folderId,
    keymap_id: input.keymapId,
    position: input.position,
  })
  if (error) throw error
}

export async function removeFromFolder(folderId: string, keymapId: string): Promise<void> {
  const { error } = await client()
    .from('keymap_folder_items')
    .delete()
    .eq('folder_id', folderId)
    .eq('keymap_id', keymapId)
  if (error) throw error
}

/** フォルダ内の並び順を書き換える（手動の並べ替えで、入れ替えた 2 件だけを送る） */
export async function setPositions(folderId: string, items: FolderItem[]): Promise<void> {
  const db = client()
  const results = await Promise.all(items.map((it) =>
    db.from('keymap_folder_items')
      .update({ position: it.position })
      .eq('folder_id', folderId)
      .eq('keymap_id', it.keymapId)))
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}
