import {
  BODY_COLOR_LABEL, TRACKBALL_COLOR_GRADIENT, TRACKBALL_COLOR_LABEL,
  type BodyColor, type Keymap, type TrackballColor,
} from '../../data/types'
import type { SharedKeymap } from '../../lib/feed'
import { useKeymapStore } from '../../store/keymapStore'

/* タイムライン・右上の比較パネル・拡大モーダルで共通に使う部品 */

/** Twitter のタイムラインのような相対時刻表示（1週間を超えたら日付） */
export function relativeTime(iso: string): string {
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

/** 共有された配列を編集画面に読み込む（今の内容は上書きされるので確認を挟む） */
export function importSharedKeymap(item: SharedKeymap) {
  if (!confirm(`「${item.name}」を読み込みますか？ 今編集中の内容は上書きされます。`)) return
  const { importKeymap, setView } = useKeymapStore.getState()
  importKeymap(item.keymap)
  setView('edit')
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
export function DeviceColors({ keymap }: { keymap: Keymap }) {
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

export function Avatar({ url, name, size = 22 }: { url: string | null; name: string; size?: number }) {
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
