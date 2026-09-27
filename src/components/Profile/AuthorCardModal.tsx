import { useEffect } from 'react'
import { create } from 'zustand'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'
import { useProfileTags, useProfileTagsStore } from '../../store/profileTagsStore'
import { Ring } from '../Ring'
import { OwnedKeyboardList } from './ProfileTagParts'

/** カードに出す投稿者。名前とアイコンは、投稿・コメントに記録されているものをそのまま使う */
export interface AuthorSummary {
  userId: string
  name: string
  avatarUrl: string | null
}

interface AuthorCardState {
  author: AuthorSummary | null
  open: (author: AuthorSummary) => void
  close: () => void
}

/** みんなの配列の投稿・コメントのどこからでも、同じカードを開けるようにする */
export const useAuthorCardStore = create<AuthorCardState>((set) => ({
  author: null,
  open: (author) => set({ author }),
  close: () => set({ author: null }),
}))

/**
 * 投稿者のプロフィールカード。みんなの配列でアイコンを押すと開き、
 * 分割初心者のタグと、持っているキーボードを見せる。
 */
export function AuthorCardModal() {
  const author = useAuthorCardStore((s) => s.author)
  const close = useAuthorCardStore((s) => s.close)
  const me = useAuthStore((s) => s.user)
  const openProfileEditor = useProfileStore((s) => s.openEditor)
  const tags = useProfileTags(author?.userId)
  const available = useProfileTagsStore((s) => s.available)
  const ensureTags = useProfileTagsStore((s) => s.ensure)

  useEffect(() => {
    if (author) void ensureTags([author.userId])
  }, [author, ensureTags])

  // コメントの画面などの上に重ねて開くので、Esc ではこのカードだけを閉じる（下の画面まで一緒に閉じないように）
  useEffect(() => {
    if (!author) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [author, close])

  if (!author) return null

  const isMe = me?.id === author.userId
  const loading = tags === undefined && available !== false

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${author.name} のプロフィール`}
        className="nb nb-lg flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-3 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          {author.avatarUrl
            ? (
              <img
                src={author.avatarUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                style={{ border: '3px solid var(--color-ink)' }}
              />
            )
            : (
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[1.2rem] font-black"
                style={{ background: 'var(--color-lime)', border: '3px solid var(--color-ink)' }}
              >
                {author.name.slice(0, 1)}
              </span>
            )}
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">プロフィール</p>
            <h3 className="truncate text-[1.05rem]">{author.name}</h3>
          </div>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={close}>
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-4 text-[0.82rem] font-bold opacity-60">
              <Ring size={14} />
              読み込み中…
            </p>
          )}

          {!loading && tags?.splitBeginner && (
            <p className="nb-chip !text-[0.74rem]" style={{ background: 'var(--color-lime)' }}>
              🔰 分割キーボード初心者
            </p>
          )}

          {!loading && (
            <div>
              <span className="nb-eyebrow">持っているキーボード</span>
              <div className="mt-1.5">
                {tags && tags.keyboards.length > 0
                  ? <OwnedKeyboardList keyboards={tags.keyboards} />
                  : (
                    <p className="text-[0.78rem] font-bold opacity-55">
                      {available === false ? 'いまは表示できません。' : 'まだ登録されていません。'}
                    </p>
                  )}
              </div>
            </div>
          )}

          {isMe && (
            <button
              type="button"
              className="nb-btn w-full !py-2 text-[0.8rem]"
              onClick={() => { close(); openProfileEditor() }}
            >
              ✎ プロフィールを編集
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
