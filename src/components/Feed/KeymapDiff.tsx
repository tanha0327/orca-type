import { useMemo } from 'react'
import { halfExtent, KEYS, SENSORS, type Half, type KeyId } from '../../data/layout'
import { isModTap, isTrans, LAYER_COLOR_HEX, type Binding, type Keymap, type Layer } from '../../data/types'
import { resolveKey } from '../../engine/resolve'
import { SM_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { KeyboardView } from '../Board/KeyboardView'

/* ================================================================
   投稿の配列を、あなたの配列と比べて見せる部品
   - 大きい盤面: 見ているレイヤーを印字つきで。違うキーはピンク
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

/* ---------------------------------------------------------------- ミニキーマップ */

/** キー同士のすき間と、左右の半分の間隔（ユニット） */
const MINI_GAP = 0.16
const MINI_SPLIT = 0.9

const HALVES = (['L', 'R'] as const satisfies readonly Half[]).map((half, i) => ({
  half,
  dx: i === 0 ? 0 : halfExtent('L').w + MINI_SPLIT,
  keys: KEYS.filter((k) => k.half === half),
  sensors: SENSORS.filter((s) => s.half === half),
}))
const MINI_W = halfExtent('L').w + MINI_SPLIT + halfExtent('R').w
const MINI_H = Math.max(halfExtent('L').h, halfExtent('R').h)

const FAINT = 'color-mix(in srgb, var(--color-ink) 28%, transparent)'

/**
 * 印字を省いた小さな盤面。違うキーだけピンクで塗り、他はうすい枠だけにする。
 * センサー（パッド・ホイール・ボール）は形の目印として点線で添える。
 * 投稿ごとに 7 枚ずつ並ぶので、要素の軽い SVG で描く。
 */
export function DiffMiniMap({ diffKeys }: { diffKeys: ReadonlySet<KeyId> }) {
  return (
    <svg viewBox={`0 0 ${MINI_W} ${MINI_H}`} className="block h-auto w-full" aria-hidden>
      {HALVES.map(({ half, dx, keys, sensors }) => (
        <g key={half} transform={`translate(${dx} 0)`}>
          {sensors.map((s) => (
            <rect
              key={s.id}
              x={s.x + MINI_GAP / 2}
              y={s.y + MINI_GAP / 2}
              width={s.w - MINI_GAP}
              height={s.h - MINI_GAP}
              rx={s.kind === 'ball' ? (s.w - MINI_GAP) / 2 : 0.14}
              fill="none"
              stroke={FAINT}
              strokeWidth={1}
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {keys.map((k) => {
            const diff = diffKeys.has(k.id)
            return (
              <rect
                key={k.id}
                x={k.x + MINI_GAP / 2}
                y={k.y + MINI_GAP / 2}
                width={k.w - MINI_GAP}
                height={k.h - MINI_GAP}
                rx={0.14}
                fill={diff ? 'var(--color-pink)' : 'none'}
                stroke={diff ? 'var(--color-ink)' : FAINT}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </g>
      ))}
    </svg>
  )
}

/* ---------------------------------------------------------------- 小物 */

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
      {long ? `あなたと ${n} キー違う` : n}
    </span>
  )
}

export function LayerChip({ layer, index }: { layer: Layer | undefined; index: number }) {
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

/** 見ているレイヤーが範囲外（レイヤー数の少ない古い投稿など）なら L0 に戻す */
function clampLayer(focus: number, layerCount: number) {
  return focus < layerCount ? focus : 0
}

/** 大きい盤面の下に並べる、残りのレイヤーのミニキーマップ。押すとそのレイヤーを大きく出す */
function OtherLayers({
  theirs, diffs, focus, onFocus, className,
}: {
  theirs: Keymap
  diffs: Set<KeyId>[]
  focus: number
  onFocus: (n: number) => void
  className: string
}) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      {theirs.layers.map((layer, i) => {
        if (i === focus) return null
        const n = diffs[i]?.size ?? 0
        return (
          <button
            key={i}
            type="button"
            onClick={() => onFocus(i)}
            title={`L${i} ${layer.name} を大きく表示`}
            aria-label={`L${i} ${layer.name} を大きく表示（あなたと違うキー ${n}）`}
            className="@container block min-w-0 rounded-[9px] border-2 border-[var(--color-ink)] p-1 text-left transition-[box-shadow,transform] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_var(--color-ink)]"
            style={{ background: 'var(--color-paper)' }}
          >
            <span className="mb-0.5 flex min-w-0 items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: LAYER_COLOR_HEX[layer.color], border: '1.5px solid var(--color-ink)' }}
              />
              <span className="shrink-0 font-mono text-[0.58rem] font-black">L{i}</span>
              {/* スマホ幅の小さなミニでは名前を省いて、番号と違いの数だけにする */}
              <span className="hidden min-w-0 truncate text-[0.58rem] font-black opacity-70 @min-[5.5rem]:block">
                {layer.name}
              </span>
              <span className="ml-auto shrink-0">
                <DiffCount n={n} />
              </span>
            </span>
            <DiffMiniMap diffKeys={diffs[i] ?? new Set()} />
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- タイムラインの投稿 */

/**
 * 投稿カードの盤面。見ているレイヤーを大きく出して違うキーをピンクにし、
 * その下に残りのレイヤーをミニキーマップで並べる（違うキーだけ色付き）
 */
export function PostDiff({
  theirs, mine, focus: rawFocus, onFocus,
}: {
  theirs: Keymap
  mine: Keymap
  focus: number
  onFocus: (n: number) => void
}) {
  const diffs = useLayerDiffs(mine, theirs)
  const focus = clampLayer(rawFocus, theirs.layers.length)
  const focusDiff = diffs[focus] ?? new Set<KeyId>()

  return (
    <div className="@container space-y-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <LayerChip layer={theirs.layers[focus]} index={focus} />
        <span className="flex-1" />
        <DiffCount n={focusDiff.size} long />
      </div>
      <KeyboardView interactive={false} compact previewKeymap={theirs} previewLayer={focus} diffKeys={focusDiff} />
      <OtherLayers
        theirs={theirs}
        diffs={diffs}
        focus={focus}
        onFocus={onFocus}
        className="grid-cols-4 @2xl:grid-cols-7"
      />
    </div>
  )
}

/* ---------------------------------------------------------------- 拡大モーダル */

/** 拡大モーダル用。大きい盤面を自分の配列に切り替えて、同じ位置の自分の割当も確かめられる */
export function KeymapDiffView({
  theirs, mine, focus: rawFocus, onFocus, showMine, onShowMine,
}: {
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
}) {
  const diffs = useLayerDiffs(mine, theirs)
  // スマホ幅では横スクロールさせずに、幅いっぱいの小さい盤面にする
  const roomy = useMediaQuery(SM_QUERY)
  const focus = clampLayer(rawFocus, theirs.layers.length)
  const shown = showMine ? mine : theirs
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

      <OtherLayers
        theirs={theirs}
        diffs={diffs}
        focus={focus}
        onFocus={onFocus}
        className="grid-cols-2 sm:grid-cols-4"
      />
    </div>
  )
}
