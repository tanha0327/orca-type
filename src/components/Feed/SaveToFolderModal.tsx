import { useEffect, useState } from 'react'
import { errorMessage } from '../../lib/errors'
import type { SharedKeymap } from '../../lib/feed'
import { FOLDER_NAME_MAX } from '../../lib/folders'
import { useFolderStore } from '../../store/folderStore'
import { Ring } from '../Ring'

/** 投稿を自分のフォルダに保存する。1 つの投稿を複数のフォルダに入れられる */
export function SaveToFolderModal({
  item, onClose,
}: {
  item: SharedKeymap | null
  onClose: () => void
}) {
  const folders = useFolderStore((s) => s.folders)
  const itemsByFolder = useFolderStore((s) => s.itemsByFolder)
  const available = useFolderStore((s) => s.available)
  const loaded = useFolderStore((s) => s.loaded)
  const toggleItem = useFolderStore((s) => s.toggleItem)
  const createFolder = useFolderStore((s) => s.create)

  const [draft, setDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!item) return
    setDraft('')
    setError(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item) return null

  const inFolder = (folderId: string) => itemsByFolder[folderId]?.some((it) => it.keymapId === item.id) ?? false

  const doToggle = async (folderId: string) => {
    setBusyId(folderId)
    setError(null)
    try {
      await toggleItem(folderId, item.id)
    } catch (e) {
      setError(`保存に失敗しました: ${errorMessage(e)}`)
    } finally {
      setBusyId(null)
    }
  }

  // 新しいフォルダを作って、そのままこの投稿を入れる
  const doCreate = async () => {
    const name = draft.trim()
    if (!name) return
    setBusyId('new')
    setError(null)
    try {
      const folder = await createFolder(name)
      await toggleItem(folder.id, item.id)
      setDraft('')
    } catch (e) {
      setError(`フォルダの作成に失敗しました: ${errorMessage(e)}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} をフォルダに保存`}
        className="nb nb-lg flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-sand)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">フォルダに保存</p>
            <h3 className="truncate text-[1.05rem]">{item.name}</h3>
          </div>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {!loaded && (
            <p className="flex items-center justify-center gap-2 py-4 text-[0.82rem] font-bold opacity-60">
              <Ring size={14} />
              読み込み中…
            </p>
          )}
          {loaded && !available && (
            <p className="py-4 text-center text-[0.8rem] font-bold opacity-70">
              フォルダ機能はまだ使えません。
            </p>
          )}
          {loaded && available && folders.length === 0 && (
            <p className="py-2 text-center text-[0.8rem] font-bold opacity-60">
              まだフォルダがありません。下で作ると、この投稿がそのまま入ります。
            </p>
          )}
          {available && folders.map((f) => {
            const on = inFolder(f.id)
            return (
              <button
                key={f.id}
                type="button"
                className="nb nb-flat flex w-full items-center gap-2 p-2 text-left"
                style={{ background: on ? 'var(--color-lime)' : 'var(--color-paper)', cursor: 'pointer' }}
                aria-pressed={on}
                disabled={busyId !== null}
                onClick={() => void doToggle(f.id)}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[0.75rem] font-black"
                  style={{ border: '2px solid var(--color-ink)', background: 'var(--color-paper)' }}
                >
                  {on ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.85rem] font-black">📁 {f.name}</span>
                {busyId === f.id
                  ? <Ring size={13} />
                  : <span className="font-mono text-[0.68rem] font-bold opacity-55">{itemsByFolder[f.id]?.length ?? 0}</span>}
              </button>
            )
          })}
          {error && (
            <p className="text-[0.78rem] font-bold" style={{ color: 'var(--color-pink)' }}>{error}</p>
          )}
        </div>

        {available && (
          <form
            className="flex gap-2 border-t-[3px] border-[var(--color-ink)] p-3"
            onSubmit={(e) => { e.preventDefault(); void doCreate() }}
          >
            <input
              className="nb-input min-w-0 flex-1 !py-1.5 text-[0.82rem]"
              value={draft}
              maxLength={FOLDER_NAME_MAX}
              placeholder="新しいフォルダの名前"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              className="nb-btn flex shrink-0 items-center gap-1.5 !py-1.5 text-[0.78rem]"
              style={{ background: 'var(--color-lime)' }}
              disabled={!draft.trim() || busyId !== null}
            >
              {busyId === 'new' && <Ring size={13} />}
              作って保存
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
