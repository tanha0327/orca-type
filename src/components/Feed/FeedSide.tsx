import { LAYER_COLOR_HEX } from '../../data/types'
import { useFeedStore } from '../../store/feedStore'
import { useKeymapStore } from '../../store/keymapStore'
import { KeyboardView } from '../Board/KeyboardView'
import { SortPanel } from './FeedSort'

/**
 * 「みんなの配列」のときのサイド列。
 * 上: 比べる基準になる、あなたの（編集中の）配列を常に置いておく
 * 下: タイムラインの並び替え
 */
export function FeedSide() {
  return (
    <>
      <div className="nb nb-lg shrink-0 overflow-hidden">
        <MyKeymapPanel />
      </div>
      <div className="shrink-0">
        <SortPanel />
      </div>
    </>
  )
}

/** あなたの配列。投稿の盤面と同じレイヤーを出すので、ピンクのキーに自分が何を置いているかをすぐ確かめられる */
function MyKeymapPanel() {
  const mine = useKeymapStore((s) => s.keymap)
  const setView = useKeymapStore((s) => s.setView)
  const focusLayer = useFeedStore((s) => s.focusLayer)
  const setFocusLayer = useFeedStore((s) => s.setFocusLayer)
  const focus = focusLayer < mine.layers.length ? focusLayer : 0

  return (
    <div>
      <header
        className="flex items-center gap-2 p-3"
        style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="nb-eyebrow !opacity-60">くらべる基準</p>
          <h3 className="text-[1.05rem]">あなたの配列</h3>
          <p className="truncate text-[0.68rem] font-bold opacity-60">{mine.name}（編集中の配列）</p>
        </div>
        <button
          type="button"
          className="nb-btn shrink-0 !py-1.5 text-[0.76rem]"
          style={{ color: 'var(--color-ink)' }}
          onClick={() => setView('edit')}
        >
          編集する
        </button>
      </header>

      <div className="space-y-2.5 p-3">
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="見比べるレイヤー">
          {mine.layers.map((layer, i) => {
            const active = i === focus
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => setFocusLayer(i)}
                aria-pressed={active}
                title={`L${i} ${layer.name} で見比べる`}
                className="flex min-w-0 items-center gap-1 rounded-[8px] border-2 border-[var(--color-ink)] px-1.5 py-1 text-left text-[0.62rem] font-black"
                style={{
                  background: active ? LAYER_COLOR_HEX[layer.color] : 'var(--color-paper)',
                  boxShadow: active ? 'none' : '2px 2px 0 var(--color-ink)',
                  transform: active ? 'translate(2px, 2px)' : undefined,
                }}
              >
                <span className="shrink-0 font-mono">L{i}</span>
                <span className="min-w-0 truncate opacity-75">{layer.name}</span>
              </button>
            )
          })}
        </div>

        <KeyboardView interactive={false} compact previewKeymap={mine} previewLayer={focus} />

        <p className="flex items-start gap-1.5 text-[0.66rem] font-bold leading-snug opacity-70">
          <span
            className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: 'var(--color-pink)', border: '1.5px solid var(--color-ink)' }}
          />
          タイムラインの投稿では、この配列と違うキーがピンクになります。
          投稿の小さな盤面かこのタブを押すと、全部の投稿がそのレイヤーに切り替わります。
        </p>
      </div>
    </div>
  )
}
