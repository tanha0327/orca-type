import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LAYER_COLOR_HEX, type Keymap } from '../../data/types'
import { errorMessage } from '../../lib/errors'
import {
  deleteComment, deleteKeymap, fetchComments, fetchFeed, fetchFeedExtras, feedEnabled, postComment,
  shareKeymap, toggleLike, type FeedExtras, type KeymapComment, type SharedKeymap,
} from '../../lib/feed'
import { useAuthStore } from '../../store/authStore'
import { useFeedStore } from '../../store/feedStore'
import { useKeymapStore } from '../../store/keymapStore'
import { useProfileStore } from '../../store/profileStore'
import { KeyboardView } from '../Board/KeyboardView'
import { IconComment, IconHeart, IconImageSave, IconLoad, IconTrash, IconX } from '../Icons'
import { Ring } from '../Ring'
import { Avatar, DeviceColors, importSharedKeymap, relativeTime } from './FeedParts'
import { SortBar, sortOption } from './FeedSort'
import { PostDiff } from './KeymapDiff'
import { PostViewerModal } from './PostViewerModal'

const EMPTY_EXTRAS: FeedExtras = { likeCounts: {}, likedByMe: new Set(), commentCounts: {} }

/** カード要素を PNG 画像（Blob）に変換する（保存・シェア共通） */
async function captureAsPng(el: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas')
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--color-paper').trim()
  const canvas = await html2canvas(el, { backgroundColor: paper || '#ffffff', scale: 2 })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('画像の生成に失敗しました')
  return blob
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function FeedView() {
  const keymap = useKeymapStore((s) => s.keymap)

  const user = useAuthStore((s) => s.user)
  const openLoginModal = useAuthStore((s) => s.openLoginModal)
  const profile = useProfileStore((s) => s.profile)

  const sort = useFeedStore((s) => s.sort)
  const focusLayer = useFeedStore((s) => s.focusLayer)
  const setFocusLayer = useFeedStore((s) => s.setFocusLayer)
  const viewer = useFeedStore((s) => s.viewer)
  const openViewer = useFeedStore((s) => s.openViewer)

  const [items, setItems] = useState<SharedKeymap[] | null>(null)
  const [extras, setExtras] = useState<FeedExtras>(EMPTY_EXTRAS)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rankFallback, setRankFallback] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareName, setShareName] = useState('')
  const [shareDesc, setShareDesc] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [commentItem, setCommentItem] = useState<SharedKeymap | null>(null)

  // 並び順をすばやく切り替えたとき、古いほうの応答で一覧を上書きしないようにする
  const loadSeq = useRef(0)

  const load = async () => {
    const seq = ++loadSeq.current
    setLoadError(null)
    try {
      const page = await fetchFeed(sort)
      if (seq !== loadSeq.current) return
      setItems(page.items)
      setRankFallback(page.rankFallback)
      // いいね・コメントのテーブルがまだ無い環境でも、配列一覧そのものは出したままにする
      try {
        const next = await fetchFeedExtras(page.items.map((r) => r.id), user?.id ?? null)
        if (seq === loadSeq.current) setExtras(next)
      } catch {
        if (seq === loadSeq.current) setExtras(EMPTY_EXTRAS)
      }
    } catch (e) {
      if (seq === loadSeq.current) setLoadError(`読み込みに失敗しました: ${errorMessage(e)}`)
    }
  }

  useEffect(() => { void load() }, [user?.id, sort])

  // 並び順を変えたら、一覧を読み込み直して先頭から見せる
  const shownSort = useRef(sort)
  useEffect(() => {
    if (shownSort.current === sort) return
    shownSort.current = sort
    setItems(null)
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [sort])

  // フィードを離れたら、大きく見るモーダルは閉じておく（戻ったときに勝手に開かないように）
  useEffect(() => () => openViewer(null), [openViewer])

  const closeViewer = useCallback(() => openViewer(null), [openViewer])

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

  const current = sortOption(sort)

  const doShare = async () => {
    if (!shareName.trim() || !user || !profile) return
    setSharing(true)
    try {
      await shareKeymap({
        name: shareName.trim(),
        author: profile.name,
        description: shareDesc.trim(),
        keymap,
        userId: user.id,
        avatarUrl: profile.avatarUrl,
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

  const doToggleLike = async (item: SharedKeymap) => {
    if (!user) {
      openLoginModal()
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

  const doDeletePost = async (item: SharedKeymap) => {
    if (!confirm(`「${item.name}」を削除しますか？ この操作は取り消せません。`)) return
    try {
      await deleteKeymap(item.id)
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null)
      if (commentItem?.id === item.id) setCommentItem(null)
      if (useFeedStore.getState().viewer?.id === item.id) openViewer(null)
    } catch (e) {
      setShareMsg(`削除に失敗しました: ${errorMessage(e)}`)
    }
  }

  return (
    <section className="nb nb-lg overflow-hidden">
      <div className="flex items-end gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.35rem]">みんなの配列</h2>
          <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
            みんなが共有したキーマップのタイムライン。あなたの配列と違うキーがピンクで表示されます。
          </p>
        </div>
        <span
          className="nb-chip hidden shrink-0 lg:inline-flex"
          style={{ background: current.color }}
          title={current.help}
        >
          {current.icon(12)}
          {current.label}
        </span>
      </div>

      <div className="px-4 pb-3 lg:hidden">
        <SortBar />
      </div>

      {(shareMsg || loadError || rankFallback) && (
        <div className="space-y-2 px-4 pb-3">
          {shareMsg && (
            <p className="nb-chip" style={{ background: 'var(--color-lime)' }}>{shareMsg}</p>
          )}
          {loadError && (
            <p className="text-[0.8rem] font-bold" style={{ color: 'var(--color-pink)' }}>{loadError}</p>
          )}
          {rankFallback && !loadError && (
            <p className="text-[0.74rem] font-bold opacity-70">
              いいね・コメントの情報を読み込めなかったので、新しい順で表示しています。
            </p>
          )}
        </div>
      )}

      <Composer
        profile={profile}
        loggedIn={!!user}
        onOpen={() => (user ? setShareOpen(true) : openLoginModal())}
      />

      {items?.map((item) => (
        <PostCard
          key={item.id}
          item={item}
          myKeymap={keymap}
          focusLayer={focusLayer}
          onFocusLayer={setFocusLayer}
          canDelete={!!user && user.id === item.user_id}
          likeCount={extras.likeCounts[item.id] ?? 0}
          liked={extras.likedByMe.has(item.id)}
          commentCount={extras.commentCounts[item.id] ?? 0}
          onOpen={() => openViewer(item)}
          onImport={() => importSharedKeymap(item)}
          onLike={() => void doToggleLike(item)}
          onComments={() => setCommentItem(item)}
          onDelete={() => void doDeletePost(item)}
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
        shareDesc={shareDesc}
        onShareDesc={setShareDesc}
        sharing={sharing}
        onSubmit={() => void doShare()}
        shareMsg={shareMsg}
        profile={profile}
        onRequireLogin={() => { setShareOpen(false); openLoginModal() }}
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

      <PostViewerModal
        item={viewer}
        canDelete={!!user && !!viewer && user.id === viewer.user_id}
        onClose={closeViewer}
        onImport={() => { if (viewer) importSharedKeymap(viewer) }}
        onDelete={() => { if (viewer) void doDeletePost(viewer) }}
      />
    </section>
  )
}

function Composer({
  profile, loggedIn, onOpen,
}: {
  profile: { name: string; avatarUrl: string | null } | null
  loggedIn: boolean
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
        {loggedIn ? '今の配列を投稿する…' : '投稿するにはログインしてください'}
      </span>
      <span className="nb-btn shrink-0 !py-2 text-[0.8rem]" style={{ background: 'var(--color-lime)' }}>
        {loggedIn ? '投稿' : 'ログイン'}
      </span>
    </button>
  )
}

/** 投稿カードの操作ボタン。どれも同じ大きさの正方形で、アイコンだけを出す（名前はツールチップと読み上げ用） */
function ActionButton({
  label, count = 0, pressed, tone, busy = false, onClick, children,
}: {
  label: string
  /** 1 以上なら右上に件数のバッジを出す */
  count?: number
  pressed?: boolean
  tone?: string
  busy?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="nb-btn relative !h-10 !w-10 shrink-0 !p-0"
      style={tone ? { background: tone } : undefined}
      aria-label={count > 0 ? `${label}（${count}）` : label}
      aria-pressed={pressed}
      title={label}
      disabled={busy}
      onClick={onClick}
    >
      {busy ? <Ring size={18} /> : children}
      {count > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2.5 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[0.62rem] font-black leading-none"
          style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', border: '2px solid var(--color-ink)' }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

function PostCard({
  item, myKeymap, focusLayer, onFocusLayer, canDelete, likeCount, liked, commentCount,
  onOpen, onImport, onLike, onComments, onDelete,
}: {
  item: SharedKeymap
  /** 比べる基準（編集中の自分の配列） */
  myKeymap: Keymap
  /** 大きい盤面に出すレイヤー（全部の投稿で共通） */
  focusLayer: number
  onFocusLayer: (n: number) => void
  canDelete: boolean
  likeCount: number
  liked: boolean
  commentCount: number
  /** 投稿を大きく見るモーダルを開く */
  onOpen: () => void
  onImport: () => void
  onLike: () => void
  onComments: () => void
  onDelete: () => void
}) {
  const [saving, setSaving] = useState(false)
  const fullCaptureRef = useRef<HTMLDivElement>(null)

  const captureFilename = () => `orca-${item.name.replace(/\s+/g, '-')}.png`

  // タイムラインの大きい盤面は 1 レイヤーずつしか印字を出さないので、保存用の画像は
  // 全レイヤーを画面外に一度だけ描画してからまとめてキャプチャする
  useEffect(() => {
    if (!saving) return
    let cancelled = false
    void (async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      if (cancelled || !fullCaptureRef.current) return
      try {
        const blob = await captureAsPng(fullCaptureRef.current)
        if (!cancelled) downloadBlob(blob, captureFilename())
      } catch (e) {
        if (!cancelled) alert(`画像の保存に失敗しました: ${errorMessage(e)}`)
      } finally {
        if (!cancelled) setSaving(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving])

  // 寿司打の「Xで結果をシェア」のように、その場で文面入りの投稿画面を開くだけにする。
  // window.open() での実装はブラウザによってポップアップブロックの対象になり得るので、
  // 普通の <a target="_blank"> によるリンク遷移にする（これはブロックされない）
  const shareXHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `『${item.name}』（${item.author}さん・${item.keymap.layers.length}レイヤー）を Orca echo で共有中 #Orcaecho`,
  )}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`

  return (
    <article className="relative border-b-[3px] border-[var(--color-ink)] p-3">
      <div className="flex gap-3">
        <Avatar url={item.avatar_url} name={item.author} size={40} />

        <div className="min-w-0 flex-1">
          <button type="button" className="block w-full text-left" onClick={onOpen}>
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

          <div className="mt-1.5">
            <DeviceColors keymap={item.keymap} />
          </div>

          {item.keymap.layers.length > 0 && (
            <div className="mt-2">
              <PostDiff theirs={item.keymap} mine={myKeymap} focus={focusLayer} onFocus={onFocusLayer} />
            </div>
          )}
        </div>
      </div>

      {/* 保存用の画像は、8 レイヤーを横 2 × 縦 4 に並べて正方形に近い形にする */}
      {saving && (
        <div
          ref={fullCaptureRef}
          aria-hidden
          className="fixed left-[-9999px] top-0 w-[1040px]"
          style={{ background: 'var(--color-paper)' }}
        >
          <div className="flex gap-3 p-3">
            <Avatar url={item.avatar_url} name={item.author} size={40} />
            <div className="min-w-0 flex-1">
              {/* html2canvas は truncate（overflow: hidden）の中の文字を下にずらして切ってしまうので、画像用は省略しない */}
              <p className="text-[0.85rem] font-black">{item.author}</p>
              <p className="mt-0.5 text-[0.95rem] font-black">{item.name}</p>
              {item.description && (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.82rem] font-bold opacity-80">
                  {item.description}
                </p>
              )}
              <div className="mt-1.5">
                <DeviceColors keymap={item.keymap} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 p-3 pt-0">
            {item.keymap.layers.map((layer, i) => (
              <div key={layer.id}>
                <span className="nb-chip mb-1" style={{ background: LAYER_COLOR_HEX[layer.color] }}>
                  L{layer.id} {layer.name}
                </span>
                <KeyboardView interactive={false} compact previewKeymap={item.keymap} previewLayer={i} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2.5">
        <ActionButton
          label={liked ? 'いいねを取り消す' : 'いいね'}
          count={likeCount}
          pressed={liked}
          tone={liked ? 'var(--color-pink)' : undefined}
          onClick={onLike}
        >
          <IconHeart filled={liked} />
        </ActionButton>
        <ActionButton label="コメント" count={commentCount} onClick={onComments}>
          <IconComment />
        </ActionButton>
        <ActionButton label="画像を保存（全レイヤー）" busy={saving} onClick={() => setSaving(true)}>
          <IconImageSave />
        </ActionButton>
        <a
          href={shareXHref}
          target="_blank"
          rel="noopener noreferrer"
          className="nb-btn !h-10 !w-10 shrink-0 !p-0"
          aria-label="Xでシェア"
          title="Xでシェア"
        >
          <IconX size={17} />
        </a>
        <span className="flex-1" />
        {canDelete && (
          <ActionButton label="投稿を削除" tone="var(--color-pink)" onClick={onDelete}>
            <IconTrash />
          </ActionButton>
        )}
        <button
          type="button"
          className="nb-btn !h-10 shrink-0 !px-3 text-[0.82rem]"
          style={{ background: 'var(--color-lime)' }}
          onClick={onImport}
          title="この配列を編集画面に読み込む"
        >
          <IconLoad size={17} />
          読み込む
        </button>
      </div>
    </article>
  )
}

function ShareModal({
  open, onClose, shareName, onShareName,
  shareDesc, onShareDesc, sharing, onSubmit, shareMsg, profile, onRequireLogin,
}: {
  open: boolean
  onClose: () => void
  shareName: string
  onShareName: (v: string) => void
  shareDesc: string
  onShareDesc: (v: string) => void
  sharing: boolean
  onSubmit: () => void
  shareMsg: string | null
  profile: { name: string; avatarUrl: string | null } | null
  onRequireLogin: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSubmit = !!shareName.trim() && !!profile && !sharing

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
              <div className="nb nb-flat p-3 text-center">
                <p className="text-[0.82rem] font-bold opacity-70">投稿にはログインが必要です</p>
                <button type="button" className="nb-btn mt-2 !py-1.5 text-[0.78rem]" onClick={onRequireLogin}>
                  ログインする
                </button>
              </div>
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

function CommentsModal({
  item, onClose, onCountChange,
}: {
  item: SharedKeymap | null
  onClose: () => void
  onCountChange: (keymapId: string, delta: number) => void
}) {
  const user = useAuthStore((s) => s.user)
  const openLoginModal = useAuthStore((s) => s.openLoginModal)
  const profile = useProfileStore((s) => s.profile)

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
                onClick={openLoginModal}
              >
                ログインしてコメントする
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
