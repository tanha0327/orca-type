import { useEffect, useState } from 'react'
import { fetchFeed, feedEnabled, shareKeymap, type SharedKeymap } from '../../lib/feed'
import { useKeymapStore } from '../../store/keymapStore'

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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[1.35rem]">みんなの配列</h2>
          <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
            みんなが共有したキーマップを見たり、読み込んだりできます。
          </p>
        </div>
        <button
          type="button"
          className="nb-btn shrink-0 !py-2 text-[0.82rem]"
          style={{ background: 'var(--color-purple)' }}
          onClick={() => setShareOpen((v) => !v)}
        >
          {shareOpen ? '閉じる' : '今の配列を共有する'}
        </button>
      </div>

      {shareOpen && (
        <div className="nb nb-flat mt-3 space-y-3 p-3">
          <label className="block">
            <span className="nb-eyebrow">配列名</span>
            <input
              className="nb-input mt-1"
              value={shareName}
              maxLength={60}
              onChange={(e) => setShareName(e.target.value)}
              placeholder="例: プログラマー向け配列"
            />
          </label>
          <label className="block">
            <span className="nb-eyebrow">あなたの名前</span>
            <input
              className="nb-input mt-1"
              value={authorName}
              maxLength={30}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="例: たなか"
            />
          </label>
          <label className="block">
            <span className="nb-eyebrow">説明（任意）</span>
            <input
              className="nb-input mt-1"
              value={shareDesc}
              maxLength={280}
              onChange={(e) => setShareDesc(e.target.value)}
              placeholder="どんな配列か一言"
            />
          </label>
          <button
            type="button"
            className="nb-btn w-full !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            disabled={!shareName.trim() || !authorName.trim() || sharing}
            onClick={() => void doShare()}
          >
            {sharing ? '共有中…' : '共有する'}
          </button>
        </div>
      )}

      {shareMsg && (
        <p className="nb-chip mt-2" style={{ background: 'var(--color-lime)' }}>{shareMsg}</p>
      )}

      <div className="mt-4 space-y-2">
        {loadError && (
          <p className="text-[0.8rem] font-bold" style={{ color: 'var(--color-pink)' }}>{loadError}</p>
        )}
        {items === null && !loadError && (
          <p className="py-6 text-center text-[0.85rem] font-bold opacity-60">読み込み中…</p>
        )}
        {items?.length === 0 && (
          <p className="py-6 text-center text-[0.85rem] font-bold opacity-60">
            まだ共有された配列がありません
          </p>
        )}
        {items?.map((item) => (
          <div key={item.id} className="nb nb-flat flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-black">{item.name}</p>
              <p className="truncate text-[0.72rem] font-bold opacity-60">
                {item.author} ・ {item.keymap.layers.length} レイヤー ・ {item.keymap.combos.length} コンボ
              </p>
              {item.description && (
                <p className="mt-1 text-[0.76rem] font-bold opacity-80">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              className="nb-btn shrink-0 !py-1.5 text-[0.78rem]"
              onClick={() => doImport(item)}
            >
              読み込む
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
