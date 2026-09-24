import { useMemo } from 'react'
import { halfExtent, KEYS, SENSORS, type Half, type KeyId } from '../../data/layout'
import { isModTap, isTrans, LAYER_COLOR_HEX, type Binding, type Keymap, type Layer } from '../../data/types'
import { resolveKey } from '../../engine/resolve'
import { SM_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { KeyboardView } from '../Board/KeyboardView'

/* ================================================================
   2 つの配列の「キー配置の違い」を色で見せる部品
   - 大きい盤面: 注目しているレイヤーを印字つきで。違うキーはピンク
   - ミニキーマップ: 残りのレイヤーを印字なしで。違うキーだけ色を塗る
   ================================================================ */

const holdOf = (b: Binding) => (isModTap(b) ? b.hold : undefined)

/**
 * 2 つのキーマップで、指定レイヤーを有効にしたときの割当（単押し・長押し）が違うキーの ID 集合。
 * L1 以降は、どちらもそのレイヤーでは素通し（透過）のキーは数えない。
 * 数えると L0 の違いが全レイヤーに写り込み、そのレイヤーならではの違いが埋もれてしまう。
 */
export function diffKeysForLayer(a: Keymap, b: Keymap, layerIndex: number): Set<KeyId> {
  const stack = layerIndex === 0 ? [0] : [0, layerIndex]
  const diffs = new Set<KeyId>()
  for (const k of KEYS) {
    if (
      layerIndex !== 0
      && isTrans(a.layers[layerIndex]?.keys[k.id])
      && isTrans(b.layers[layerIndex]?.keys[k.id])
    ) continue
    const ra = resolveKey(a, stack, k.id).binding
    const rb = resolveKey(b, stack, k.id).binding
    if (ra.tap !== rb.tap || holdOf(ra) !== holdOf(rb)) diffs.add(k.id)
  }
  return diffs
}

/** 投稿の各レイヤーについて、自分の配列と違うキーの集合 */
export function useLayerDiffs(mine: Keymap, theirs: Keymap): Set<KeyId>[] {
  return useMemo(
    () => theirs.layers.map((_, i) => diffKeysForLayer(mine, theirs, i)),
    [mine, theirs],
  )
}

/** ミニキーマップのキー同士のすき間（ユニット） */
const MINI_GAP = 0.16

const HALVES = (['L', 'R'] as const satisfies readonly Half[]).map((half) => ({
  half,
  ext: halfExtent(half),
  keys: KEYS.filter((k) => k.half === half),
  sensors: SENSORS.filter((s) => s.half === half),
}))

const pct = (v: number, total: number) => `${(v / total) * 100}%`

/**
 * 印字を省いた小さな盤面。違うキーだけピンクで塗り、他はうすい枠だけにする。
 * センサー（パッド・ホイール・ボール）は形の目印として点線で添える。
 */
export function DiffMiniMap({ diffKeys }: { diffKeys: ReadonlySet<KeyId> }) {
  return (
    <div className="flex w-full items-start gap-[6%]" aria-hidden>
      {HALVES.map(({ half, ext, keys, sensors }) => (
        <div
          key={half}
          className="relative min-w-0 flex-1"
          style={{ aspectRatio: `${ext.w} / ${ext.h}` }}
        >
          {sensors.map((s) => (
            <span
              key={s.id}
              className="absolute"
              style={{
                left: pct(s.x + MINI_GAP / 2, ext.w),
                top: pct(s.y + MINI_GAP / 2, ext.h),
                width: pct(s.w - MINI_GAP, ext.w),
                height: pct(s.h - MINI_GAP, ext.h),
                border: '1px dashed color-mix(in srgb, var(--color-ink) 30%, transparent)',
                borderRadius: s.kind === 'ball' ? '50%' : 2,
              }}
            />
          ))}
          {keys.map((k) => {
            const diff = diffKeys.has(k.id)
            return (
              <span
                key={k.id}
                className="absolute"
                style={{
                  left: pct(k.x + MINI_GAP / 2, ext.w),
                  top: pct(k.y + MINI_GAP / 2, ext.h),
                  width: pct(k.w - MINI_GAP, ext.w),
                  height: pct(k.h - MINI_GAP, ext.h),
                  borderRadius: 2,
                  background: diff ? 'var(--color-pink)' : 'transparent',
                  border: diff
                    ? '1px solid var(--color-ink)'
                    : '1px solid color-mix(in srgb, var(--color-ink) 26%, transparent)',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** 違うキーの数。0 なら「同じ」と控えめに出す */
function DiffCount({ n, long = false }: { n: number; long?: boolean }) {
  if (n === 0) {
    return (
      <span className="shrink-0 text-[0.62rem] font-black opacity-45">
        {long ? 'あなたの配列と同じ' : '同じ'}
      </span>
    )
  }
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-px font-mono text-[0.62rem] font-black leading-tight"
      style={{ background: 'var(--color-pink)', border: '2px solid var(--color-ink)' }}
    >
      {long ? `${n} キー違う` : n}
    </span>
  )
}

function LayerChip({ layer, index }: { layer: Layer | undefined; index: number }) {
  return (
    <span
      className="nb-chip min-w-0"
      style={{ background: layer ? LAYER_COLOR_HEX[layer.color] : 'var(--color-paper)' }}
    >
      <span className="font-mono">L{index}</span>
      <span className="truncate">{layer?.name ?? '（なし）'}</span>
    </span>
  )
}

export interface KeymapDiffViewProps {
  /** 投稿の配列 */
  theirs: Keymap
  /** 自分の（編集中の）配列 */
  mine: Keymap
  /** 大きい盤面に出すレイヤー */
  focus: number
  onFocus: (n: number) => void
  /** 大きい盤面に、投稿ではなく自分の配列を出すか（違うキーの色はそのまま） */
  showMine: boolean
  onShowMine: (on: boolean) => void
  /** panel: サイド列の狭い幅 / modal: モーダルの広い幅 */
  variant: 'panel' | 'modal'
}

/** 大きい盤面 + その下に残り 7 レイヤーのミニキーマップ */
export function KeymapDiffView({
  theirs, mine, focus: rawFocus, onFocus, showMine, onShowMine, variant,
}: KeymapDiffViewProps) {
  const diffs = useLayerDiffs(mine, theirs)
  // モーダルでも、スマホ幅では横スクロールさせずに幅いっぱいの小さい盤面にする
  const roomy = useMediaQuery(SM_QUERY) && variant === 'modal'
  const layerCount = theirs.layers.length
  const focus = rawFocus < layerCount ? rawFocus : 0
  const shown = showMine ? mine : theirs
  const others = theirs.layers.map((_, i) => i).filter((i) => i !== focus)
  const focusDiff = diffs[focus] ?? new Set<KeyId>()

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <div
          className="inline-flex shrink-0 overflow-hidden rounded-[10px] border-[2.5px] border-[var(--color-ink)]"
          role="group"
          aria-label="大きい盤面に出す配列"
        >
          {([[false, 'この配列'], [true, 'あなたの配列']] as const).map(([mineSide, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={showMine === mineSide}
              onClick={() => onShowMine(mineSide)}
              className="px-2.5 py-1 text-[0.7rem] font-black"
              style={showMine === mineSide
                ? { background: 'var(--color-ink)', color: 'var(--color-paper)' }
                : { background: 'var(--color-paper)' }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[0.64rem] font-bold opacity-70">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: 'var(--color-pink)', border: '1.5px solid var(--color-ink)' }}
          />
          ＝あなたの配列と違うキー
        </span>
      </div>

      <div className="nb nb-flat p-2">
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
          <LayerChip layer={shown.layers[focus]} index={focus} />
          <span className="flex-1" />
          <DiffCount n={focusDiff.size} long />
        </div>
        {roomy
          ? (
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <KeyboardView interactive={false} previewKeymap={shown} previewLayer={focus} diffKeys={focusDiff} />
              </div>
            </div>
          )
          : <KeyboardView interactive={false} compact previewKeymap={shown} previewLayer={focus} diffKeys={focusDiff} />}
      </div>

      <div className={`grid gap-2 ${variant === 'panel' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {others.map((i) => {
          const layer = theirs.layers[i]
          const n = diffs[i]?.size ?? 0
          return (
            <button
              key={i}
              type="button"
              onClick={() => onFocus(i)}
              title={`L${i} ${layer.name} を大きく表示`}
              aria-label={`L${i} ${layer.name} を大きく表示（違うキー ${n}）`}
              className="block rounded-[10px] border-[2.5px] border-[var(--color-ink)] p-1.5 text-left transition-[box-shadow,transform] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_var(--color-ink)]"
              style={{ background: 'var(--color-paper)' }}
            >
              <span className="mb-1 flex min-w-0 items-center gap-1">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: LAYER_COLOR_HEX[layer.color], border: '1.5px solid var(--color-ink)' }}
                />
                <span className="shrink-0 font-mono text-[0.62rem] font-black">L{i}</span>
                <span className="min-w-0 flex-1 truncate text-[0.62rem] font-black opacity-70">{layer.name}</span>
                <DiffCount n={n} />
              </span>
              <DiffMiniMap diffKeys={diffs[i] ?? new Set()} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
