import { useEffect, useMemo, useState } from 'react'
import { KEYS, type KeyId } from '../../data/layout'
import { LAYER_COLOR_HEX, type Keymap } from '../../data/types'
import { resolveKey } from '../../engine/resolve'
import { fetchFeed, feedEnabled, shareKeymap, type SharedKeymap } from '../../lib/feed'
import { useKeymapStore } from '../../store/keymapStore'
import { KeyboardView } from '../Board/KeyboardView'

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

export function FeedView() {
  const keymap = useKeymapStore((s) => s.keymap)
  const importKeymap = useKeymapStore((s) => s.importKeymap)
  const setView = useKeymapStore((s) => s.setView)
  const authorName = useKeymapStore((s) => s.authorName)
  const setAuthorName = useKeymapStore((s) => s.setAuthorName)

  const [items, setItems] = useState<SharedKeymap[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareName, setShareName] = useState('')
  const [shareDesc, setShareDesc] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [compareItem, setCompareItem] = useState<SharedKeymap | null>(null)

  const load = async () => {
    setLoadError(null)
    try {
      setItems(await fetchFeed())
    } catch (e) {
      setLoadError(`読み込みに失敗しました: ${errorMessage(e)}`)
    }
  }

  useEffect(() => { void load() }, [])

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

  const doShare = async () => {
    if (!shareName.trim() || !authorName.trim()) return
    setSharing(true)
    try {
      await shareKeymap({
        name: shareName.trim(),
        author: authorName.trim(),
        description: shareDesc.trim(),
        keymap,
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

  return (
    <section className="nb nb-lg p-4">
      <div>
        <h2 className="text-[1.35rem]">みんなの配列</h2>
        <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
          みんなが共有したキーマップを見たり、読み込んだりできます。
          カードにマウスを乗せると、上位 3 レイヤーをチラ見できます。
        </p>
      </div>

      {shareMsg && (
        <p className="nb-chip mt-3" style={{ background: 'var(--color-lime)' }}>{shareMsg}</p>
      )}
      {loadError && (
        <p className="mt-3 text-[0.8rem] font-bold" style={{ color: 'var(--color-pink)' }}>{loadError}</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items?.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            onImport={() => doImport(item)}
            onCompare={() => setCompareItem(item)}
          />
        ))}
        <AddTile onClick={() => setShareOpen(true)} />
      </div>

      {items === null && !loadError && (
        <p className="py-6 text-center text-[0.85rem] font-bold opacity-60">読み込み中…</p>
      )}
      {items?.length === 0 && (
        <p className="py-6 text-center text-[0.85rem] font-bold opacity-60">
          まだ共有された配列がありません。「＋」から最初の 1 つを投稿してみてください。
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
    </section>
  )
}

function AddTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nb flex min-h-[9rem] flex-col items-center justify-center gap-1.5 p-4 text-center"
      style={{ background: 'transparent', borderStyle: 'dashed' }}
    >
      <span className="text-[1.8rem] leading-none">＋</span>
      <span className="text-[0.85rem] font-black">今の配列を投稿する</span>
    </button>
  )
}

function FeedCard({
  item, onImport, onCompare,
}: {
  item: SharedKeymap
  onImport: () => void
  onCompare: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const peekLayers = item.keymap.layers.slice(0, 3)

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="nb nb-flat flex h-full min-h-[9rem] flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] font-black">{item.name}</p>
          <p className="truncate text-[0.72rem] font-bold opacity-60">
            {item.author} ・ {item.keymap.layers.length} レイヤー ・ {item.keymap.combos.length} コンボ
          </p>
        </div>
        {item.description && (
          <p className="line-clamp-3 text-[0.76rem] font-bold opacity-80">{item.description}</p>
        )}
        <span className="flex-1" />
        <div className="flex gap-1.5">
          <button type="button" className="nb-btn flex-1 !py-1.5 text-[0.78rem]" onClick={onCompare}>
            比較する
          </button>
          <button
            type="button"
            className="nb-btn flex-1 !py-1.5 text-[0.78rem]"
            style={{ background: 'var(--color-lime)' }}
            onClick={onImport}
          >
            読み込む
          </button>
        </div>
      </div>

      {hovered && peekLayers.length > 0 && (
        <div
          className="nb nb-lg absolute left-1/2 top-full z-20 mt-2 w-[19rem] max-w-[85vw] -translate-x-1/2 space-y-2 p-3"
          style={{ background: 'var(--color-paper)' }}
        >
          <p className="nb-eyebrow">上位 3 レイヤーをチラ見</p>
          {peekLayers.map((layer, i) => (
            <div key={layer.id}>
              <span
                className="nb-chip mb-1"
                style={{ background: LAYER_COLOR_HEX[layer.color] }}
              >
                L{layer.id} {layer.name}
              </span>
              <KeyboardView interactive={false} compact previewKeymap={item.keymap} previewLayer={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShareModal({
  open, onClose, shareName, onShareName, authorName, onAuthorName,
  shareDesc, onShareDesc, sharing, onSubmit, shareMsg,
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
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSubmit = !!shareName.trim() && !!authorName.trim() && !sharing

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
            className="nb-btn w-full !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
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
