import { isValidKeymapShape, type Keymap } from '../data/types'
import { supabase } from './supabase'

export interface SharedKeymap {
  id: string
  name: string
  author: string
  description: string | null
  keymap: Keymap
  created_at: string
}

export function feedEnabled(): boolean {
  return supabase !== null
}

/** 新しい順に最大 50 件。壊れた形の keymap が紛れ込んでいても落ちないよう弾く */
export async function fetchFeed(): Promise<SharedKeymap[]> {
  if (!supabase) throw new Error('共有フィードは設定されていません')
  const { data, error } = await supabase
    .from('shared_keymaps')
    .select('id, name, author, description, keymap, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).filter((row): row is SharedKeymap => isValidKeymapShape(row.keymap))
}

export async function shareKeymap(input: {
  name: string
  author: string
  description: string
  keymap: Keymap
}): Promise<void> {
  if (!supabase) throw new Error('共有フィードは設定されていません')
  const { error } = await supabase.from('shared_keymaps').insert({
    name: input.name,
    author: input.author,
    description: input.description || null,
    keymap: input.keymap,
  })
  if (error) throw error
}
