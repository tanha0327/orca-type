import { useState } from 'react'
import {
  clipByWidth, getMount, getSocket, getSwitch, KEYSWITCHES, pickLabel, pickOf, PICK_CHIP_WIDTH, samePick, socketFit,
  stemColorOf, switchesOf, SWITCH_TYPE_HELP, SWITCH_TYPE_LABEL,
  type KeySwitch, type SocketId,
} from '../../data/switches'
import { MAX_SWITCH_PICKS, SWITCH_NAME_MAX, type SwitchPick } from '../../data/types'
import { keyboardOf } from '../../keyboards/registry'
import { keyboardSockets, keyboardSpecOf, keyboardStockSwitches } from '../../keyboards/specs'
import { useKeymapStore } from '../../store/keymapStore'
import { useSwitchStore } from '../../store/switchStore'
import { StemSwatch, SwitchTypeChips, SwitchVisual } from './SwitchParts'

/** 候補に出す数の上限（名前で探しているとき） */
const MAX_SUGGESTIONS = 24

/**
 * 投稿画面の「使っているキースイッチ」。編集中の配列のスイッチ（キースイッチの画面の「使っている」と同じもの）を直接編集する。
 * 標準のスイッチがあるキーボード（Orca echo の Ninja / Samurai など）は、それを先に選択肢として出して押すだけで選べるようにし、
 * 付け替えた人向けのほかのスイッチは、少し離した「ほかのスイッチから選ぶ」の欄を開いて探す。
 * 標準のスイッチが無いキーボードは、はじめからソケットに合うスイッチを候補に出す。
 * カタログに無いスイッチは、打った名前のまま添えられる
 */
export function SwitchPicker() {
  const keymap = useKeymapStore((s) => s.keymap)
  const setSwitches = useKeymapStore((s) => s.setSwitches)
  const openDetail = useSwitchStore((s) => s.openDetail)
  const [othersOpen, setOthersOpen] = useState(false)

  const picks = switchesOf(keymap)
  const full = picks.length >= MAX_SWITCH_PICKS
  const board = keyboardOf(keymap)
  const spec = keyboardSpecOf(board)
  const sockets = keyboardSockets(spec)
  const stock = keyboardStockSwitches(spec)

  const isPicked = (pick: SwitchPick) => picks.some((p) => samePick(p, pick))
  const add = (pick: SwitchPick) => {
    if (full || isPicked(pick)) return
    setSwitches([...picks, pick])
  }
  const remove = (pick: SwitchPick) => setSwitches(picks.filter((p) => !samePick(p, pick)))
  const openSwitch = (sw: KeySwitch) => openDetail({ kind: 'switch', id: sw.id })

  const heading = (
    <>
      <span className="nb-eyebrow">キースイッチ（任意）</span>
      <p className="mt-0.5 text-[0.7rem] font-bold leading-relaxed opacity-60">
        使っているスイッチを {MAX_SWITCH_PICKS} つまで添えられます。キースイッチの画面の「使っている」と同じもので、
        {board.name} の配列に覚えておきます。
      </p>
    </>
  )

  if (stock.length === 0) {
    return (
      <div>
        {heading}
        {picks.length > 0 && (
          <div className="mt-1.5">
            <PickChips picks={picks} onRemove={remove} onOpen={openSwitch} />
          </div>
        )}
        <SwitchSearch
          picks={picks}
          full={full}
          sockets={sockets}
          exclude={[]}
          candidatesLabel={sockets.length > 0 ? `${board.name} のソケットに合うもの` : null}
          onAdd={add}
        />
      </div>
    )
  }

  const otherPicks = picks.filter((p) => !stock.some((sw) => samePick(pickOf(sw), p)))

  return (
    <div>
      {heading}

      <div className="mt-2">
        <p className="text-[0.76rem] font-black">{board.name} の標準スイッチ</p>
        <p className="text-[0.68rem] font-bold leading-relaxed opacity-60">
          買ったときに付いてくるスイッチです。付け替えていなければ、ここから選ぶだけで添えられます。
        </p>
        <div className="mt-1.5 space-y-1.5" role="group" aria-label={`${board.name} の標準スイッチ`}>
          {stock.map((sw) => {
            const on = isPicked(pickOf(sw))
            return (
              <StockSwitchOption
                key={sw.id}
                sw={sw}
                on={on}
                disabled={!on && full}
                onToggle={() => (on ? remove(pickOf(sw)) : add(pickOf(sw)))}
                onOpen={() => openSwitch(sw)}
              />
            )
          })}
        </div>
        {full && stock.some((sw) => !isPicked(pickOf(sw))) && (
          <p className="mt-1 text-[0.68rem] font-bold opacity-60">
            スイッチは {MAX_SWITCH_PICKS} つまでです。どれかを外すと選べます。
          </p>
        )}
      </div>

      {/* 標準のスイッチと混ざらないよう、ほかのスイッチは点線の枠に分けて、開いたときだけ探せるようにする */}
      <div className="mt-3 rounded-[var(--radius-btn)] border-2 border-dashed border-[var(--color-ink)]">
        <button
          type="button"
          className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-left"
          aria-expanded={othersOpen}
          onClick={() => setOthersOpen((v) => !v)}
        >
          <span className="text-[0.78rem] font-black">
            <span aria-hidden className="mr-1 inline-block w-3">{othersOpen ? '▾' : '▸'}</span>
            ほかのスイッチから選ぶ
          </span>
          <span className="text-[0.66rem] font-bold opacity-60">付け替えている人向け</span>
        </button>
        {otherPicks.length > 0 && (
          <div className="px-3 pb-2">
            <PickChips picks={otherPicks} onRemove={remove} onOpen={openSwitch} />
          </div>
        )}
        {othersOpen && (
          <div className="border-t-2 border-dashed border-[var(--color-ink)] px-3 pb-2.5 pt-0.5">
            <SwitchSearch
              picks={picks}
              full={full}
              sockets={sockets}
              exclude={stock}
              candidatesLabel={`${board.name} のソケットに合うもの`}
              onAdd={add}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/** 標準のスイッチの選択肢。押すと添える・外す。右の「詳細」でスイッチの詳細が開く */
function StockSwitchOption({
  sw, on, disabled, onToggle, onOpen,
}: {
  sw: KeySwitch
  on: boolean
  /** 添えられる数がいっぱいで、選べない */
  disabled: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <div
      className="nb nb-flat flex items-stretch overflow-hidden"
      style={{ background: on ? 'color-mix(in srgb, var(--color-lime) 45%, var(--color-paper))' : 'var(--color-paper)' }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        disabled={disabled}
        className="flex min-w-0 flex-1 items-center gap-2.5 p-2 text-left disabled:cursor-not-allowed disabled:opacity-45"
        title={disabled
          ? `スイッチは ${MAX_SWITCH_PICKS} つまでです。どれかを外すと選べます`
          : `${sw.name}（${SWITCH_TYPE_LABEL[sw.type]}）: ${SWITCH_TYPE_HELP[sw.type]}`}
        onClick={onToggle}
      >
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[0.8rem] font-black leading-none"
          style={{
            border: '3px solid var(--color-ink)',
            background: on ? 'var(--color-ink)' : 'var(--color-paper)',
            color: 'var(--color-lime)',
          }}
        >
          {on ? '✓' : ''}
        </span>
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px]"
          style={{
            border: '2px solid var(--color-ink)',
            background: `color-mix(in srgb, ${stemColorOf(sw)} 22%, var(--color-paper))`,
          }}
        >
          <SwitchVisual sw={sw} className="h-9 w-9" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.84rem] font-black leading-tight">{sw.name}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            <SwitchTypeChips sw={sw} />
          </span>
        </span>
      </button>
      <button
        type="button"
        className="shrink-0 border-l-[3px] border-[var(--color-ink)] px-2.5 text-[0.7rem] font-black hover:bg-[var(--color-lime)] focus-visible:bg-[var(--color-lime)]"
        aria-label={`${sw.name} の詳細を見る`}
        onClick={onOpen}
      >
        詳細
      </button>
    </div>
  )
}

/** 添えたスイッチのチップ。カタログにあるものは名前を押すと詳細が開き、✕ で外せる */
function PickChips({
  picks, onRemove, onOpen,
}: {
  picks: readonly SwitchPick[]
  onRemove: (pick: SwitchPick) => void
  onOpen: (sw: KeySwitch) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="添えるキースイッチ">
      {picks.map((pick) => {
        const sw = getSwitch(pick.id)
        return (
          <span
            key={pick.id ?? pick.name}
            className="nb-chip !pr-1"
            style={{ background: 'var(--color-lime)' }}
          >
            <StemSwatch color={sw ? stemColorOf(sw) : 'var(--color-gray)'} size={10} />
            {sw
              ? (
                <button type="button" className="underline decoration-dotted" onClick={() => onOpen(sw)}>
                  {pickLabel(pick)}
                </button>
              )
              : <span title={pick.name}>{clipByWidth(pick.name, PICK_CHIP_WIDTH)}</span>}
            <button
              type="button"
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem]"
              style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}
              aria-label={`${pickLabel(pick)} を外す`}
              onClick={() => onRemove(pick)}
            >
              ✕
            </button>
          </span>
        )
      })}
    </div>
  )
}

/**
 * 名前で探す欄と候補。何も打っていないときは、キーボードのソケットに合うスイッチ（exclude を除く）を候補に出す。
 * カタログにちょうど同じ名前が無ければ、打った名前のまま添えられる
 */
function SwitchSearch({
  picks, full, sockets, exclude, candidatesLabel, onAdd,
}: {
  picks: readonly SwitchPick[]
  full: boolean
  /** キーボードのソケット。空なら（取り込んだキーボードなど）カタログの全部を候補にする */
  sockets: readonly SocketId[]
  /** 何も打っていないときの候補から除くもの（上に別に出している標準のスイッチ） */
  exclude: readonly KeySwitch[]
  /** 何も打っていないときの候補の見出し。null なら出さない */
  candidatesLabel: string | null
  onAdd: (pick: SwitchPick) => void
}) {
  const [query, setQuery] = useState('')

  if (full) {
    return <p className="mt-1.5 text-[0.7rem] font-bold opacity-60">{MAX_SWITCH_PICKS} つ選びました。変えるときは ✕ で外してください。</p>
  }

  const q = query.trim().toLowerCase()
  const notPicked = (sw: KeySwitch) => !picks.some((p) => samePick(p, pickOf(sw)))
  const suggestions = KEYSWITCHES.filter(notPicked).filter((sw) => (
    q
      ? `${sw.name} ${sw.maker}`.toLowerCase().includes(q)
      : !exclude.includes(sw) && (sockets.length === 0 || sockets.some((s) => socketFit(s, sw.mount)))
  )).slice(0, q ? MAX_SUGGESTIONS : undefined)
  // カタログにちょうど同じ名前が無ければ、打った名前のまま添えられるようにする（もう添えてある名前は除く）
  const typed: SwitchPick = { name: query.trim().replace(/\s+/g, ' ').slice(0, SWITCH_NAME_MAX) }
  const custom = q && !KEYSWITCHES.some((sw) => sw.name.toLowerCase() === q) && !picks.some((p) => samePick(p, typed))
    ? typed
    : null
  // 候補に条件つきでしか挿さらない形（Orca echo の MX 互換など）があれば、その条件を一度だけ出す
  const conditions = q
    ? []
    : sockets.flatMap((id) => getSocket(id).fits
      .filter((f) => f.note && suggestions.some((sw) => sw.mount === f.mount))
      .map((f) => `${getMount(f.mount).label}: ${f.note}`))

  const add = (pick: SwitchPick) => {
    onAdd(pick)
    setQuery('')
  }

  return (
    <>
      <input
        className="nb-input mt-1.5 !py-1.5 text-[0.82rem]"
        type="search"
        value={query}
        maxLength={SWITCH_NAME_MAX}
        placeholder="名前で探す（カタログに無ければそのまま入力）"
        aria-label="キースイッチを名前で探す"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
          e.preventDefault()
          if (suggestions[0]) add(pickOf(suggestions[0]))
          else if (custom) add(custom)
        }}
      />
      {!q && candidatesLabel && suggestions.length > 0 && (
        <p className="mt-1.5 text-[0.66rem] font-bold opacity-55">{candidatesLabel}</p>
      )}
      {conditions.map((c) => (
        <p key={c} className="mt-0.5 text-[0.66rem] font-bold opacity-70">△ 条件つき — {c}</p>
      ))}
      <div className="mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto p-0.5">
        {suggestions.map((sw) => (
          <button
            key={sw.id}
            type="button"
            className="nb-chip"
            style={{ background: 'var(--color-paper)', cursor: 'pointer' }}
            title={`${sw.name}（${SWITCH_TYPE_LABEL[sw.type]}）を添える`}
            onClick={() => add(pickOf(sw))}
          >
            ＋ <StemSwatch color={stemColorOf(sw)} size={10} />
            {sw.name}
          </button>
        ))}
        {custom && (
          <button
            type="button"
            className="nb-chip"
            style={{ background: 'var(--color-sand)', cursor: 'pointer' }}
            title="カタログに無いスイッチとして、この名前のまま添える"
            onClick={() => add(custom)}
          >
            ＋「{clipByWidth(custom.name, PICK_CHIP_WIDTH)}」をそのまま添える
          </button>
        )}
        {q && suggestions.length === 0 && !custom && (
          <span className="text-[0.7rem] font-bold opacity-60">もう添えてあります</span>
        )}
      </div>
    </>
  )
}
