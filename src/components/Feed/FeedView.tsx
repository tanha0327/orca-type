import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { KEYS, type KeyId } from '../../data/layout'
import {
  BODY_COLOR_LABEL, LAYER_COLOR_HEX, TRACKBALL_COLOR_GRADIENT, TRACKBALL_COLOR_LABEL,
  type BodyColor, type Keymap, type TrackballColor,
} from '../../data/types'
import {
  classifyKeymap, FEED_CATEGORIES, getCategory, keymapSimilarity, type CategoryId,
} from '../../engine/analyze'
import { resolveKey } from '../../engine/resolve'
import { errorMessage } from '../../lib/errors'
import {
  deleteComment, deleteKeymap, fetchComments, fetchFeed, fetchFeedExtras, fetchKeymapsByIds, feedEnabled,
  postComment, shareKeymap, toggleLike, type FeedExtras, type KeymapComment, type SharedKeymap,
} from '../../lib/feed'
import { useAuthStore } from '../../store/authStore'
import { useFolderStore } from '../../store/folderStore'
import { useKeymapStore } from '../../store/keymapStore'
import { useProfileStore } from '../../store/profileStore'
import { KeyboardView } from '../Board/KeyboardView'
import { Ring } from '../Ring'
import { FolderBar, type FeedFolder, type FeedSort } from './FolderBar'
import { SaveToFolderModal } from './SaveToFolderModal'

const EMPTY_EXTRAS: FeedExtras = { likeCounts: {}, likedByMe: new Set(), commentCounts: {} }

/** いいねがこの数以上の投稿は「話題の配列」として 🔥 を付け、新着順では上に出す */
const BUZZ_LIKE_THRESHOLD = 10
/** 投稿からこの時間内は NEW を付ける */
const NEW_BADGE_MS = 24 * 60 * 60 * 1000

function mergeExtras(a: FeedExtras, b: FeedExtras): FeedExtras {
  return {
    likeCounts: { ...a.likeCounts, ...b.likeCounts },
    likedByMe: new Set([...a.likedByMe, ...b.likedByMe]),
    commentCounts: { ...a.commentCounts, ...b.commentCounts },
  }
}

function byNewest(a: SharedKeymap, b: SharedKeymap): number {
  return Date.parse(b.created_at) - Date.parse(a.created_at)
}

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
  const importKeymap = useKeymapStore((s) => s.importKeymap)
  const setView = useKeymapStore((s) => s.setView)

  const user = useAuthStore((s) => s.user)
  const openLoginModal = useAuthStore((s) => s.openLoginModal)
  const profile = useProfileStore((s) => s.profile)

  const itemsByFolder = useFolderStore((s) => s.itemsByFolder)
  const moveInFolder = useFolderStore((s) => s.move)
  const forgetKeymap = useFolderStore((s) => s.forgetKeymap)

  const [items, setItems] = useState<SharedKeymap[] | null>(null)
  /** 新着の範囲より古いが、自分のフォルダに入っている投稿 */
  const [olderItems, setOlderItems] = useState<SharedKeymap[]>([])
  const [extras, setExtras] = useState<FeedExtras>(EMPTY_EXTRAS)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareName, setShareName] = useState('')
  const [shareDesc, setShareDesc] = useState('')
  /** null のあいだは自動判定のカテゴリで投稿する */
  const [shareCategory, setShareCategory] = useState<CategoryId | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [compareItem, setCompareItem] = useState<SharedKeymap | null>(null)
  const [commentItem, setCommentItem] = useState<SharedKeymap | null>(null)
  const [detailItem, setDetailItem] = useState<SharedKeymap | null>(null)
  const [saveItem, setSaveItem] = useState<SharedKeymap | null>(null)
  const [folder, setFolder] = useState<FeedFolder>({ kind: 'all' })
  const [sort, setSort] = useState<FeedSort>('new')

  const olderRef = useRef<SharedKeymap[]>([])
  olderRef.current = olderItems
  /** 取りに行ったことのある古い投稿の ID（消えた投稿を何度も取りに行かないように） */
  const requestedOlder = useRef(new Set<string>())

  const load = async () => {
    setLoadError(null)
    try {
      const rows = await fetchFeed()
      setItems(rows)
      // いいね・コメントのテーブルがまだ無い環境でも、配列一覧そのものは出したままにする
      try {
        const ids = [...rows, ...olderRef.current].map((r) => r.id)
        setExtras(await fetchFeedExtras(ids, user?.id ?? null))
      } catch {
        setExtras(EMPTY_EXTRAS)
      }
    } catch (e) {
      setLoadError(`読み込みに失敗しました: ${errorMessage(e)}`)
    }
  }

  useEffect(() => { void load() }, [user?.id])

  // 自分のフォルダに、新着の範囲に入っていない古い投稿があれば取ってくる
  useEffect(() => {
    if (!items) return
    const known = new Set([...items, ...olderItems].map((i) => i.id))
    const missing = Object.values(itemsByFolder)
      .flat()
      .map((it) => it.keymapId)
      .filter((id) => !known.has(id) && !requestedOlder.current.has(id))
    if (missing.length === 0) return
    const ids = [...new Set(missing)]
    for (const id of ids) requestedOlder.current.add(id)
    void (async () => {
      try {
        const rows = await fetchKeymapsByIds(ids)
        if (rows.length === 0) return
        setOlderItems((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))])
        const more = await fetchFeedExtras(rows.map((r) => r.id), user?.id ?? null).catch(() => EMPTY_EXTRAS)
        setExtras((prev) => mergeExtras(prev, more))
      } catch {
        // 取れなかった投稿はフォルダの件数にだけ残り、一覧には出ない
      }
    })()
  }, [items, olderItems, itemsByFolder, user?.id])

  // 自分のフォルダを開いたら手動の並び順、離れたら新着順に戻す
  function changeFolder(next: FeedFolder) {
    setFolder(next)
    if (next.kind === 'mine' && folder.kind !== 'mine') setSort('manual')
    if (next.kind !== 'mine' && sort === 'manual') setSort('new')
  }

  // ログアウトしたら自分のフォルダは見られないので「すべて」に戻す
  useEffect(() => {
    if (!user && folder.kind === 'mine') changeFolder({ kind: 'all' })
  }, [user])

  const byId = useMemo(() => {
    const map = new Map<string, SharedKeymap>()
    for (const it of [...(items ?? []), ...olderItems]) map.set(it.id, it)
    return map
  }, [items, olderItems])

  // カテゴリ未設定の古い投稿は、配列の中身から自動で判定して振り分ける
  const categoryOf = useMemo(() => {
    const map = new Map<string, CategoryId>()
    for (const it of byId.values()) map.set(it.id, it.category ?? classifyKeymap(it.keymap))
    return map
  }, [byId])

  const similarityOf = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of byId.values()) map.set(it.id, keymapSimilarity(keymap, it.keymap))
    return map
  }, [byId, keymap])

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CategoryId, number>> = {}
    for (const it of items ?? []) {
      const c = categoryOf.get(it.id) ?? 'standard'
      counts[c] = (counts[c] ?? 0) + 1
    }
    return counts
  }, [items, categoryOf])

  const likeCountOf = (id: string) => extras.likeCounts[id] ?? 0
  const isBuzz = (id: string) => likeCountOf(id) >= BUZZ_LIKE_THRESHOLD

  /** いま見ているフォルダの投稿を、選んだ並び順で */
  const visible = useMemo(() => {
    if (!items) return null
    let list: SharedKeymap[]
    if (folder.kind === 'mine') {
      list = [...(itemsByFolder[folder.folderId] ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((it) => byId.get(it.keymapId))
        .filter((it): it is SharedKeymap => !!it)
    } else if (folder.kind === 'category') {
      list = items.filter((it) => categoryOf.get(it.id) === folder.id)
    } else {
      list = [...items]
    }

    if (sort === 'manual') return list
    if (sort === 'similar') {
      return [...list].sort((a, b) => (similarityOf.get(b.id) ?? 0) - (similarityOf.get(a.id) ?? 0) || byNewest(a, b))
    }
    if (sort === 'popular') {
      return [...list].sort((a, b) => likeCountOf(b.id) - likeCountOf(a.id) || byNewest(a, b))
    }
    return [...list].sort(byNewest)
  }, [items, folder, sort, itemsByFolder, byId, categoryOf, similarityOf, extras.likeCounts])

  // 新着順のときだけ、バズった投稿を「話題の配列」として先に並べる
  const buzzSection = sort === 'new' ? (visible ?? []).filter((it) => isBuzz(it.id)) : []
  const restSection = sort === 'new' ? (visible ?? []).filter((it) => !isBuzz(it.id)) : (visible ?? [])

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

  const flashMsg = (text: string) => {
    setShareMsg(text)
    window.setTimeout(() => setShareMsg((cur) => (cur === text ? null : cur)), 4000)
  }

  const autoCategory = classifyKeymap(keymap)

  const openShare = () => {
    if (!user) { openLoginModal(); return }
    setShareCategory(null)
    setShareOpen(true)
  }

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
        category: shareCategory ?? autoCategory,
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
      setOlderItems((prev) => prev.filter((i) => i.id !== item.id))
      forgetKeymap(item.id)
      if (compareItem?.id === item.id) setCompareItem(null)
      if (commentItem?.id === item.id) setCommentItem(null)
      if (detailItem?.id === item.id) setDetailItem(null)
      if (saveItem?.id === item.id) setSaveItem(null)
    } catch (e) {
      setShareMsg(`削除に失敗しました: ${errorMessage(e)}`)
    }
  }

  const doSave = (item: SharedKeymap) => {
    if (!user) { openLoginModal(); return }
    setSaveItem(item)
  }

  const doMove = async (item: SharedKeymap, dir: -1 | 1) => {
    if (folder.kind !== 'mine') return
    try {
      await moveInFolder(folder.folderId, item.id, dir)
    } catch (e) {
      flashMsg(`並べ替えに失敗しました: ${errorMessage(e)}`)
    }
  }

  const savedIds = new Set(Object.values(itemsByFolder).flat().map((it) => it.keymapId))

  const renderCard = (item: SharedKeymap, index: number, list: SharedKeymap[]) => (
    <PostCard
      key={item.id}
      item={item}
      canDelete={!!user && user.id === item.user_id}
      likeCount={likeCountOf(item.id)}
      liked={extras.likedByMe.has(item.id)}
      commentCount={extras.commentCounts[item.id] ?? 0}
      category={categoryOf.get(item.id) ?? 'standard'}
      similarity={similarityOf.get(item.id) ?? 0}
      isNew={Date.now() - Date.parse(item.created_at) < NEW_BADGE_MS}
      isBuzz={isBuzz(item.id)}
      saved={savedIds.has(item.id)}
      reorder={folder.kind === 'mine' && sort === 'manual'
        ? {
          canUp: index > 0,
          canDown: index < list.length - 1,
          onUp: () => void doMove(item, -1),
          onDown: () => void doMove(item, 1),
        }
        : undefined}
      onImport={() => doImport(item)}
      onCompare={() => setCompareItem(item)}
      onLike={() => void doToggleLike(item)}
      onComments={() => setCommentItem(item)}
      onOpenDetail={() => setDetailItem(item)}
      onDelete={() => void doDeletePost(item)}
      onSave={() => doSave(item)}
    />
  )

  return (
    <section className="nb nb-lg overflow-hidden">
      <div className="p-4 pb-3">
        <h2 className="text-[1.35rem]">みんなの配列</h2>
        <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
          みんなが共有したキーマップのタイムライン。いいね・コメントで反応したり、
          気に入った配列を自分のフォルダに保存したりできます。
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

      <Composer
        profile={profile}
        loggedIn={!!user}
        onOpen={openShare}
      />

      {items !== null && items.length > 0 && (
        <FolderBar
          folder={folder}
          onFolder={changeFolder}
          sort={sort}
          onSort={setSort}
          allCount={items.length}
          categoryCounts={categoryCounts}
          loggedIn={!!user}
          onRequireLogin={openLoginModal}
          onError={flashMsg}
        />
      )}

      {buzzSection.length > 0 && (
        <>
          <SectionHeading tone="var(--color-orange)">🔥 話題の配列（いいね {BUZZ_LIKE_THRESHOLD} 以上）</SectionHeading>
          {buzzSection.map((item, i) => renderCard(item, i, buzzSection))}
          {restSection.length > 0 && <SectionHeading tone="var(--color-paper)">新着</SectionHeading>}
        </>
      )}
      {restSection.map((item, i) => renderCard(item, i, restSection))}

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
      {items !== null && items.length > 0 && visible?.length === 0 && (
        <p className="py-8 text-center text-[0.85rem] font-bold opacity-60">
          {folder.kind === 'mine'
            ? 'このフォルダはまだ空です。投稿の「📁 保存」から追加できます。'
            : 'このフォルダにはまだ投稿がありません。'}
        </p>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareName={shareName}
        onShareName={setShareName}
        shareDesc={shareDesc}
        onShareDesc={setShareDesc}
        autoCategory={autoCategory}
        category={shareCategory}
        onCategory={setShareCategory}
        sharing={sharing}
        onSubmit={() => void doShare()}
        shareMsg={shareMsg}
        profile={profile}
        onRequireLogin={() => { setShareOpen(false); openLoginModal() }}
      />

      <SaveToFolderModal item={saveItem} onClose={() => setSaveItem(null)} />

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
        canDelete={!!user && !!detailItem && user.id === detailItem.user_id}
        onClose={() => setDetailItem(null)}
        onEdit={() => {
          if (!detailItem) return
          doImport(detailItem)
          setDetailItem(null)
        }}
        onDelete={() => {
          if (!detailItem) return
          void doDeletePost(detailItem)
        }}
      />
    </section>
  )
}

function SectionHeading({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <h3
      className="border-b-[3px] border-[var(--color-ink)] px-3 py-1.5 text-[0.8rem] font-black"
      style={{ background: tone }}
    >
      {children}
    </h3>
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

/** 本体色・トラックボール色の小さな丸スウォッチ（本体色は 'white' | 'black' で TRACKBALL_COLOR_GRADIENT のキーを共有） */
function ColorDot({ color, size = 14 }: { color: TrackballColor | BodyColor; size?: number }) {
  const [hi, mid, lo] = TRACKBALL_COLOR_GRADIENT[color]
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${mid} 42%, ${lo} 100%)`,
        border: '2px solid var(--color-ink)',
      }}
    />
  )
}

/** 投稿主が設定した本体色・トラックボール色をまとめて表示する */
function DeviceColors({ keymap }: { keymap: Keymap }) {
  const bodyColor = keymap.settings.bodyColor ?? 'white'
  const ballColor = keymap.trackball.color ?? 'white'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="nb-chip flex items-center gap-1.5" style={{ background: 'var(--color-paper)' }}>
        <ColorDot color={bodyColor} />
        本体: {BODY_COLOR_LABEL[bodyColor]}
      </span>
      <span className="nb-chip flex items-center gap-1.5" style={{ background: 'var(--color-paper)' }}>
        <ColorDot color={ballColor} />
        ボール: {TRACKBALL_COLOR_LABEL[ballColor]}
      </span>
    </div>
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

/** 自動フォルダ分け（カテゴリ）のチップ */
function CategoryChip({ id }: { id: CategoryId }) {
  const c = getCategory(id)
  return (
    <span className="nb-chip" style={{ background: 'var(--color-paper)' }} title={c.help}>
      {c.emoji} {c.label}
    </span>
  )
}

/** 自分の配列との一致度。かなり近いものは目立たせる */
function SimilarityChip({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <span
      className="nb-chip"
      style={{ background: pct >= 80 ? 'var(--color-lime)' : pct >= 50 ? 'var(--color-cyan)' : 'var(--color-paper)' }}
      title="全レイヤーの単押し・長押しとコンボを比べた一致度"
    >
      あなたと {pct}% 一致
    </span>
  )
}

/** 自分のフォルダを手動の並び順で見ているときの ↑ ↓ */
interface ReorderControls {
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
}

function PostCard({
  item, canDelete, likeCount, liked, commentCount, category, similarity, isNew, isBuzz, saved, reorder,
  onImport, onCompare, onLike, onComments, onOpenDetail, onDelete, onSave,
}: {
  item: SharedKeymap
  canDelete: boolean
  likeCount: number
  liked: boolean
  commentCount: number
  category: CategoryId
  /** 自分の配列との一致度（0〜1） */
  similarity: number
  isNew: boolean
  isBuzz: boolean
  /** 自分のフォルダのどれかに入っているか */
  saved: boolean
  reorder?: ReorderControls
  onImport: () => void
  onCompare: () => void
  onLike: () => void
  onComments: () => void
  onOpenDetail: () => void
  onDelete: () => void
  onSave: () => void
}) {
  const [previewLayerIdx, setPreviewLayerIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const fullCaptureRef = useRef<HTMLDivElement>(null)
  const previewLayers = item.keymap.layers.slice(0, 2)

  const captureFilename = () => `orca-${item.name.replace(/\s+/g, '-')}.png`

  // レイヤー切替 UI は「今見えているレイヤー」しか写さないので、保存用の画像は
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
          <div className="flex items-start gap-2">
            <button type="button" className="block min-w-0 flex-1 text-left" onClick={onOpenDetail}>
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-[0.85rem] font-black">{item.author}</span>
                <span className="shrink-0 text-[0.72rem] font-bold opacity-50">・ {relativeTime(item.created_at)}</span>
              </div>

              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.95rem] font-black">
                {item.name}
                {isNew && (
                  <span className="nb-chip !py-0 !text-[0.6rem]" style={{ background: 'var(--color-lime)' }}>NEW</span>
                )}
                {isBuzz && (
                  <span className="nb-chip !py-0 !text-[0.6rem]" style={{ background: 'var(--color-orange)' }}>🔥 話題</span>
                )}
              </p>
              {item.description && (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.82rem] font-bold opacity-80">
                  {item.description}
                </p>
              )}
              <p className="mt-1 text-[0.7rem] font-bold opacity-50">
                {item.keymap.layers.length} レイヤー ・ {item.keymap.combos.length} コンボ
              </p>
            </button>

            {reorder && (
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  type="button"
                  className="nb-btn !py-0.5 !px-2 text-[0.8rem]"
                  aria-label="上へ"
                  disabled={!reorder.canUp}
                  onClick={reorder.onUp}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="nb-btn !py-0.5 !px-2 text-[0.8rem]"
                  aria-label="下へ"
                  disabled={!reorder.canDown}
                  onClick={reorder.onDown}
                >
                  ↓
                </button>
              </div>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <CategoryChip id={category} />
            <SimilarityChip value={similarity} />
          </div>

          <div className="mt-1.5">
            <DeviceColors keymap={item.keymap} />
          </div>

          {previewLayers.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {previewLayers.map((layer, i) => (
                  <button
                    key={layer.id}
                    type="button"
                    className="nb-chip"
                    style={{
                      background: previewLayerIdx === i ? LAYER_COLOR_HEX[layer.color] : 'var(--color-paper)',
                      opacity: previewLayerIdx === i ? 1 : 0.55,
                    }}
                    onClick={() => setPreviewLayerIdx(i)}
                  >
                    L{layer.id} {layer.name}
                  </button>
                ))}
                {item.keymap.layers.length > previewLayers.length && (
                  <button type="button" className="nb-chip opacity-55" onClick={onOpenDetail}>
                    他 {item.keymap.layers.length - previewLayers.length} レイヤー…
                  </button>
                )}
              </div>
              <KeyboardView interactive={false} compact previewKeymap={item.keymap} previewLayer={previewLayerIdx} />
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div
          ref={fullCaptureRef}
          aria-hidden
          className="fixed left-[-9999px] top-0 w-[520px]"
          style={{ background: 'var(--color-paper)' }}
        >
          <div className="flex gap-3 p-3">
            <Avatar url={item.avatar_url} name={item.author} size={40} />
            <div className="min-w-0 flex-1">
              <span className="truncate text-[0.85rem] font-black">{item.author}</span>
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
          <div className="space-y-3 p-3 pt-0">
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

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="nb-btn !py-1.5 !px-3 text-[0.85rem]"
          aria-label="コメントを見る"
          onClick={onComments}
        >
          💬 {commentCount}
        </button>
        <button type="button" className="nb-btn !py-1.5 !px-3 text-[0.85rem]" onClick={onCompare}>
          ⇄ 比較
        </button>
        <button
          type="button"
          className="nb-btn !py-1.5 !px-3 text-[0.85rem]"
          style={liked ? { background: 'var(--color-pink)' } : undefined}
          aria-pressed={liked}
          aria-label="いいね"
          onClick={onLike}
        >
          {liked ? '♥' : '♡'} {likeCount}
        </button>
        <button
          type="button"
          className="nb-btn !py-1.5 !px-3 text-[0.85rem]"
          style={saved ? { background: 'var(--color-sand)' } : undefined}
          aria-label="フォルダに保存"
          onClick={onSave}
        >
          📁 {saved ? '保存済み' : '保存'}
        </button>
        <button
          type="button"
          className="nb-btn !py-1.5 !px-3 text-[0.85rem]"
          disabled={saving}
          aria-label="画像を保存（全レイヤー）"
          onClick={() => setSaving(true)}
        >
          {saving ? <Ring size={14} /> : '⬇'} 画像
        </button>
        <a
          href={shareXHref}
          target="_blank"
          rel="noopener noreferrer"
          className="nb-btn !py-1.5 !px-3 text-[0.85rem]"
          aria-label="Xでシェア"
        >
          𝕏 シェア
        </a>
        <span className="flex-1" />
        {canDelete && (
          <button
            type="button"
            className="nb-btn shrink-0 !py-1.5 !px-3 text-[0.85rem]"
            style={{ background: 'var(--color-pink)' }}
            aria-label="投稿を削除"
            onClick={onDelete}
          >
            削除
          </button>
        )}
        <button
          type="button"
          className="nb-btn shrink-0 !py-1.5 !px-3.5 text-[0.85rem]"
          style={{ background: 'var(--color-lime)' }}
          onClick={onImport}
        >
          読み込む
        </button>
      </div>
    </article>
  )
}

function ShareModal({
  open, onClose, shareName, onShareName, shareDesc, onShareDesc,
  autoCategory, category, onCategory, sharing, onSubmit, shareMsg, profile, onRequireLogin,
}: {
  open: boolean
  onClose: () => void
  shareName: string
  onShareName: (v: string) => void
  shareDesc: string
  onShareDesc: (v: string) => void
  /** 今の配列から自動判定したカテゴリ */
  autoCategory: CategoryId
  /** 投稿者が選び直したカテゴリ。null なら自動判定のまま */
  category: CategoryId | null
  onCategory: (c: CategoryId | null) => void
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
          <div>
            <span className="nb-eyebrow">フォルダ</span>
            <p className="mt-0.5 text-[0.7rem] font-bold opacity-60">
              配列の中身から「{getCategory(autoCategory).label}」と自動で判定しました。違えば選び直せます。
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="投稿のフォルダ">
              {FEED_CATEGORIES.map((c) => {
                const selected = (category ?? autoCategory) === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={c.help}
                    className="nb-chip"
                    style={{
                      background: selected ? 'var(--color-lime)' : 'var(--color-paper)',
                      opacity: selected ? 1 : 0.6,
                      cursor: 'pointer',
                    }}
                    onClick={() => onCategory(c.id === autoCategory ? null : c.id)}
                  >
                    {c.emoji} {c.label}
                    {c.id === autoCategory && <span className="opacity-60">（自動）</span>}
                  </button>
                )
              })}
            </div>
          </div>
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
  item, canDelete, onClose, onEdit, onDelete,
}: {
  item: SharedKeymap | null
  canDelete: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [layerIdx, setLayerIdx] = useState(0)

  useEffect(() => {
    if (!item) return
    setLayerIdx(0)
    const layerCount = item.keymap.layers.length
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowRight') { setLayerIdx((i) => (i + 1) % layerCount); return }
      if (e.key === 'ArrowLeft') { setLayerIdx((i) => (i - 1 + layerCount) % layerCount); return }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 0 && n < layerCount) setLayerIdx(n)
    }
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

          <div className="mb-3">
            <DeviceColors keymap={item.keymap} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
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
            <span className="ml-1 text-[0.68rem] font-bold opacity-45">← → か数字キーでも切り替え可</span>
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

        <div className="flex gap-2 border-t-[3px] border-[var(--color-ink)] p-3">
          <button
            type="button"
            className="nb-btn flex-1 !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            onClick={onEdit}
          >
            この配列を編集する
          </button>
          {canDelete && (
            <button
              type="button"
              className="nb-btn shrink-0 !py-2 text-[0.82rem]"
              style={{ background: 'var(--color-pink)' }}
              onClick={onDelete}
            >
              削除
            </button>
          )}
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
