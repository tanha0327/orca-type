import { useMemo, type ReactNode } from 'react'
import {
  getMount, getSocket, KEYSWITCHES, MOUNTS, pickOf, samePick, socketFit, SOCKETS, stemColorOf, switchesOf, switchSpecLine,
  SWITCH_TYPE_LABEL, SWITCH_TYPES,
  type KeySwitch, type SocketId,
} from '../../data/switches'
import { MAX_SWITCH_PICKS } from '../../data/types'
import { BUILTIN_KEYBOARDS, createKeymap, getBuiltinKeyboard, keyboardOf } from '../../keyboards/registry'
import { editionSockets, keyboardSpecOf } from '../../keyboards/specs'
import type { KeyboardDefinition } from '../../keyboards/types'
import { useKeymapStore } from '../../store/keymapStore'
import { useSwitchStore, type SocketFilter, type TypeFilter } from '../../store/switchStore'
import { KeyboardView } from '../Board/KeyboardView'
import { KeyboardSpecCard, StemSwatch, SwitchPickChips, SwitchTypeChips } from './SwitchParts'

/** キースイッチの画面で見るキーボード。指定が無い・見つからないときは編集中のキーボード */
export function resolveFinderKeyboard(id: string | null, editing: KeyboardDefinition): KeyboardDefinition {
  if (!id || id === editing.id) return editing
  return getBuiltinKeyboard(id) ?? editing
}

/** 絞り込みに使うソケット。null は絞り込まない */
function activeSockets(filter: SocketFilter, boardSockets: SocketId[]): SocketId[] | null {
  if (filter === 'all') return null
  if (filter === 'board') return boardSockets.length > 0 ? boardSockets : null
  return [filter]
}

function matchesType(sw: KeySwitch, type: TypeFilter): boolean {
  if (type === 'all') return true
  if (type === 'silent') return !!sw.silent
  return sw.type === type
}

function matchesQuery(sw: KeySwitch, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${sw.name} ${sw.maker} ${SWITCH_TYPE_LABEL[sw.type]}`.toLowerCase().includes(q)
}

/** そのソケットの組み合わせに挿さるか。挿さるなら、どれも条件つき（note あり）のときだけその条件を返す */
function fitOf(sw: KeySwitch, sockets: SocketId[] | null): { fits: boolean; note?: string } {
  if (!sockets) return { fits: true }
  const fits = sockets.flatMap((s) => socketFit(s, sw.mount) ?? [])
  if (fits.length === 0) return { fits: false }
  return fits.every((f) => f.note) ? { fits: true, note: fits[0].note } : { fits: true }
}

/**
 * キースイッチの画面。
 * 上: キーボードを選ぶと、そのスペック（タグ）と版ごとのソケットが出る。タグ・ソケットは押すと説明のシートが開く
 * 中: そのソケットに合うスイッチの一覧（種類・名前で絞り込める）。押すとスイッチの詳細
 * 下: ソケットとスイッチの足の形の対応表
 */
export function SwitchFinderView() {
  const keymap = useKeymapStore((s) => s.keymap)
  const setSwitches = useKeymapStore((s) => s.setSwitches)
  const keyboardId = useSwitchStore((s) => s.keyboardId)
  const setKeyboard = useSwitchStore((s) => s.setKeyboard)
  const edition = useSwitchStore((s) => s.edition)
  const setEdition = useSwitchStore((s) => s.setEdition)
  const socketFilter = useSwitchStore((s) => s.socket)
  const setSocket = useSwitchStore((s) => s.setSocket)
  const typeFilter = useSwitchStore((s) => s.type)
  const setType = useSwitchStore((s) => s.setType)
  const query = useSwitchStore((s) => s.query)
  const setQuery = useSwitchStore((s) => s.setQuery)
  const openDetail = useSwitchStore((s) => s.openDetail)

  const editing = keyboardOf(keymap)
  const board = resolveFinderKeyboard(keyboardId, editing)
  const spec = keyboardSpecOf(board)
  const currentEdition = spec.editions[edition] ?? spec.editions[0]
  const boardSockets = useMemo(() => (currentEdition ? editionSockets(currentEdition) : []), [currentEdition])
  // 取り込んだキーボードはソケットが分からないので、「このキーボードに合う」では絞れない
  const filter: SocketFilter = socketFilter === 'board' && boardSockets.length === 0 ? 'all' : socketFilter
  const sockets = useMemo(() => activeSockets(filter, boardSockets), [filter, boardSockets])

  const mine = switchesOf(keymap)
  const isMine = (sw: KeySwitch) => mine.some((p) => samePick(p, pickOf(sw)))

  // 盤面の見本。編集中のキーボードなら今の配列、ほかは初期キーマップ
  const preview = useMemo(
    () => (board.id === keymap.keyboard ? keymap : createKeymap(board)),
    [board, keymap],
  )

  const list = useMemo(
    () => KEYSWITCHES.filter((sw) => fitOf(sw, sockets).fits && matchesType(sw, typeFilter) && matchesQuery(sw, query)),
    [sockets, typeFilter, query],
  )

  const countFor = (f: SocketFilter) => {
    const ss = activeSockets(f, boardSockets)
    return KEYSWITCHES.filter((sw) => fitOf(sw, ss).fits && matchesType(sw, typeFilter) && matchesQuery(sw, query)).length
  }

  const keyboards = BUILTIN_KEYBOARDS.some((d) => d.id === editing.id) ? BUILTIN_KEYBOARDS : [editing, ...BUILTIN_KEYBOARDS]

  // 絞り込んでいるソケットに条件つきでしか挿さらない形があれば、その条件を一覧の上に一度だけ出す
  const conditions = (sockets ?? []).flatMap((id) => getSocket(id).fits
    .filter((f) => f.note)
    .map((f) => `${getMount(f.mount).label}: ${f.note}`))

  const listLead = filter === 'all'
    ? 'カタログのすべてのスイッチ。'
    : filter === 'board'
      ? `${spec.editions.length > 1 && currentEdition ? currentEdition.name : board.name} のソケット（${boardSockets.map((id) => getSocket(id).short).join('・')}）に挿さるスイッチ。`
      : `${getSocket(filter).label}に挿さるスイッチ。`

  return (
    <div className="space-y-4">
      <section className="nb nb-lg overflow-hidden">
        <div className="p-4 pb-3">
          <h2 className="text-[1.35rem]">キースイッチ</h2>
          <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
            キーボードのスペックと、そのソケットにハマるキースイッチを探せます。
            タグ・ソケット・スイッチを押すと詳しい説明が出ます。
          </p>
        </div>

        <MySwitchesBar
          keyboardName={editing.name}
          count={mine.length}
          onClear={() => { if (confirm('使っているスイッチをすべて外しますか？')) setSwitches([]) }}
        >
          <SwitchPickChips picks={mine} />
        </MySwitchesBar>

        <div className="border-t-[3px] border-[var(--color-ink)] p-4">
          <p className="nb-eyebrow">キーボード</p>
          <div
            className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:overflow-visible"
            role="radiogroup"
            aria-label="スペックを見るキーボード"
          >
            {keyboards.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={d.id === board.id}
                className="nb-btn shrink-0 !py-1 !px-2.5 text-[0.76rem]"
                data-active={d.id === board.id}
                onClick={() => setKeyboard(d.id === editing.id ? null : d.id)}
              >
                {d.name}
                {d.id === editing.id && <span className="text-[0.62rem] opacity-70">編集中</span>}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-[1.15rem]">{board.name}</h3>
            {board.maker && <span className="text-[0.72rem] font-bold opacity-60">{board.maker}</span>}
          </div>

          <div className="mt-2 max-w-[640px]">
            <KeyboardView interactive={false} compact previewKeymap={preview} previewLayer={0} />
          </div>

          <div className="mt-3">
            <KeyboardSpecCard def={board} spec={spec} edition={edition} onEdition={setEdition} />
          </div>
        </div>
      </section>

      <section className="nb nb-lg overflow-hidden">
        <div className="p-4 pb-3">
          <h2 className="text-[1.35rem]">ハマるスイッチ</h2>
          <p className="mt-1 text-[0.76rem] font-bold leading-relaxed opacity-70">
            {listLead}
            数値はメーカー公称の代表値です。
          </p>
        </div>

        <div className="space-y-2.5 border-y-[3px] border-[var(--color-ink)] p-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="ソケットで絞り込む">
            <span className="nb-eyebrow mr-0.5">ソケット</span>
            {boardSockets.length > 0 && (
              <FilterChip label="このキーボードに合う" count={countFor('board')} active={filter === 'board'} onClick={() => setSocket('board')} />
            )}
            <FilterChip label="すべて" count={countFor('all')} active={filter === 'all'} onClick={() => setSocket('all')} />
            {SOCKETS.map((s) => (
              <FilterChip
                key={s.id}
                label={s.short}
                title={s.label}
                count={countFor(s.id)}
                active={filter === s.id}
                onClick={() => setSocket(s.id)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="種類で絞り込む">
            <span className="nb-eyebrow mr-0.5">種類</span>
            {(['all', ...SWITCH_TYPES, 'silent'] as TypeFilter[]).map((f) => (
              <FilterChip
                key={f}
                label={f === 'all' ? 'すべて' : f === 'silent' ? '静音' : SWITCH_TYPE_LABEL[f]}
                active={typeFilter === f}
                onClick={() => setType(f)}
              />
            ))}
          </div>
          <input
            className="nb-input !py-1.5 text-[0.82rem]"
            type="search"
            value={query}
            placeholder="名前・メーカーで探す（例: Gateron、Choc）"
            aria-label="スイッチを名前・メーカーで探す"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {conditions.length > 0 && list.some((sw) => fitOf(sw, sockets).note) && (
          <ul className="space-y-0.5 border-b-[3px] border-[var(--color-ink)] px-3 py-2 text-[0.72rem] font-bold" style={{ background: 'var(--color-sand)' }}>
            {conditions.map((c) => <li key={c}>△ 条件つき — {c}</li>)}
          </ul>
        )}

        {list.length > 0
          ? (
            <div className="grid gap-2.5 p-3 sm:grid-cols-2">
              {list.map((sw) => (
                <SwitchCard
                  key={sw.id}
                  sw={sw}
                  mine={isMine(sw)}
                  conditional={fitOf(sw, sockets).note}
                  onOpen={() => openDetail({ kind: 'switch', id: sw.id })}
                />
              ))}
            </div>
          )
          : (
            <p className="p-6 text-center text-[0.82rem] font-bold opacity-60">
              条件に合うスイッチがカタログにありません。ソケットや種類の絞り込みを変えてみてください。
            </p>
          )}
      </section>

      <CompatTable />
    </div>
  )
}

/** 編集中の配列で使っているスイッチ。みんなの配列に投稿するときに一緒に載る */
function MySwitchesBar({
  keyboardName, count, onClear, children,
}: {
  keyboardName: string
  count: number
  onClear: () => void
  children: ReactNode
}) {
  return (
    <div className="border-t-[3px] border-[var(--color-ink)] p-3" style={{ background: 'var(--color-sand)' }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.76rem] font-black">使っているスイッチ（{keyboardName}）</span>
        {children}
        {count === 0 && <span className="text-[0.72rem] font-bold opacity-60">まだありません</span>}
        {count > 0 && (
          <button type="button" className="nb-btn !py-0.5 !px-2 text-[0.68rem]" onClick={onClear}>
            すべて外す
          </button>
        )}
      </div>
      <p className="mt-1 text-[0.68rem] font-bold leading-relaxed opacity-65">
        スイッチの詳細で「使っている」にすると（{MAX_SWITCH_PICKS} つまで）、みんなの配列に投稿するときに一緒に載ります。
      </p>
    </div>
  )
}

function FilterChip({
  label, count, active, title, onClick,
}: {
  label: string
  count?: number
  active: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="nb-btn !py-1 !px-2.5 text-[0.74rem]"
      data-active={active}
      aria-pressed={active}
      title={title}
      onClick={onClick}
      style={!active && count === 0 ? { opacity: 0.5 } : undefined}
    >
      {label}
      {count !== undefined && <span className="font-mono text-[0.66rem] opacity-70">{count}</span>}
    </button>
  )
}

function SwitchCard({
  sw, mine, conditional, onOpen,
}: {
  sw: KeySwitch
  /** 使っているスイッチに入れているか */
  mine: boolean
  /** 絞り込んでいるソケットに条件つきでしか挿さらないなら、その条件 */
  conditional?: string
  onOpen: () => void
}) {
  const spec = switchSpecLine(sw)
  const mount = getMount(sw.mount)
  return (
    <button
      type="button"
      className="nb-btn !flex-col !items-stretch !justify-start !gap-1 !p-2.5 text-left"
      onClick={onOpen}
    >
      <span className="flex items-center gap-2">
        <StemSwatch color={stemColorOf(sw)} size={16} />
        <span className="min-w-0 flex-1 truncate text-[0.88rem] font-black">{sw.name}</span>
        {mine && (
          <span className="nb-chip shrink-0 !py-0 !text-[0.58rem]" style={{ background: 'var(--color-lime)' }}>使っている</span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <SwitchTypeChips sw={sw} />
        <span className="text-[0.68rem] font-bold opacity-60">{sw.maker} ・ {mount.label}</span>
      </span>
      <span className="font-mono text-[0.72rem] font-bold opacity-80">{spec || '押下圧など: 公表待ち'}</span>
      {conditional && (
        <span className="nb-chip self-start" style={{ background: 'var(--color-sand)' }} title={conditional}>
          △ 条件つき
        </span>
      )}
    </button>
  )
}

/** ソケット（行）× スイッチの足の形（列）の対応表。ソケットの名前を押すと説明が開く */
function CompatTable() {
  const openDetail = useSwitchStore((s) => s.openDetail)
  const conditions = SOCKETS.flatMap((s) => s.fits.filter((f) => f.note).map((f) => ({ socket: s, fit: f })))
  return (
    <section className="nb nb-lg overflow-hidden">
      <div className="p-4 pb-3">
        <h2 className="text-[1.35rem]">ソケットとスイッチの対応表</h2>
        <p className="mt-1 text-[0.76rem] font-bold leading-relaxed opacity-70">
          スイッチは「足の形」が同じなら、メーカーが違っても同じソケットに挿さります。
          ロープロファイル（薄型）のスイッチは、形がメーカーや世代ごとにばらばらなので注意。
        </p>
      </div>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[540px] border-separate border-spacing-0 text-[0.72rem] font-bold">
          <thead>
            <tr>
              <th className="p-1.5 text-left align-bottom">
                <span className="nb-eyebrow">ソケット ＼ スイッチ</span>
              </th>
              {MOUNTS.map((m) => (
                <th key={m.id} className="p-1.5 text-center align-bottom leading-tight" title={m.label}>
                  {m.short}
                  <span className="block text-[0.6rem] font-bold opacity-55">
                    {m.profile === 'low' ? 'ロープロファイル' : '標準の高さ'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOCKETS.map((s) => (
              <tr key={s.id}>
                <th className="border-t-2 border-[var(--color-ink)] p-1.5 text-left">
                  <button type="button" className="text-left underline decoration-2 underline-offset-2" onClick={() => openDetail({ kind: 'socket', id: s.id })}>
                    {s.label}
                  </button>
                </th>
                {MOUNTS.map((m) => {
                  const fit = socketFit(s.id, m.id)
                  return (
                    <td
                      key={m.id}
                      className="border-t-2 border-[var(--color-ink)] p-1.5 text-center text-[0.95rem] font-black"
                      style={fit ? { background: fit.note ? 'var(--color-sand)' : 'var(--color-lime)' } : { opacity: 0.35 }}
                      title={fit?.note ?? (fit ? '挿さる' : '挿さらない')}
                    >
                      {fit ? (fit.note ? '△' : '◯') : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[0.68rem] font-bold opacity-65">◯ 挿さる　△ 条件つきで挿さる　— 挿さらない</p>
        {conditions.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[0.68rem] font-bold opacity-75">
            {conditions.map(({ socket, fit }) => (
              <li key={`${socket.id}-${fit.mount}`}>
                △ {socket.short} × {getMount(fit.mount).short}: {fit.note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
