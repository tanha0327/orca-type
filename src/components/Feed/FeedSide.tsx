import { useKeymapStore } from '../../store/keymapStore'
import { useFeedStore } from '../../store/feedStore'
import { IconExpand, IconLoad } from '../Icons'
import { Ring } from '../Ring'
import { Avatar, importSharedKeymap, relativeTime } from './FeedParts'
import { SortPanel } from './FeedSort'
import { KeymapDiffView } from './KeymapDiff'

/**
 * 「みんなの配列」のときのサイド列。
 * 上: えらんだ配列を常に置いておき、あなたの配列と違うキーを色で見せる比較パネル
 * 下: タイムラインの並び替え
 */
export function FeedSide() {
  return (
    <>
      <div className="nb nb-lg min-h-[22rem] overflow-hidden lg:min-h-0 lg:flex-1">
        <ComparePanel />
      </div>
      <div className="shrink-0">
        <SortPanel />
      </div>
    </>
  )
}

function ComparePanel() {
  const pinned = useFeedStore((s) => s.pinned)
  const pinnedId = useFeedStore((s) => s.pinnedId)
  const feedStatus = useFeedStore((s) => s.feedStatus)
  const focus = useFeedStore((s) => s.focusLayer)
  const setFocus = useFeedStore((s) => s.setFocusLayer)
  const showMine = useFeedStore((s) => s.showMine)
  const setShowMine = useFeedStore((s) => s.setShowMine)
  const openViewer = useFeedStore((s) => s.openViewer)
  const mine = useKeymapStore((s) => s.keymap)

  // タイムラインの読み込み中か、前に選んだ投稿を取り直している間
  if (!pinned && (feedStatus === 'loading' || (feedStatus === 'ready' && pinnedId))) {
    return (
      <p className="flex h-full items-center justify-center gap-2 p-5 text-[0.85rem] font-bold opacity-60">
        <Ring size={15} />
        読み込み中…
      </p>
    )
  }

  if (!pinned) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
        <p className="nb-eyebrow">COMPARE</p>
        <h3 className="text-[1.05rem]">えらんだ配列がここに出ます</h3>
        <p className="text-[0.76rem] font-bold leading-relaxed opacity-65">
          タイムラインの投稿をクリックすると、その配列を右上に置いたまま、
          あなたの配列と違うキーを色つきで見比べられます。
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
        style={{ background: 'var(--color-purple)' }}
      >
        <Avatar url={pinned.avatar_url} name={pinned.author} size={34} />
        <div className="min-w-0 flex-1">
          <p className="nb-eyebrow !opacity-80">えらんだ配列 ⇄ あなたの配列</p>
          <h3 className="truncate text-[1.05rem]">{pinned.name}</h3>
          <p className="truncate text-[0.7rem] font-bold opacity-80">
            {pinned.author} ・ {relativeTime(pinned.created_at)}
          </p>
        </div>
        <button
          type="button"
          className="nb-btn shrink-0 !h-9 !w-9 !p-0"
          onClick={() => openViewer(pinned)}
          aria-label="大きく見る"
          title="大きく見る"
        >
          <IconExpand size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <KeymapDiffView
          theirs={pinned.keymap}
          mine={mine}
          focus={focus}
          onFocus={setFocus}
          showMine={showMine}
          onShowMine={setShowMine}
          variant="panel"
        />
      </div>

      <div className="border-t-[3px] border-[var(--color-ink)] p-2.5">
        <button
          type="button"
          className="nb-btn w-full !py-2 text-[0.82rem]"
          style={{ background: 'var(--color-lime)' }}
          onClick={() => importSharedKeymap(pinned)}
        >
          <IconLoad size={16} />
          この配列を読み込む
        </button>
      </div>
    </div>
  )
}
