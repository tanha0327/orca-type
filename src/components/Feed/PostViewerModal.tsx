import { useEffect } from 'react'
import type { SharedKeymap } from '../../lib/feed'
import { useFeedStore } from '../../store/feedStore'
import { useKeymapStore } from '../../store/keymapStore'
import { IconLoad, IconTrash } from '../Icons'
import { Avatar, DeviceColors, relativeTime } from './FeedParts'
import { KeymapDiffView } from './KeymapDiff'

/**
 * 投稿を大きく見るモーダル。右上の比較パネルと同じ「大きい盤面 + 残り 7 レイヤー」を広い幅で出す。
 * サイド列が見えないスマホでは、投稿をタップするとこれが開く。
 */
export function PostViewerModal({
  item, canDelete, onClose, onImport, onDelete,
}: {
  item: SharedKeymap | null
  canDelete: boolean
  onClose: () => void
  onImport: () => void
  onDelete: () => void
}) {
  const mine = useKeymapStore((s) => s.keymap)
  const focus = useFeedStore((s) => s.focusLayer)
  const setFocus = useFeedStore((s) => s.setFocusLayer)
  const showMine = useFeedStore((s) => s.showMine)
  const setShowMine = useFeedStore((s) => s.setShowMine)

  useEffect(() => {
    if (!item) return
    const layerCount = item.keymap.layers.length
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      const { focusLayer } = useFeedStore.getState()
      const current = focusLayer < layerCount ? focusLayer : 0
      if (e.key === 'ArrowRight') { setFocus((current + 1) % layerCount); return }
      if (e.key === 'ArrowLeft') { setFocus((current - 1 + layerCount) % layerCount); return }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 0 && n < layerCount) setFocus(n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose, setFocus])

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
        aria-label={item.name}
        className="nb nb-lg flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          <Avatar url={item.avatar_url} name={item.author} size={34} />
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">{item.author} ・ {relativeTime(item.created_at)}</p>
            <h3 className="truncate text-[1.05rem]">{item.name}</h3>
          </div>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {item.description && (
            <p className="mb-2 whitespace-pre-wrap break-words text-[0.82rem] font-bold opacity-80">
              {item.description}
            </p>
          )}
          <div className="mb-3">
            <DeviceColors keymap={item.keymap} />
          </div>

          <KeymapDiffView
            theirs={item.keymap}
            mine={mine}
            focus={focus}
            onFocus={setFocus}
            showMine={showMine}
            onShowMine={setShowMine}
            variant="modal"
          />

          <p className="mt-2 text-[0.68rem] font-bold opacity-50">
            下の小さな盤面を押すとそのレイヤーを大きく表示します（← → か数字キーでも切り替え可）。
            プレビューなので、編集中の配列には反映されません。
          </p>
        </div>

        <div className="flex gap-2 border-t-[3px] border-[var(--color-ink)] p-3">
          <button
            type="button"
            className="nb-btn flex-1 !py-2 text-[0.82rem]"
            style={{ background: 'var(--color-lime)' }}
            onClick={onImport}
          >
            <IconLoad size={16} />
            この配列を読み込む
          </button>
          {canDelete && (
            <button
              type="button"
              className="nb-btn shrink-0 !px-3 !py-2"
              style={{ background: 'var(--color-pink)' }}
              onClick={onDelete}
              aria-label="投稿を削除"
              title="投稿を削除"
            >
              <IconTrash size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
