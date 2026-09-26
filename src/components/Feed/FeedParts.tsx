import {
  BODY_COLOR_LABEL, TRACKBALL_COLOR_GRADIENT, TRACKBALL_COLOR_LABEL,
  type BodyColor, type Keymap, type TrackballColor,
} from '../../data/types'
import { hasBall, keyboardOf } from '../../keyboards/registry'
import type { SharedKeymap } from '../../lib/feed'
import { getOsTag, osOf } from '../../lib/os'
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

/**
 * 共有された配列を編集画面に読み込む（今の内容は上書きされるので確認を挟む）。
 * 別のキーボードの配列なら、編集するキーボードが切り替わる（いまのキーマップは保存しておく）
 */
export function importSharedKeymap(item: SharedKeymap) {
  const { importKeymap, setView, keymap } = useKeymapStore.getState()
  const message = item.keymap.keyboard === keymap.keyboard
    ? `「${item.name}」を読み込みますか？ 今編集中の内容は上書きされます。`
    : `「${item.name}」は ${keyboardOf(item.keymap).name} の配列です。読み込むと編集するキーボードが切り替わります（いまのキーマップは保存しておきます）。読み込みますか？`
  if (!confirm(message)) return
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

/** 投稿主のキーボードと、設定した本体色・トラックボール色をまとめて表示する */
export function DeviceColors({ keymap }: { keymap: Keymap }) {
  const def = keyboardOf(keymap)
  const bodyColor = keymap.settings.bodyColor ?? 'white'
  const ballColor = keymap.trackball.color ?? 'white'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="nb-chip" style={{ background: 'var(--color-sand)' }}>
        ⌨ {def.name}
      </span>
      <span className="nb-chip flex items-center gap-1.5" style={{ background: 'var(--color-paper)' }}>
        <ColorDot color={bodyColor} />
        本体: {BODY_COLOR_LABEL[bodyColor]}
      </span>
      {hasBall(def) && (
        <span className="nb-chip flex items-center gap-1.5" style={{ background: 'var(--color-paper)' }}>
          <ColorDot color={ballColor} />
          ボール: {TRACKBALL_COLOR_LABEL[ballColor]}
        </span>
      )}
    </div>
  )
}

/** 投稿の OS タグ（🍎 Mac / 🪟 Windows）。タグの無い投稿では何も出さない */
export function OsChip({ keymap }: { keymap: Keymap }) {
  const os = osOf(keymap)
  if (!os) return null
  const tag = getOsTag(os)
  return (
    <span
      className="nb-chip"
      style={{ background: os === 'mac' ? 'var(--color-sand)' : 'var(--color-cyan)' }}
      title={tag.help}
    >
      {tag.emoji} {tag.label}
    </span>
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
