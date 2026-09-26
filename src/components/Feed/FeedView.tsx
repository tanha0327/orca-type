import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LAYER_COLOR_HEX, type Keymap, type KeymapOs } from '../../data/types'
import {
  classifyKeymap, FEED_CATEGORIES, getCategory, keymapSimilarity, type CategoryId,
} from '../../engine/analyze'
import { errorMessage } from '../../lib/errors'
import {
  deleteComment, deleteKeymap, fetchComments, fetchFeed, fetchFeedExtras, fetchKeymapsByIds, feedEnabled,
  postComment, shareKeymap, toggleLike, type FeedExtras, type KeymapComment, type SharedKeymap,
} from '../../lib/feed'
import { detectOs, getOsTag, OS_TAGS, osOf, withOs } from '../../lib/os'
import { PUBLIC_SITE_URL } from '../../lib/site'
import { fetchXVerifications, type XVerification } from '../../lib/xVerification'
import { useAuthStore } from '../../store/authStore'
import { useFeedStore } from '../../store/feedStore'
import { useFolderStore } from '../../store/folderStore'
import { useKeymapStore } from '../../store/keymapStore'
import { useProfileStore } from '../../store/profileStore'
import { KeyboardView } from '../Board/KeyboardView'
import {
  IconChevronDown, IconChevronUp, IconComment, IconFolder, IconHeart, IconImageSave, IconLoad, IconTrash, IconX,
} from '../Icons'
import { Ring } from '../Ring'
import { XVerifiedBadge } from '../XVerifiedBadge'
import { Avatar, DeviceColors, importSharedKeymap, OsChip, relativeTime } from './FeedParts'
import { SortBar, sortOption } from './FeedSort'
import { FolderBar } from './FolderBar'
import { PostDiff } from './KeymapDiff'
import { PostViewerModal } from './PostViewerModal'
import { SaveToFolderModal } from './SaveToFolderModal'

const EMPTY_EXTRAS: FeedExtras = { likeCounts: {}, likedByMe: new Set(), commentCounts: {} }

/** いいねがこの数以上の投稿は「話題の配列」として 🔥 を付け、新しい順では上にまとめる */
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
  const openProfileEditor = useProfileStore((s) => s.openEditor)
  const myVerification = useProfileStore((s) => s.verification)
  const verificationRevision = useProfileStore((s) => s.verificationRevision)

  const sort = useFeedStore((s) => s.sort)
  const focusLayer = useFeedStore((s) => s.focusLayer)
  const setFocusLayer = useFeedStore((s) => s.setFocusLayer)
  const viewer = useFeedStore((s) => s.viewer)
  const openViewer = useFeedStore((s) => s.openViewer)
  const folderSort = useFeedStore((s) => s.folderSort)
  const folder = useFeedStore((s) => s.folder)
  const setFolder = useFeedStore((s) => s.setFolder)
  const osFilter = useFeedStore((s) => s.osFilter)
  const setOsFilter = useFeedStore((s) => s.setOsFilter)

  const folders = useFolderStore((s) => s.folders)
  const foldersLoaded = useFolderStore((s) => s.loaded)
  const itemsByFolder = useFolderStore((s) => s.itemsByFolder)
  const moveInFolder = useFolderStore((s) => s.move)
  const forgetKeymap = useFolderStore((s) => s.forgetKeymap)

  const [items, setItems] = useState<SharedKeymap[] | null>(null)
  /** タイムラインのページに入っていないが、自分のフォルダに入っている投稿 */
  const [extraPosts, setExtraPosts] = useState<SharedKeymap[]>([])
  const [extras, setExtras] = useState<FeedExtras>(EMPTY_EXTRAS)
  const [verifications, setVerifications] = useState<Record<string, XVerification>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rankFallback, setRankFallback] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareName, setShareName] = useState('')
  const [shareDesc, setShareDesc] = useState('')
  /** null のあいだは自動判定のカテゴリで投稿する */
  const [shareCategory, setShareCategory] = useState<CategoryId | null>(null)
  /** 投稿に付ける OS のタグ。null なら付けない */
  const [shareOs, setShareOs] = useState<KeymapOs | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [commentItem, setCommentItem] = useState<SharedKeymap | null>(null)
  const [saveItem, setSaveItem] = useState<SharedKeymap | null>(null)

  // 並び順をすばやく切り替えたとき、古いほうの応答で一覧を上書きしないようにする
  const loadSeq = useRef(0)
  const extraRef = useRef<SharedKeymap[]>([])
  extraRef.current = extraPosts
  /** 取りに行ったことのあるフォルダ内の投稿の ID（消えた投稿を何度も取りに行かないように） */
  const requestedExtra = useRef(new Set<string>())

  const load = async () => {
    const seq = ++loadSeq.current
    setLoadError(null)
    try {
      const page = await fetchFeed(sort)
      if (seq !== loadSeq.current) return
      setItems(page.items)
      setRankFallback(page.rankFallback)
      // いいね・コメントのテーブルがまだ無い環境でも、配列一覧そのものは出したままにする
      // （フォルダから補った投稿の分も取り直す）
      try {
        const ids = [...page.items, ...extraRef.current].map((r) => r.id)
        const next = await fetchFeedExtras(ids, user?.id ?? null)
        if (seq === loadSeq.current) setExtras(next)
      } catch {
        if (seq === loadSeq.current) setExtras(EMPTY_EXTRAS)
      }
    } catch (e) {
      if (seq === loadSeq.current) setLoadError(`読み込みに失敗しました: ${errorMessage(e)}`)
    }
  }

  useEffect(() => { void load() }, [user?.id, sort])

  // 投稿者の X 本人確認バッジ。自分が連携・解除したとき（verificationRevision）も取り直す
  useEffect(() => {
    if (!items) return
    let cancelled = false
    const userIds = [...items, ...extraPosts].flatMap((i) => (i.user_id ? [i.user_id] : []))
    fetchXVerifications(userIds)
      .then((v) => { if (!cancelled) setVerifications(v) })
      // 本人確認のテーブルがまだ無い環境でも、一覧はそのまま出す（バッジが出ないだけ）
      .catch(() => { if (!cancelled) setVerifications({}) })
    return () => { cancelled = true }
  }, [items, extraPosts, verificationRevision])

  // 自分のフォルダに、タイムラインのページに入っていない投稿があれば取ってくる
  useEffect(() => {
    if (!items) return
    const known = new Set([...items, ...extraPosts].map((i) => i.id))
    const missing = Object.values(itemsByFolder)
      .flat()
      .map((it) => it.keymapId)
      .filter((id) => !known.has(id) && !requestedExtra.current.has(id))
    if (missing.length === 0) return
    const ids = [...new Set(missing)]
    for (const id of ids) requestedExtra.current.add(id)
    void (async () => {
      try {
        const rows = await fetchKeymapsByIds(ids)
        if (rows.length === 0) return
        setExtraPosts((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))])
        const more = await fetchFeedExtras(rows.map((r) => r.id), user?.id ?? null).catch(() => EMPTY_EXTRAS)
        setExtras((prev) => mergeExtras(prev, more))
      } catch {
        // 取れなかった投稿はフォルダの件数にだけ残り、一覧には出ない
      }
    })()
  }, [items, extraPosts, itemsByFolder, user?.id])

  // ログアウトしたり、開いていた自分のフォルダが無くなったりしたら「すべて」に戻す
  useEffect(() => {
    if (folder.kind !== 'mine') return
    if (!user || (foldersLoaded && !folders.some((f) => f.id === folder.folderId))) setFolder({ kind: 'all' })
  }, [user, folder, folders, foldersLoaded, setFolder])

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

  const byId = useMemo(() => {
    const map = new Map<string, SharedKeymap>()
    for (const it of [...(items ?? []), ...extraPosts]) map.set(it.id, it)
    return map
  }, [items, extraPosts])

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

  const matchesOs = useCallback(
    (it: SharedKeymap) => osFilter === 'all' || osOf(it.keymap) === osFilter,
    [osFilter],
  )

  const osCounts = useMemo(() => {
    const counts: { all: number } & Partial<Record<KeymapOs, number>> = { all: items?.length ?? 0 }
    for (const it of items ?? []) {
      const os = osOf(it.keymap)
      if (os) counts[os] = (counts[os] ?? 0) + 1
    }
    return counts
  }, [items])

  /** タイムラインのうち、OS の絞り込みに合う投稿 */
  const osItems = useMemo(() => items?.filter(matchesOs) ?? null, [items, matchesOs])

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CategoryId, number>> = {}
    for (const it of osItems ?? []) {
      const c = categoryOf.get(it.id) ?? 'standard'
      counts[c] = (counts[c] ?? 0) + 1
    }
    return counts
  }, [osItems, categoryOf])

  const likeCountOf = (id: string) => extras.likeCounts[id] ?? 0
  const isBuzz = (id: string) => likeCountOf(id) >= BUZZ_LIKE_THRESHOLD
  const inFolder = folder.kind === 'mine'
  const activeSort = inFolder ? folderSort : sort

  /**
   * いま見ているフォルダの投稿を、選んでいる並び順で。
   * タイムライン（すべて・カテゴリ）はサーバーが並べた順をそのまま使い、近い順だけここで並べる
   */
  const visible = useMemo(() => {
    if (!items || !osItems) return null
    if (folder.kind === 'mine') {
      const list = [...(itemsByFolder[folder.folderId] ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((it) => byId.get(it.keymapId))
        .filter((it): it is SharedKeymap => !!it && matchesOs(it))
      switch (folderSort) {
        case 'manual': return list
        case 'new': return [...list].sort(byNewest)
        case 'old': return [...list].sort((a, b) => byNewest(b, a))
        case 'popular': return [...list].sort((a, b) => likeCountOf(b.id) - likeCountOf(a.id) || byNewest(a, b))
        case 'similar': return [...list].sort((a, b) => (similarityOf.get(b.id) ?? 0) - (similarityOf.get(a.id) ?? 0))
      }
    }
    const list = folder.kind === 'category' ? osItems.filter((it) => categoryOf.get(it.id) === folder.id) : osItems
    if (sort === 'similar') {
      return [...list].sort((a, b) => (similarityOf.get(b.id) ?? 0) - (similarityOf.get(a.id) ?? 0) || byNewest(a, b))
    }
    return list
  }, [items, osItems, matchesOs, folder, sort, folderSort, itemsByFolder, byId, categoryOf, similarityOf, extras.likeCounts])

  // 新しい順のときだけ、バズった投稿を「話題の配列」として先にまとめる
  const buzzSection = activeSort === 'new' ? (visible ?? []).filter((it) => isBuzz(it.id)) : []
  const restSection = activeSort === 'new' ? (visible ?? []).filter((it) => !isBuzz(it.id)) : (visible ?? [])

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

  const current = sortOption(activeSort)
  const autoCategory = classifyKeymap(keymap)

  const flashMsg = (text: string) => {
    setShareMsg(text)
    window.setTimeout(() => setShareMsg((cur) => (cur === text ? null : cur)), 4000)
  }

  const openShare = () => {
    if (!user) { openLoginModal(); return }
    setShareCategory(null)
    // 今使っているパソコンの OS を初期値にする（スマホなどで分からなければ、読み込んだ配列のタグ）
    setShareOs(detectOs() ?? osOf(keymap))
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
        keymap: withOs(keymap, shareOs),
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
      setExtraPosts((prev) => prev.filter((i) => i.id !== item.id))
      forgetKeymap(item.id)
      if (commentItem?.id === item.id) setCommentItem(null)
      if (saveItem?.id === item.id) setSaveItem(null)
      if (useFeedStore.getState().viewer?.id === item.id) openViewer(null)
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
      myKeymap={keymap}
      focusLayer={focusLayer}
      onFocusLayer={setFocusLayer}
      canDelete={!!user && user.id === item.user_id}
      verification={item.user_id ? verifications[item.user_id] ?? null : null}
      likeCount={likeCountOf(item.id)}
      liked={extras.likedByMe.has(item.id)}
      commentCount={extras.commentCounts[item.id] ?? 0}
      category={categoryOf.get(item.id) ?? 'standard'}
      similarity={similarityOf.get(item.id) ?? 0}
      isNew={Date.now() - Date.parse(item.created_at) < NEW_BADGE_MS}
      isBuzz={isBuzz(item.id)}
      saved={savedIds.has(item.id)}
      // OS で絞り込んでいると隠れた投稿と入れ替わって見た目が動かないことがあるので、手動の並べ替えは絞り込みなしのときだけ
      reorder={inFolder && folderSort === 'manual' && osFilter === 'all'
        ? {
          canUp: index > 0,
          canDown: index < list.length - 1,
          onUp: () => void doMove(item, -1),
          onDown: () => void doMove(item, 1),
        }
        : undefined}
      onOpen={() => openViewer(item)}
      onImport={() => importSharedKeymap(item)}
      onLike={() => void doToggleLike(item)}
      onComments={() => setCommentItem(item)}
      onSave={() => doSave(item)}
      onDelete={() => void doDeletePost(item)}
    />
  )

  return (
    <section className="nb nb-lg overflow-hidden">
      <div className="flex items-end gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.35rem]">みんなの配列</h2>
          <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
            みんなが共有したキーマップのタイムライン。あなたの配列と違うキーがピンクで表示されます。
            気に入った配列は自分のフォルダに保存できます。
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
        onOpen={openShare}
      />

      {items !== null && items.length > 0 && (
        <FolderBar
          folder={folder}
          onFolder={setFolder}
          osFilter={osFilter}
          onOsFilter={setOsFilter}
          osCounts={osCounts}
          allCount={osItems?.length ?? 0}
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
          {osFilter !== 'all'
            ? `${getOsTag(osFilter).label} のタグが付いた投稿は、このフォルダにはまだありません。`
            : folder.kind === 'mine'
              ? 'このフォルダはまだ空です。投稿のフォルダのボタンから追加できます。'
              : 'このフォルダには、いま読み込んでいる投稿の中に当てはまるものがありません。'}
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
        os={shareOs}
        onOs={setShareOs}
        sharing={sharing}
        onSubmit={() => void doShare()}
        shareMsg={shareMsg}
        profile={profile}
        verification={myVerification}
        onOpenProfile={() => { setShareOpen(false); openProfileEditor() }}
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

      <PostViewerModal
        item={viewer}
        verification={viewer?.user_id ? verifications[viewer.user_id] ?? null : null}
        canDelete={!!user && !!viewer && user.id === viewer.user_id}
        onClose={closeViewer}
        onImport={() => { if (viewer) importSharedKeymap(viewer) }}
        onDelete={() => { if (viewer) void doDeletePost(viewer) }}
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

/** 自分のフォルダを手動の並び順で見ているときの ↑ ↓ */
interface ReorderControls {
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
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

/** 自分の配列との一致度（全レイヤーの要約）。かなり近いものは目立たせる */
function SimilarityChip({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <span
      className="nb-chip"
      style={{ background: pct >= 80 ? 'var(--color-lime)' : pct >= 50 ? 'var(--color-cyan)' : 'var(--color-paper)' }}
      title="全レイヤーの単押し・長押しとコンボを比べた一致度（近い順の基準）"
    >
      あなたと {pct}% 一致
    </span>
  )
}

function PostCard({
  item, myKeymap, focusLayer, onFocusLayer, canDelete, verification, likeCount, liked, commentCount,
  category, similarity, isNew, isBuzz, saved, reorder,
  onOpen, onImport, onLike, onComments, onSave, onDelete,
}: {
  item: SharedKeymap
  /** 比べる基準（編集中の自分の配列） */
  myKeymap: Keymap
  /** 大きい盤面に出すレイヤー（全部の投稿で共通） */
  focusLayer: number
  onFocusLayer: (n: number) => void
  canDelete: boolean
  /** 投稿者が X で本人確認済みなら、その情報（バッジに出す） */
  verification: XVerification | null
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
  /** 投稿を大きく見るモーダルを開く */
  onOpen: () => void
  onImport: () => void
  onLike: () => void
  onComments: () => void
  onSave: () => void
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
  // 普通の <a target="_blank"> によるリンク遷移にする（これはブロックされない）。
  // テスト用のサイトから押しても、ポストには本番の URL を載せる
  const shareXHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `『${item.name}』（${item.author}さん・${item.keymap.layers.length}レイヤー）を Orca echo で共有中 #Orcaecho`,
  )}&url=${encodeURIComponent(PUBLIC_SITE_URL)}`

  return (
    <article className="relative border-b-[3px] border-[var(--color-ink)] p-3">
      {reorder && (
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            type="button"
            className="nb-btn !h-8 !w-8 !p-0"
            aria-label="上へ"
            title="上へ"
            disabled={!reorder.canUp}
            onClick={reorder.onUp}
          >
            <IconChevronUp size={16} />
          </button>
          <button
            type="button"
            className="nb-btn !h-8 !w-8 !p-0"
            aria-label="下へ"
            title="下へ"
            disabled={!reorder.canDown}
            onClick={reorder.onDown}
          >
            <IconChevronDown size={16} />
          </button>
        </div>
      )}
      <div className="flex gap-3">
        <Avatar url={item.avatar_url} name={item.author} size={40} />

        <div className={`min-w-0 flex-1 ${reorder ? 'pr-11' : ''}`}>
          {/* 本人確認バッジは X へのリンクなので、投稿を開くボタンの外に置く（ボタンの中にリンクは入れられない） */}
          <div className="flex min-w-0 items-center gap-1.5">
            <button type="button" className="min-w-0 truncate text-left text-[0.85rem] font-black" onClick={onOpen}>
              {item.author}
            </button>
            {verification && <XVerifiedBadge verification={verification} className="shrink" />}
            <span className="shrink-0 text-[0.72rem] font-bold opacity-50">・ {relativeTime(item.created_at)}</span>
          </div>

          <button type="button" className="block w-full text-left" onClick={onOpen}>
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

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <OsChip keymap={item.keymap} />
            <CategoryChip id={category} />
            <SimilarityChip value={similarity} />
          </div>

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
              <div className="flex items-center gap-1.5">
                <p className="text-[0.85rem] font-black">{item.author}</p>
                {verification && <XVerifiedBadge verification={verification} link={false} />}
              </div>
              <p className="mt-0.5 text-[0.95rem] font-black">{item.name}</p>
              {item.description && (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.82rem] font-bold opacity-80">
                  {item.description}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <OsChip keymap={item.keymap} />
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

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
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
        <ActionButton
          label={saved ? 'フォルダに保存済み（入れるフォルダを変える）' : 'フォルダに保存'}
          pressed={saved}
          tone={saved ? 'var(--color-sand)' : undefined}
          onClick={onSave}
        >
          <IconFolder filled={saved} />
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
  open, onClose, shareName, onShareName, shareDesc, onShareDesc, autoCategory, category, onCategory, os, onOs,
  sharing, onSubmit, shareMsg, profile, verification, onOpenProfile, onRequireLogin,
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
  /** 投稿に付ける OS のタグ。null なら付けない */
  os: KeymapOs | null
  onOs: (os: KeymapOs | null) => void
  sharing: boolean
  onSubmit: () => void
  shareMsg: string | null
  profile: { name: string; avatarUrl: string | null } | null
  verification: XVerification | null
  onOpenProfile: () => void
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
                  {verification
                    ? <XVerifiedBadge verification={verification} className="shrink" />
                    : <span className="nb-chip shrink-0" style={{ background: 'var(--color-lime)' }}>ログイン中</span>}
                </div>
                {!verification && (
                  <p className="mt-1 text-[0.7rem] font-bold opacity-60">
                    <button type="button" className="underline" onClick={onOpenProfile}>プロフィール</button>
                    から X のポストで本人確認すると、投稿に本人確認バッジが付きます。
                  </p>
                )}
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
          <div>
            <span className="nb-eyebrow">OS</span>
            <p className="mt-0.5 text-[0.7rem] font-bold opacity-60">
              どの OS で使っている配列か。みんなの配列で OS ごとに絞り込めるようになります。
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="投稿の OS">
              {[...OS_TAGS.map((t) => ({ id: t.id as KeymapOs | null, label: `${t.emoji} ${t.label}`, help: t.help })),
                { id: null, label: '指定しない', help: 'OS のタグを付けずに投稿する' }].map((o) => {
                const selected = os === o.id
                return (
                  <button
                    key={o.id ?? 'none'}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={o.help}
                    className="nb-chip"
                    style={{
                      background: selected ? 'var(--color-lime)' : 'var(--color-paper)',
                      opacity: selected ? 1 : 0.6,
                      cursor: 'pointer',
                    }}
                    onClick={() => onOs(o.id)}
                  >
                    {o.label}
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
  const verificationRevision = useProfileStore((s) => s.verificationRevision)

  const [comments, setComments] = useState<KeymapComment[] | null>(null)
  const [verifications, setVerifications] = useState<Record<string, XVerification>>({})
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

  useEffect(() => {
    if (!comments) return
    let cancelled = false
    fetchXVerifications(comments.map((c) => c.user_id))
      .then((v) => { if (!cancelled) setVerifications(v) })
      .catch(() => { if (!cancelled) setVerifications({}) })
    return () => { cancelled = true }
  }, [comments, verificationRevision])

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
                <p className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[0.8rem] font-black">{c.author_name}</span>
                  {verifications[c.user_id] && (
                    <XVerifiedBadge verification={verifications[c.user_id]} className="shrink" />
                  )}
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
