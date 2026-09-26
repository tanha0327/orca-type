import { useState } from 'react'
import type { KeymapOs } from '../../data/types'
import { FEED_CATEGORIES, type CategoryId } from '../../engine/analyze'
import { errorMessage } from '../../lib/errors'
import { FOLDER_NAME_MAX } from '../../lib/folders'
import { OS_TAGS } from '../../lib/os'
import type { FeedFolder } from '../../store/feedStore'
import { useFolderStore } from '../../store/folderStore'

/**
 * タイムラインの上に置くフォルダの切り替え。
 * OS のタグ（Mac / Windows）での絞り込みと、カテゴリ（配列の特徴から自動で振り分ける全員共通のフォルダ）と、
 * 自分で作るマイフォルダ。OS の絞り込みはどのフォルダを見ていても重ねてかかる。
 * 並び順はサイド列（スマホではタイムラインの上）の並び替えで選ぶ
 */
export function FolderBar({
  folder, onFolder, osFilter, onOsFilter, osCounts, allCount, categoryCounts, loggedIn, onRequireLogin, onError,
}: {
  folder: FeedFolder
  onFolder: (f: FeedFolder) => void
  osFilter: KeymapOs | 'all'
  onOsFilter: (os: KeymapOs | 'all') => void
  /** OS のタグごとの投稿数（OS で絞り込む前の数） */
  osCounts: { all: number } & Partial<Record<KeymapOs, number>>
  /** ここから下の件数は、OS で絞り込んだあとの数 */
  allCount: number
  categoryCounts: Partial<Record<CategoryId, number>>
  loggedIn: boolean
  onRequireLogin: () => void
  onError: (message: string) => void
}) {
  const folders = useFolderStore((s) => s.folders)
  const itemsByFolder = useFolderStore((s) => s.itemsByFolder)
  const available = useFolderStore((s) => s.available)
  const loaded = useFolderStore((s) => s.loaded)
  const createFolder = useFolderStore((s) => s.create)
  const renameFolder = useFolderStore((s) => s.rename)
  const removeFolder = useFolderStore((s) => s.remove)

  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const current = folder.kind === 'mine' ? folders.find((f) => f.id === folder.folderId) : undefined

  const closeForm = () => { setCreating(false); setRenaming(false); setDraft('') }

  const submit = async () => {
    const name = draft.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      if (renaming && current) {
        await renameFolder(current.id, name)
      } else {
        const created = await createFolder(name)
        onFolder({ kind: 'mine', folderId: created.id })
      }
      closeForm()
    } catch (e) {
      onError(`フォルダの保存に失敗しました: ${errorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!current) return
    if (!confirm(`フォルダ「${current.name}」を削除しますか？ 中の投稿そのものは消えません。`)) return
    try {
      await removeFolder(current.id)
      onFolder({ kind: 'all' })
    } catch (e) {
      onError(`フォルダの削除に失敗しました: ${errorMessage(e)}`)
    }
  }

  const startCreate = () => {
    if (!loggedIn) { onRequireLogin(); return }
    setRenaming(false)
    setDraft('')
    setCreating(true)
  }

  return (
    <div className="space-y-2.5 border-b-[3px] border-[var(--color-ink)] p-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="OS で絞り込む">
        <span className="nb-eyebrow mr-0.5">OS</span>
        <FolderChip
          label="すべて"
          count={osCounts.all}
          active={osFilter === 'all'}
          onClick={() => onOsFilter('all')}
        />
        {OS_TAGS.map((t) => (
          <FolderChip
            key={t.id}
            label={`${t.emoji} ${t.label}`}
            title={t.help}
            count={osCounts[t.id] ?? 0}
            active={osFilter === t.id}
            onClick={() => onOsFilter(t.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="カテゴリで絞り込む">
        <span className="nb-eyebrow mr-0.5">フォルダ</span>
        <FolderChip
          label="すべて"
          count={allCount}
          active={folder.kind === 'all'}
          onClick={() => onFolder({ kind: 'all' })}
        />
        {FEED_CATEGORIES.map((c) => (
          <FolderChip
            key={c.id}
            label={`${c.emoji} ${c.label}`}
            title={c.help}
            count={categoryCounts[c.id] ?? 0}
            active={folder.kind === 'category' && folder.id === c.id}
            onClick={() => onFolder({ kind: 'category', id: c.id })}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="自分のフォルダ">
        <span className="nb-eyebrow mr-0.5">マイフォルダ</span>
        {folders.map((f) => (
          <FolderChip
            key={f.id}
            label={`📁 ${f.name}`}
            count={itemsByFolder[f.id]?.length ?? 0}
            active={folder.kind === 'mine' && folder.folderId === f.id}
            onClick={() => onFolder({ kind: 'mine', folderId: f.id })}
          />
        ))}
        {loggedIn && loaded && !available
          ? <span className="text-[0.7rem] font-bold opacity-55">フォルダ機能はまだ使えません</span>
          : (
            <button type="button" className="nb-btn !py-1 !px-2.5 text-[0.74rem]" onClick={startCreate}>
              ＋ フォルダ
            </button>
          )}
        {current && !creating && !renaming && (
          <>
            <button
              type="button"
              className="nb-btn !py-1 !px-2.5 text-[0.74rem]"
              onClick={() => { setCreating(false); setDraft(current.name); setRenaming(true) }}
            >
              ✎ 名前を変更
            </button>
            <button
              type="button"
              className="nb-btn !py-1 !px-2.5 text-[0.74rem]"
              style={{ background: 'var(--color-pink)' }}
              onClick={() => void doDelete()}
            >
              フォルダを削除
            </button>
          </>
        )}
      </div>

      {(creating || renaming) && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); void submit() }}
        >
          <input
            className="nb-input min-w-0 flex-1 !py-1.5 text-[0.82rem]"
            value={draft}
            maxLength={FOLDER_NAME_MAX}
            placeholder={renaming ? 'フォルダの新しい名前' : '新しいフォルダの名前（例: 参考にしたい）'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') closeForm() }}
            autoFocus
          />
          <button
            type="submit"
            className="nb-btn shrink-0 !py-1.5 text-[0.78rem]"
            style={{ background: 'var(--color-lime)' }}
            disabled={!draft.trim() || busy}
          >
            {renaming ? '変更' : '作成'}
          </button>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={closeForm}>
            やめる
          </button>
        </form>
      )}

    </div>
  )
}

function FolderChip({
  label, count, active, title, onClick,
}: {
  label: string
  count: number
  active: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="nb-btn !py-1 !px-2.5 text-[0.74rem]"
      data-active={active}
      aria-pressed={active}
      title={title}
      onClick={onClick}
      style={!active && count === 0 ? { opacity: 0.5 } : undefined}
    >
      {label}
      <span className="font-mono text-[0.66rem] opacity-70">{count}</span>
    </button>
  )
}
