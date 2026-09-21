import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { KEYS, type KeyId } from '../../data/layout'
import { LAYER_COLOR_HEX, type Keymap } from '../../data/types'
import { resolveKey } from '../../engine/resolve'
import { authEnabled, profileFromUser, signInWithGoogle } from '../../lib/auth'
import {
  deleteComment, fetchComments, fetchFeed, fetchFeedExtras, feedEnabled, postComment,
  shareKeymap, toggleLike, type FeedExtras, type KeymapComment, type SharedKeymap,
} from '../../lib/feed'
import { useAuthStore } from '../../store/authStore'
import { useKeymapStore } from '../../store/keymapStore'
import { KeyboardView } from '../Board/KeyboardView'
import { Ring } from '../Ring'

const EMPTY_EXTRAS: FeedExtras = { likeCounts: {}, likedByMe: new Set(), commentCounts: {} }

/** 2 つのキーマップで、指定レイヤーの割当（単押し・長押し）が違うキーの ID 集合 */
function diffKeysForLayer(a: Keymap, b: Keymap, layerIndex: number): Set<KeyId> {
  const stack = layerIndex === 0 ? [0] : [0, layerIndex]
  const diffs = new Set<KeyId>()
  for (const k of KEYS) {
    const ra = resolveKey(a, stack, k.id).binding
    const rb = resolveKey(b, stack, k.id).binding
    if (ra.tap !== rb.tap || ra.hold !== rb.hold) diffs.add(k.id)
  }
  return diffs
}

/**
 * Supabase のエラー（PostgrestError）は Error を継承していないので、
 * instanceof Error だけで見るとメッセージが拾えない。
 */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' && e.message) {
    return e.message
  }
  return '不明なエラー'
}

/** Twitter のタイムラインのような相対時刻表示（1週間を超えたら日付） */
function relativeTime(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'たった今'
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}日前`
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function FeedView() {
  const keymap = useKeymapStore((s) => s.keymap)
  const importKeymap = useKeymapStore((s) => s.importKeymap)
  const setView = useKeymapStore((s) => s.setView)
  const authorName = useKeymapStore((s) => s.authorName)
  const setAuthorName = useKeymapStore((s) => s.setAuthorName)

  const user = useAuthStore((s) => s.user)
  const profile = user ? profileFromUser(user) : null

  const [items, setItems] = useState<SharedKeymap[] | null>(null)
  const [extras, setExtras] = useState<FeedExtras>(EMPTY_EXTRAS)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareName, setShareName] = useState('')
  const [shareDesc, setShareDesc] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [compareItem, setCompareItem] = useState<SharedKeymap | null>(null)
  const [commentItem, setCommentItem] = useState<SharedKeymap | null>(null)
  const [detailItem, setDetailItem] = useState<SharedKeymap | null>(null)

  const load = async () => {
    setLoadError(null)
    try {
      const rows = await fetchFeed()
      setItems(rows)
      // いいね・コメントのテーブルがまだ無い環境でも、配列一覧そのものは出したままにする
      try {
        setExtras(await fetchFeedExtras(rows.map((r) => r.id), user?.id ?? null))
      } catch {
        setExtras(EMPTY_EXTRAS)
      }
    } catch (e) {
      setLoadError(`読み込みに失敗しました: ${errorMessage(e)}`)
    }
  }

  useEffect(() => { void load() }, [user?.id])

  if (!feedEnabled()) {
    return (
      <section className="nb nb-lg p-4">
        <h2 className="text-[1.35rem]">みんなの配列</h2>
        <p className="mt-2 text-[0.8rem] font-bold opacity-70">
          共有フィードは現在設定されていません。
        </p>
      </section>
    )
  }

  // ログインしていれば Google の表示名・アイコンで、していなければ手入力の名前で投稿する
  const postAuthor = profile ? profile.name : authorName.trim()

  const doShare = async () => {
    if (!shareName.trim() || !postAuthor) return
    setSharing(true)
    try {
      await shareKeymap({
        name: shareName.trim(),
        author: postAuthor,
        description: shareDesc.trim(),
        keymap,
        userId: user?.id ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      })
      setShareMsg('共有しました！')
      setShareName('')
      setShareDesc('')
      setShareOpen(false)
      void load()
      window.setTimeout(() => setShareMsg(null), 3000)
    } catch (e) {
      // エラーは自動で消さない（読んで報告できるように残しておく）
      setShareMsg(`共有に失敗しました: ${errorMessage(e)}`)
    } finally {
      setSharing(false)
    }
  }

  const doImport = (item: SharedKeymap) => {
    if (!confirm(`「${item.name}」を読み込みますか？ 今編集中の内容は上書きされます。`)) return
    importKeymap(item.keymap)
    setView('edit')
  }

  const doToggleLike = async (item: SharedKeymap) => {
    if (!user) {
      setShareMsg('いいねするには Google でログインしてください')
      window.setTimeout(() => setShareMsg(null), 3000)
      return
    }
    const liked = extras.likedByMe.has(item.id)
    // 先に画面を更新して、失敗したら戻す
    setExtras((prev) => {
      const likedByMe = new Set(prev.likedByMe)
      if (liked) likedByMe.delete(item.id)
      else likedByMe.add(item.id)
      return {
        ...prev,
        likedByMe,
        likeCounts: {
          ...prev.likeCounts,
          [item.id]: Math.max(0, (prev.likeCounts[item.id] ?? 0) + (liked ? -1 : 1)),
        },
      }
    })
    try {
      await toggleLike(item.id, user.id, liked)
    } catch (e) {
      setExtras((prev) => {
        const likedByMe = new Set(prev.likedByMe)
        if (liked) likedByMe.add(item.id)
        else likedByMe.delete(item.id)
        return {
          ...prev,
          likedByMe,
          likeCounts: {
            ...prev.likeCounts,
            [item.id]: Math.max(0, (prev.likeCounts[item.id] ?? 0) + (liked ? 1 : -1)),
          },
        }
      })
      setShareMsg(`いいねに失敗しました: ${errorMessage(e)}`)
    }
  }

  return (
    <section className="nb nb-lg overflow-hidden">
      <div className="p-4 pb-3">
        <h2 className="text-[1.35rem]">みんなの配列</h2>
        <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
          みんなが共有したキーマップのタイムライン。いいね・コメントで反応できます。
        </p>
      </div>

      {(shareMsg || loadError) && (
        <div className="space-y-2 px-4 pb-3">
          {shareMsg && (
            <p className="nb-chip" style={{ background: 'var(--color-lime)' }}>{shareMsg}</p>
          )}
          {loadError && (
            <p className="text-[0.8rem] font-bold" style={{ color: 'var(--color-pink)' }}>{loadError}</p>
          )}
        </div>
      )}

      <Composer profile={profile} onOpen={() => setShareOpen(true)} />

      {items?.map((item) => (
        <PostCard
          key={item.id}
          item={item}
          likeCount={extras.likeCounts[item.id] ?? 0}
          liked={extras.likedByMe.has(item.id)}
          commentCount={extras.commentCounts[item.id] ?? 0}
          onImport={() => doImport(item)}
          onCompare={() => setCompareItem(item)}
          onLike={() => void doToggleLike(item)}
          onComments={() => setCommentItem(item)}
          onOpenDetail={() => setDetailItem(item)}
        />
      ))}

      {items === null && !loadError && (
        <p className="flex items-center justify-center gap-2 py-6 text-[0.85rem] font-bold opacity-60">
          <Ring size={15} />
          読み込み中…
        </p>
      )}
      {items?.length === 0 && (
        <p className="py-8 text-center text-[0.85rem] font-bold opacity-60">
          まだ共有された配列がありません。上の投稿欄から最初の 1 つをどうぞ。
        </p>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareName={shareName}
        onShareName={setShareName}
        authorName={authorName}
        onAuthorName={setAuthorName}
        shareDesc={shareDesc}
        onShareDesc={setShareDesc}
        sharing={sharing}
        onSubmit={() => void doShare()}
        shareMsg={shareMsg}
        profile={profile}
      />

      <CommentsModal
        item={commentItem}
        onClose={() => setCommentItem(null)}
        onCountChange={(keymapId, delta) => setExtras((prev) => ({
          ...prev,
          commentCounts: {
            ...prev.commentCounts,
            [keymapId]: Math.max(0, (prev.commentCounts[keymapId] ?? 0) + delta),
          },
        }))}
      />

      <CompareModal
        item={compareItem}
        myKeymap={keymap}
        onClose={() => setCompareItem(null)}
        onImport={() => {
          if (!compareItem) return
          doImport(compareItem)
          setCompareItem(null)
        }}
      />

      <PostDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={() => {
          if (!detailItem) return
          doImport(detailItem)
          setDetailItem(null)
        }}
      />
    </section>
  )
}

function Composer({
  profile, onOpen,
}: {
  profile: { name: string; avatarUrl: string | null } | null
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-y-[3px] border-[var(--color-ink)] p-3 text-left"
    >
      <Avatar url={profile?.avatarUrl ?? null} name={profile?.name ?? '?'} size={36} />
      <span
        className="flex-1 truncate rounded-[var(--radius-btn)] border-[3px] border-[var(--color-ink)] px-3 py-2 text-[0.85rem] font-bold opacity-60"
        style={{ background: 'var(--color-paper)' }}
      >
        今の配列を投稿する…
      </span>
      <span className="nb-btn shrink-0 !py-2 text-[0.8rem]" style={{ background: 'var(--color-lime)' }}>
        投稿
      </span>
    </button>
  )
}

function Avatar({ url, name, size = 22 }: { url: string | null; name: string; size?: number }) {
  const style = {
    width: size, height: size,
    border: '2px solid var(--color-ink)',
  } as const
  if (url) {
    return <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={style} />
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-black"
      style={{ ...style, background: 'var(--color-lime)', fontSize: size * 0.45 }}
    >
      {name.slice(0, 1)}
    </span>
  )
}

function PostCard({
  item, likeCount, liked, commentCount, onImport, onCompare, onLike, onComments, onOpenDetail,
}: {
  item: SharedKeymap
  likeCount: number
  liked: boolean
  commentCount: number
  onImport: () => void
  onCompare: () => void
  onLike: () => void
  onComments: () => void
  onOpenDetail: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [peekLayerIdx, setPeekLayerIdx] = useState(0)
  const [peekPos, setPeekPos] = useState<{ left: number; top: number } | null>(null)
  const peekLayers = item.keymap.layers.slice(0, 2)
  const articleRef = useRef<HTMLElement>(null)

  const openPeek = () => {
    const rect = articleRef.current?.getBoundingClientRect()
    if (rect) setPeekPos({ left: rect.left + 52, top: rect.bottom + 4 })
    setHovered(true)
  }
  const closePeek = () => {
    setHovered(false)
    setPeekLayerIdx(0)
  }

  return (
    <article
      ref={articleRef}
      className="relative flex gap-3 border-b-[3px] border-[var(--color-ink)] p-3"
      onMouseEnter={openPeek}
      onMouseLeave={closePeek}
    >
      <Avatar url={item.avatar_url} name={item.author} size={40} />

      <div className="min-w-0 flex-1">
        <button type="button" className="block w-full text-left" onClick={onOpenDetail}>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-[0.85rem] font-black">{item.author}</span>
            <span className="shrink-0 text-[0.72rem] font-bold opacity-50">・ {relativeTime(item.created_at)}</span>
          </div>

          <p className="mt-0.5 text-[0.95rem] font-black">{item.name}</p>
          {item.description && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.82rem] font-bold opacity-80">
              {item.description}
            </p>
          )}
          <p className="mt-1 text-[0.7rem] font-bold opacity-50">
            {item.keymap.layers.length} レイヤー ・ {item.keymap.combos.length} コンボ
          </p>
        </button>

        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            className="nb-btn !py-1 !px-2 text-[0.76rem]"
            aria-label="コメントを見る"
            onClick={onComments}
          >
            💬 {commentCount}
          </button>
          <button type="button" className="nb-btn !py-1 !px-2 text-[0.76rem]" onClick={onCompare}>
            ⇄ 比較
          </button>
          <button
            type="button"
            className="nb-btn !py-1 !px-2 text-[0.76rem]"
            style={liked ? { background: 'var(--color-pink)' } : undefined}
            aria-pressed={liked}
            aria-label="いいね"
            onClick={onLike}
          >
            {liked ? '♥' : '♡'} {likeCount}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="nb-btn shrink-0 !py-1 !px-2.5 text-[0.76rem]"
            style={{ background: 'var(--color-lime)' }}
            onClick={onImport}
          >
            読み込む
          </button>
        </div>
      </div>

      {hovered && peekLayers.length > 0 && peekPos && createPortal(
        <div
          className="nb nb-lg fixed z-50 w-[19rem] max-w-[85vw] space-y-2 p-3"
          style={{ background: 'var(--color-paper)', left: peekPos.left, top: peekPos.top }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={closePeek}
        >
          <div className="flex flex-wrap gap-1.5">
            {peekLayers.map((layer, i) => (
              <button
                key={layer.id}
                type="button"
                className="nb-chip"
                style={{
                  background: peekLayerIdx === i ? LAYER_COLOR_HEX[layer.color] : 'var(--color-paper)',
                  opacity: peekLayerIdx === i ? 1 : 0.55,
                }}
                onClick={() => setPeekLayerIdx(i)}
              >
                L{layer.id} {layer.name}
              </button>
            ))}
          </div>
          <KeyboardView interactive={false} compact previewKeymap={item.keymap} previewLayer={peekLayerIdx} />
        </div>,
        document.body,
      )}
    </article>
  )
}

function ShareModal({
  open, onClose, shareName, onShareName, authorName, onAuthorName,
  shareDesc, onShareDesc, sharing, onSubmit, shareMsg, profile,
}: {
  open: boolean
  onClose: () => void
  shareName: string
  onShareName: (v: string) => void
  authorName: string
  onAuthorName: (v: string) => void
  shareDesc: string
  onShareDesc: (v: string) => void
  sharing: boolean
  onSubmit: () => void
  shareMsg: string | null
  profile: { name: string; avatarUrl: string | null } | null
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSubmit = !!shareName.trim() && (!!profile || !!authorName.trim()) && !sharing

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="今の配列を投稿する"
        className="nb nb-lg w-full max-w-md overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          <h3 className="min-w-0 flex-1 truncate text-[1.05rem]">今の配列を投稿する</h3>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="space-y-3 p-3">
          <label className="block">
            <span className="nb-eyebrow">配列名</span>
            <input
              className="nb-input mt-1"
              value={shareName}
              maxLength={60}
              onChange={(e) => onShareName(e.target.value)}
              placeholder="例: プログラマー向け配列"
              autoFocus
            />
          </label>
          {profile
            ? (
              <div>
                <span className="nb-eyebrow">投稿者</span>
                <div className="nb nb-flat mt-1 flex items-center gap-2 p-2">
                  <Avatar url={profile.avatarUrl} name={profile.name} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[0.85rem] font-black">{profile.name}</span>
                  <span className="nb-chip shrink-0" style={{ background: 'var(--color-lime)' }}>ログイン中</span>
                </div>
              </div>
            )
            : (
              <>
                <label className="block">
                  <span className="nb-eyebrow">あなたの名前</span>
                  <input
                    className="nb-input mt-1"
                    value={authorName}
                    maxLength={30}
                    onChange={(e) => onAuthorName(e.target.value)}
                    placeholder="例: たなか"
                  />
                </label>
                {authEnabled() && (
                  <button
                    type="button"
                    className="nb-btn w-full !py-1.5 text-[0.76rem]"
                    onClick={() => void signInWithGoogle()}
                  >
                    G Google でログインして、自分の名前とアイコンで投稿する
                  </button>
                )}
              </>
            )}
          <label className="block">
            <span className="nb-eyebrow">説明（任意）</span>
            <input
              className="nb-input mt-1"
              value={shareDesc}
              maxLength={280}
              onChange={(e) => onShareDesc(e.target.value)}
              placeholder="どんな配列か一言"
            />
          </label>
          {shareMsg && (
            <p className="nb-chip" style={{ background: 'var(--color-lime)' }}>{shareMsg}</p>
          )}
          <button
            type="button"
            className="nb-btn flex w-full items-center justify-center gap-2 !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {sharing && <Ring size={14} />}
            {sharing ? '共有中…' : '共有する'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CompareModal({
  item, myKeymap, onClose, onImport,
}: {
  item: SharedKeymap | null
  myKeymap: Keymap
  onClose: () => void
  onImport: () => void
}) {
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  const diffByLayer = useMemo(() => {
    if (!item) return []
    return item.keymap.layers.map((_, i) => diffKeysForLayer(myKeymap, item.keymap, i))
  }, [item, myKeymap])

  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} と比較`}
        className="nb nb-lg flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">配列を比較</p>
            <h3 className="truncate text-[1.05rem]">あなたの配列 ⇔ {item.name}</h3>
          </div>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="nb nb-flat p-2 text-center">
              <p className="text-[0.85rem] font-black">あなたの配列</p>
              <p className="text-[0.7rem] font-bold opacity-60">
                {myKeymap.layers.length} レイヤー ・ {myKeymap.combos.length} コンボ
              </p>
            </div>
            <div className="nb nb-flat p-2 text-center">
              <p className="truncate text-[0.85rem] font-black">{item.name}</p>
              <p className="text-[0.7rem] font-bold opacity-60">
                {item.author} ・ {item.keymap.layers.length} レイヤー ・ {item.keymap.combos.length} コンボ
              </p>
            </div>
          </div>

          <p className="mb-3 flex items-center gap-1.5 text-[0.7rem] font-bold opacity-70">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-[3px]"
              style={{
                background: 'color-mix(in srgb, var(--color-pink) 20%, var(--color-paper))',
                border: '2px solid var(--color-pink)',
              }}
            />
            縁がピンクのキーは、あなたの配列と割当が違います
          </p>

          <div className="space-y-4">
            {item.keymap.layers.map((theirLayer, i) => {
              const myLayer = myKeymap.layers[i]
              const diffKeys = diffByLayer[i]
              return (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div>
                    {myLayer && (
                      <span
                        className="nb-chip mb-1"
                        style={{ background: LAYER_COLOR_HEX[myLayer.color] }}
                      >
                        L{myLayer.id} {myLayer.name}
                      </span>
                    )}
                    {myLayer
                      ? (
                        <KeyboardView
                          interactive={false} compact previewKeymap={myKeymap} previewLayer={i} diffKeys={diffKeys}
                        />
                      )
                      : <p className="text-[0.72rem] font-bold opacity-50">このレイヤーはありません</p>}
                  </div>
                  <div>
                    <span
                      className="nb-chip mb-1"
                      style={{ background: LAYER_COLOR_HEX[theirLayer.color] }}
                    >
                      L{theirLayer.id} {theirLayer.name}
                    </span>
                    <KeyboardView
                      interactive={false} compact previewKeymap={item.keymap} previewLayer={i} diffKeys={diffKeys}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t-[3px] border-[var(--color-ink)] p-3">
          <button
            type="button"
            className="nb-btn w-full !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            onClick={onImport}
          >
            「{item.name}」を読み込む
          </button>
        </div>
      </div>
    </div>
  )
}

function PostDetailModal({
  item, onClose, onEdit,
}: {
  item: SharedKeymap | null
  onClose: () => void
  onEdit: () => void
}) {
  const [layerIdx, setLayerIdx] = useState(0)

  useEffect(() => {
    if (!item) return
    setLayerIdx(0)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item) return null

  const layer = item.keymap.layers[layerIdx]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className="nb nb-lg flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">{item.author}</p>
            <h3 className="truncate text-[1.05rem]">{item.name}</h3>
          </div>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {item.description && (
            <p className="mb-3 whitespace-pre-wrap break-words text-[0.82rem] font-bold opacity-80">
              {item.description}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {item.keymap.layers.map((l, i) => (
              <button
                key={l.id}
                type="button"
                className="nb-chip"
                style={{
                  background: layerIdx === i ? LAYER_COLOR_HEX[l.color] : 'var(--color-paper)',
                  opacity: layerIdx === i ? 1 : 0.55,
                }}
                onClick={() => setLayerIdx(i)}
              >
                L{l.id} {l.name}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[520px]">
              <KeyboardView interactive={false} previewKeymap={item.keymap} previewLayer={layerIdx} />
            </div>
          </div>

          {layer && (
            <p className="mt-2 text-[0.72rem] font-bold opacity-60">
              {layer.name} ・ このレイヤーは編集中の配列には反映されません（プレビューのみ）
            </p>
          )}
        </div>

        <div className="border-t-[3px] border-[var(--color-ink)] p-3">
          <button
            type="button"
            className="nb-btn w-full !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            onClick={onEdit}
          >
            この配列を編集する
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentsModal({
  item, onClose, onCountChange,
}: {
  item: SharedKeymap | null
  onClose: () => void
  onCountChange: (keymapId: string, delta: number) => void
}) {
  const user = useAuthStore((s) => s.user)
  const profile = user ? profileFromUser(user) : null

  const [comments, setComments] = useState<KeymapComment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  useEffect(() => {
    if (!item) { setComments(null); return }
    let cancelled = false
    setComments(null)
    setError(null)
    fetchComments(item.id)
      .then((rows) => { if (!cancelled) setComments(rows) })
      .catch((e) => { if (!cancelled) setError(`コメントを読み込めませんでした: ${errorMessage(e)}`) })
    return () => { cancelled = true }
  }, [item])

  if (!item) return null

  const doPost = async () => {
    if (!user || !profile || !body.trim()) return
    setPosting(true)
    setError(null)
    try {
      await postComment({
        keymapId: item.id,
        userId: user.id,
        authorName: profile.name,
        avatarUrl: profile.avatarUrl,
        body: body.trim(),
      })
      setBody('')
      setComments(await fetchComments(item.id))
      onCountChange(item.id, 1)
    } catch (e) {
      setError(`コメントの投稿に失敗しました: ${errorMessage(e)}`)
    } finally {
      setPosting(false)
    }
  }

  const doDelete = async (comment: KeymapComment) => {
    if (!confirm('このコメントを削除しますか？')) return
    try {
      await deleteComment(comment.id)
      setComments((prev) => prev?.filter((c) => c.id !== comment.id) ?? null)
      onCountChange(item.id, -1)
    } catch (e) {
      setError(`コメントの削除に失敗しました: ${errorMessage(e)}`)
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
        aria-label={`${item.name} のコメント`}
        className="nb nb-lg flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">コメント</p>
            <h3 className="truncate text-[1.05rem]">{item.name}</h3>
          </div>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {comments === null && !error && (
            <p className="flex items-center justify-center gap-2 py-6 text-[0.85rem] font-bold opacity-60">
              <Ring size={15} />
              読み込み中…
            </p>
          )}
          {comments?.length === 0 && (
            <p className="py-6 text-center text-[0.82rem] font-bold opacity-60">
              まだコメントがありません。最初の一言をどうぞ。
            </p>
          )}
          {comments?.map((c) => (
            <div key={c.id} className="nb nb-flat flex gap-2 p-2.5">
              <Avatar url={c.avatar_url} name={c.author_name} size={26} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="truncate text-[0.8rem] font-black">{c.author_name}</span>
                  <span className="shrink-0 text-[0.68rem] font-bold opacity-50">
                    {new Date(c.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </p>
                <p className="whitespace-pre-wrap break-words text-[0.8rem] font-bold opacity-85">{c.body}</p>
              </div>
              {user?.id === c.user_id && (
                <button
                  type="button"
                  className="nb-btn shrink-0 self-start !py-0.5 !px-1.5 text-[0.68rem]"
                  onClick={() => void doDelete(c)}
                >
                  削除
                </button>
              )}
            </div>
          ))}
          {error && (
            <p className="text-[0.78rem] font-bold" style={{ color: 'var(--color-pink)' }}>{error}</p>
          )}
        </div>

        <div className="border-t-[3px] border-[var(--color-ink)] p-3">
          {profile
            ? (
              <div className="flex items-end gap-2">
                <Avatar url={profile.avatarUrl} name={profile.name} size={26} />
                <input
                  className="nb-input min-w-0 flex-1"
                  value={body}
                  maxLength={500}
                  placeholder="この配列にコメントする"
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void doPost() }}
                />
                <button
                  type="button"
                  className="nb-btn flex shrink-0 items-center gap-1.5 !py-2 text-[0.78rem]"
                  style={{ background: 'var(--color-lime)' }}
                  disabled={!body.trim() || posting}
                  onClick={() => void doPost()}
                >
                  {posting && <Ring size={13} />}
                  送信
                </button>
              </div>
            )
            : (
              <button
                type="button"
                className="nb-btn w-full !py-2 text-[0.8rem]"
                onClick={() => void signInWithGoogle()}
                disabled={!authEnabled()}
              >
                G Google でログインしてコメントする
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
