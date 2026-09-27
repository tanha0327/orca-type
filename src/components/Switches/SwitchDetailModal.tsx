import { useEffect, useState, type ReactNode } from 'react'
import {
  getMount, getSocket, getSwitch, KEYSWITCHES, MOUNTS, pickOf, samePick, socketFit, socketsForMount, STEM_LABEL,
  stemColorOf, switchesOf, SWITCH_TYPE_HELP, SWITCH_TYPE_LABEL,
  type SocketId, type SwitchMount,
} from '../../data/switches'
import { MAX_SWITCH_PICKS } from '../../data/types'
import { BUILTIN_KEYBOARDS, isBuiltinKeyboard, keyboardOf } from '../../keyboards/registry'
import {
  getSpecTag, keyboardSockets, keyboardSpecOf, SPEC_TAG_GROUP_LABEL,
  type SpecTagId,
} from '../../keyboards/specs'
import type { KeyboardDefinition } from '../../keyboards/types'
import { errorMessage } from '../../lib/errors'
import { feedEnabled, fetchKeymapsByIds, fetchPostsUsingSwitch, type SharedKeymapSummary } from '../../lib/feed'
import { setUrlKeymapId } from '../../lib/permalink'
import { useFeedStore } from '../../store/feedStore'
import { useKeymapStore } from '../../store/keymapStore'
import { useSwitchStore, type SocketFilter, type SwitchDetail } from '../../store/switchStore'
import { Avatar, relativeTime } from '../Feed/FeedParts'
import { Ring } from '../Ring'
import { resolveFinderKeyboard } from './SwitchFinderView'
import {
  KeyboardSpecCard, previewSwitchSound, SocketChip, StemSwatch, SwitchChip, SwitchTypeChips,
} from './SwitchParts'

/** キースイッチの画面を開いて、指定のキーボード・版・ソケットで一覧を見せる */
function showInFinder(opts: { keyboardId?: string; edition?: number; socket?: SocketFilter }) {
  const finder = useSwitchStore.getState()
  const editor = useKeymapStore.getState()
  if (opts.keyboardId !== undefined) {
    finder.setKeyboard(opts.keyboardId === keyboardOf(editor.keymap).id ? null : opts.keyboardId)
  }
  if (opts.edition !== undefined) finder.setEdition(opts.edition)
  if (opts.socket !== undefined) finder.setSocket(opts.socket)
  finder.closeDetail()
  editor.setView('switches')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

interface BoardMatch {
  def: KeyboardDefinition
  edition: number
  editionName: string
}

/** 組み込みのキーボードのうち、どれかの版のソケットが条件に合うもの（最初に合った版） */
function builtinBoardsWhere(match: (socket: SocketId) => boolean): BoardMatch[] {
  return BUILTIN_KEYBOARDS.flatMap((def) => {
    const { editions } = keyboardSpecOf(def)
    const i = editions.findIndex((e) => e.sockets.some((ref) => match(ref.id)))
    return i >= 0 ? [{ def, edition: i, editionName: editions[i].name }] : []
  })
}

function headOf(detail: SwitchDetail): { eyebrow: string; title: string; swatch?: string } {
  switch (detail.kind) {
    case 'switch': {
      const sw = getSwitch(detail.id)
      return { eyebrow: 'キースイッチ', title: sw?.name ?? 'キースイッチ', swatch: sw ? stemColorOf(sw) : undefined }
    }
    case 'tag': {
      const tag = getSpecTag(detail.id)
      return { eyebrow: `スペック・${SPEC_TAG_GROUP_LABEL[tag.group]}`, title: tag.label }
    }
    case 'socket':
      return { eyebrow: 'ソケット', title: getSocket(detail.id).label }
    case 'keyboard':
      return { eyebrow: 'キーボードのスペック', title: detail.def.name }
  }
}

/** 詳細のシートの中身を入れ替えたときに状態（読み込んだ投稿など）を持ち越さないための key */
function keyOf(detail: SwitchDetail): string {
  switch (detail.kind) {
    case 'switch': return `switch:${detail.id}`
    case 'tag': return `tag:${detail.id}:${detail.keyboardId ?? ''}`
    case 'socket': return `socket:${detail.id}`
    case 'keyboard': return `keyboard:${detail.def.id}`
  }
}

/**
 * スイッチ・スペックのタグ・ソケット・キーボードの詳しい説明のシート。
 * キースイッチの画面からも、みんなの配列の投稿（スイッチ・キーボードのチップ）からも開くので App に 1 つだけ置く。
 * 中のチップをたどって別の詳細を開くと、← で戻れる
 */
export function SwitchDetailModal() {
  const detail = useSwitchStore((s) => s.detail)
  const canBack = useSwitchStore((s) => s.history.length > 0)
  const back = useSwitchStore((s) => s.back)
  const close = useSwitchStore((s) => s.closeDetail)

  useEffect(() => {
    if (!detail) return
    // 投稿の拡大モーダルや投稿画面の上に開くこともあるので、Esc はここで止めて下のモーダルまで閉じないようにする
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (useSwitchStore.getState().history.length > 0) back()
      else close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [detail, back, close])

  if (!detail) return null
  const head = headOf(detail)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={head.title}
        className="nb nb-lg flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden"
      >
        <header
          className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
          style={{ background: 'var(--color-purple)' }}
        >
          {canBack && (
            <button type="button" className="nb-btn shrink-0 !py-1.5 !px-2.5 text-[0.8rem]" onClick={back} aria-label="戻る">
              ←
            </button>
          )}
          {head.swatch && <StemSwatch color={head.swatch} size={18} />}
          <div className="min-w-0 flex-1">
            <p className="nb-eyebrow !opacity-80">{head.eyebrow}</p>
            <h3 className="truncate text-[1.05rem]">{head.title}</h3>
          </div>
          <button type="button" className="nb-btn shrink-0 !py-1.5 text-[0.78rem]" onClick={close}>
            閉じる
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3" key={keyOf(detail)}>
          {detail.kind === 'switch' && <SwitchBody id={detail.id} />}
          {detail.kind === 'tag' && <TagBody id={detail.id} keyboardId={detail.keyboardId} />}
          {detail.kind === 'socket' && <SocketBody id={detail.id} />}
          {detail.kind === 'keyboard' && <KeyboardBody def={detail.def} />}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[0.82rem] font-black">{title}</h4>
      {children}
    </section>
  )
}

function Stat({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="nb nb-flat p-2 text-center" title={help}>
      <dt className="text-[0.64rem] font-bold opacity-60">{label}</dt>
      <dd className="font-mono text-[1.05rem] font-black leading-tight">{value}</dd>
    </div>
  )
}

function BoardChips({ boards }: { boards: BoardMatch[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {boards.map((b) => (
        <button
          key={b.def.id}
          type="button"
          className="nb-chip"
          style={{ background: 'var(--color-sand)', cursor: 'pointer' }}
          title={`${b.editionName}（キースイッチの画面で見る）`}
          onClick={() => showInFinder({ keyboardId: b.def.id, edition: b.edition })}
        >
          ⌨ {b.def.name}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- スイッチ */

function SwitchBody({ id }: { id: string }) {
  const keymap = useKeymapStore((s) => s.keymap)
  const setSwitches = useKeymapStore((s) => s.setSwitches)
  const volume = useKeymapStore((s) => s.sound.volume)
  const [message, setMessage] = useState<string | null>(null)

  const sw = getSwitch(id)
  if (!sw) {
    return <p className="text-[0.82rem] font-bold opacity-70">このスイッチはカタログにありません。</p>
  }

  const mount = getMount(sw.mount)
  const picks = switchesOf(keymap)
  const mine = picks.some((p) => samePick(p, pickOf(sw)))
  const editing = keyboardOf(keymap)
  const editingSockets = keyboardSockets(keyboardSpecOf(editing))
  // 編集中のキーボードのソケットが分かっていて、どれにも挿さらないなら知らせる
  const fitsEditing = editingSockets.length === 0 || editingSockets.some((s) => socketFit(s, sw.mount))
  const sockets = socketsForMount(sw.mount)
  const boards = builtinBoardsWhere((socket) => !!socketFit(socket, sw.mount))

  const toggleMine = () => {
    setMessage(null)
    if (mine) {
      setSwitches(picks.filter((p) => !samePick(p, pickOf(sw))))
      return
    }
    if (picks.length >= MAX_SWITCH_PICKS) {
      setMessage(`使っているスイッチは ${MAX_SWITCH_PICKS} つまでです。どれかを外してから足してください。`)
      return
    }
    setSwitches([...picks, pickOf(sw)])
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.76rem] font-bold opacity-65">{sw.maker}</span>
          <SwitchTypeChips sw={sw} />
        </div>
        <p className="text-[0.76rem] font-bold leading-relaxed opacity-75">{SWITCH_TYPE_HELP[sw.type]}</p>
        {sw.note && <p className="text-[0.82rem] font-bold leading-relaxed">{sw.note}</p>}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="押下圧" value={sw.forceGf !== undefined ? `${sw.forceGf}gf` : '—'} help="キーが反応する点での荷重" />
        <Stat
          label="動作点まで"
          value={sw.preTravel !== undefined ? `${sw.preTravel.toFixed(1)}mm` : '—'}
          help="押し始めてから反応するまでの深さ（プリトラベル）"
        />
        <Stat
          label="押し切り"
          value={sw.totalTravel !== undefined ? `${sw.totalTravel.toFixed(1)}mm` : '—'}
          help="いちばん下まで押したときの深さ（トータルトラベル）"
        />
      </dl>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="nb-btn flex-1 !py-2 text-[0.8rem]"
          style={mine ? { background: 'var(--color-lime)' } : undefined}
          aria-pressed={mine}
          onClick={toggleMine}
        >
          {mine ? '✓ 使っている' : '＋ 使っているスイッチにする'}
        </button>
        <button
          type="button"
          className="nb-btn !py-2 text-[0.8rem]"
          title="種類ごとの打鍵音のイメージ（シンセサイザーで作った音）"
          onClick={() => previewSwitchSound(sw.type, volume > 0 ? volume : 0.6)}
        >
          🔊 {SWITCH_TYPE_LABEL[sw.type]}の音
        </button>
      </div>
      <p className="-mt-2 text-[0.68rem] font-bold leading-relaxed opacity-60">
        「使っている」は編集中の {editing.name} の配列に記録され、みんなの配列に投稿するときに一緒に載ります。
        音は種類ごとのイメージで、このスイッチの実際の音ではありません。
      </p>
      {!fitsEditing && (
        <p className="nb nb-flat p-2 text-[0.74rem] font-bold" style={{ background: 'var(--color-pink)' }}>
          編集中の {editing.name} のソケットには挿さらない形です。
        </p>
      )}
      {message && (
        <p className="nb nb-flat p-2 text-[0.74rem] font-bold" style={{ background: 'var(--color-sand)' }}>{message}</p>
      )}

      <Section title="足の形とキーキャップ">
        <p className="text-[0.78rem] font-bold leading-relaxed">
          {mount.label}（{mount.profile === 'low' ? 'ロープロファイル' : '標準の高さ'}）
        </p>
        <p className="text-[0.74rem] font-bold leading-relaxed opacity-70">{mount.desc}</p>
        <p className="text-[0.74rem] font-bold">
          キーキャップ: {mount.stem ? STEM_LABEL[mount.stem] : 'まだ公表されていません'}
        </p>
      </Section>

      <Section title="ハマるソケット">
        <div className="flex flex-wrap gap-1.5">
          {sockets.map((s) => <SocketChip key={s.id} id={s.id} note={socketFit(s.id, sw.mount)?.note} />)}
        </div>
        {sockets.some((s) => socketFit(s.id, sw.mount)?.note) && (
          <ul className="space-y-0.5 text-[0.7rem] font-bold opacity-70">
            {sockets.filter((s) => socketFit(s.id, sw.mount)?.note).map((s) => (
              <li key={s.id}>＊ {s.short}: {socketFit(s.id, sw.mount)?.note}</li>
            ))}
          </ul>
        )}
      </Section>

      {boards.length > 0 && (
        <Section title="使える組み込みのキーボード">
          <BoardChips boards={boards} />
        </Section>
      )}

      {feedEnabled() && (
        <Section title="このスイッチを使っている配列">
          <PostsUsingSwitch id={sw.id} />
        </Section>
      )}
    </div>
  )
}

/** みんなの配列で、そのスイッチを添えて投稿された配列（新しい順に数件）。押すと投稿を大きく開く */
function PostsUsingSwitch({ id }: { id: string }) {
  const [rows, setRows] = useState<SharedKeymapSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPostsUsingSwitch(id)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(`読み込めませんでした: ${errorMessage(e)}`) })
    return () => { cancelled = true }
  }, [id])

  const open = async (row: SharedKeymapSummary) => {
    const { view, setView } = useKeymapStore.getState()
    if (view !== 'feed') {
      // みんなの配列は開いたときにアドレスバーの ?k= の投稿を拡大モーダルで開くので、共有リンクと同じ流れに乗せる
      // （開く前に拡大モーダルの投稿を決めても、みんなの配列を開いたときに閉じられてしまう）
      setUrlKeymapId(row.id)
      useSwitchStore.getState().closeDetail()
      setView('feed')
      return
    }
    setOpening(row.id)
    setError(null)
    try {
      const [item] = await fetchKeymapsByIds([row.id])
      if (!item) {
        setError('投稿が見つかりませんでした（削除された可能性があります）')
        return
      }
      useFeedStore.getState().openViewer(item)
      useSwitchStore.getState().closeDetail()
    } catch (e) {
      setError(`投稿を開けませんでした: ${errorMessage(e)}`)
    } finally {
      setOpening(null)
    }
  }

  if (error) return <p className="text-[0.74rem] font-bold" style={{ color: 'var(--color-pink)' }}>{error}</p>
  if (!rows) {
    return (
      <p className="flex items-center gap-2 text-[0.76rem] font-bold opacity-60">
        <Ring size={13} /> 読み込み中…
      </p>
    )
  }
  if (rows.length === 0) {
    return <p className="text-[0.76rem] font-bold opacity-60">まだありません。投稿するときにこのスイッチを添えると、ここに並びます。</p>
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className="nb-btn w-full !justify-start !gap-2 !py-1.5 !px-2 text-left"
            disabled={opening !== null}
            onClick={() => void open(row)}
          >
            <Avatar url={row.avatar_url} name={row.author} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8rem] font-black">{row.name}</span>
              <span className="block truncate text-[0.66rem] font-bold opacity-60">
                {row.author} ・ {relativeTime(row.created_at)}
              </span>
            </span>
            {opening === row.id && <Ring size={14} />}
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------------------------------------- スペックのタグ */

function TagBody({ id, keyboardId }: { id: SpecTagId; keyboardId?: string }) {
  const editing = useKeymapStore((s) => keyboardOf(s.keymap))
  const tag = getSpecTag(id)

  // どのキーボードのタグから開いたか。そのキーボードでの補足（「Glow モデル」など）があれば出す
  const board = keyboardId ? resolveFinderKeyboard(keyboardId, editing) : null
  const boardTag = board && board.id === keyboardId ? keyboardSpecOf(board).tags.find((t) => t.id === id) : undefined

  const mountDef = tag.mount ? getMount(tag.mount) : null
  const switches = tag.mount ? KEYSWITCHES.filter((sw) => sw.mount === tag.mount) : []
  const boards = BUILTIN_KEYBOARDS.filter((def) => keyboardSpecOf(def).tags.some((t) => t.id === id))

  return (
    <div className="space-y-4">
      {tag.en && <p className="nb-eyebrow">{tag.en}</p>}
      <p className="text-[0.84rem] font-bold leading-relaxed">{tag.detail}</p>
      {board && boardTag?.note && (
        <p className="nb nb-flat p-2.5 text-[0.78rem] font-bold" style={{ background: 'var(--color-sand)' }}>
          {board.name} では: {boardTag.note}
        </p>
      )}

      {mountDef && tag.mount && (
        <>
          <Section title="キーキャップと高さ">
            <p className="text-[0.76rem] font-bold">
              {mountDef.profile === 'low' ? 'ロープロファイル（薄型）' : '標準の高さ'} ・ キーキャップ:{' '}
              {mountDef.stem ? STEM_LABEL[mountDef.stem] : 'まだ公表されていません'}
            </p>
          </Section>
          <Section title="挿さるソケット">
            <MountSockets mount={tag.mount} />
          </Section>
          <Section title={`この形のスイッチ（${switches.length} 種）`}>
            <div className="flex flex-wrap gap-1.5">
              {switches.map((sw) => <SwitchChip key={sw.id} sw={sw} />)}
            </div>
          </Section>
        </>
      )}

      {boards.length > 0 && (
        <Section title="このタグが付いた組み込みのキーボード">
          <div className="flex flex-wrap gap-1.5">
            {boards.map((def) => (
              <button
                key={def.id}
                type="button"
                className="nb-chip"
                style={{ background: 'var(--color-sand)', cursor: 'pointer' }}
                onClick={() => showInFinder({ keyboardId: def.id })}
              >
                ⌨ {def.name}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function MountSockets({ mount }: { mount: SwitchMount }) {
  const sockets = socketsForMount(mount)
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {sockets.map((s) => <SocketChip key={s.id} id={s.id} note={socketFit(s.id, mount)?.note} />)}
      </div>
      {sockets.some((s) => socketFit(s.id, mount)?.note) && (
        <ul className="space-y-0.5 text-[0.7rem] font-bold opacity-70">
          {sockets.filter((s) => socketFit(s.id, mount)?.note).map((s) => (
            <li key={s.id}>＊ {s.short}: {socketFit(s.id, mount)?.note}</li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- ソケット */

function SocketBody({ id }: { id: SocketId }) {
  const socket = getSocket(id)
  const fitMounts = MOUNTS.filter((m) => socketFit(id, m.id))
  const otherMounts = MOUNTS.filter((m) => !socketFit(id, m.id))
  const switches = KEYSWITCHES.filter((sw) => socketFit(id, sw.mount))
  const boards = builtinBoardsWhere((s) => s === id)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="nb-chip" style={{ background: socket.hotswap ? 'var(--color-lime)' : 'var(--color-paper)' }}>
          {socket.hotswap ? 'ホットスワップ（挿すだけ）' : 'はんだ付け'}
        </span>
      </div>
      <p className="text-[0.84rem] font-bold leading-relaxed">{socket.desc}</p>

      <Section title="挿さるスイッチの形">
        <ul className="space-y-1">
          {fitMounts.map((m) => {
            const note = socketFit(id, m.id)?.note
            return (
              <li key={m.id} className="text-[0.78rem] font-bold">
                <span className="mr-1" aria-hidden>{note ? '△' : '◯'}</span>
                {m.label}
                {note && <span className="block pl-4 text-[0.7rem] opacity-70">{note}</span>}
              </li>
            )
          })}
        </ul>
        <p className="text-[0.72rem] font-bold opacity-60">
          挿さらない: {otherMounts.map((m) => m.label).join('・')}
        </p>
      </Section>

      {socket.cautions.length > 0 && (
        <Section title="気をつけること">
          <ul className="list-disc space-y-1 pl-5 text-[0.76rem] font-bold leading-relaxed opacity-80">
            {socket.cautions.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </Section>
      )}

      <Section title={`ハマるスイッチ（カタログの ${switches.length} 種）`}>
        <div className="flex flex-wrap gap-1.5">
          {switches.map((sw) => <SwitchChip key={sw.id} sw={sw} />)}
        </div>
        <button
          type="button"
          className="nb-btn !py-1.5 text-[0.76rem]"
          onClick={() => showInFinder({ socket: id })}
        >
          一覧で見る（種類で絞り込める）
        </button>
      </Section>

      {boards.length > 0 && (
        <Section title="このソケットの組み込みキーボード">
          <BoardChips boards={boards} />
        </Section>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- キーボード */

function KeyboardBody({ def }: { def: KeyboardDefinition }) {
  const [edition, setEdition] = useState(0)
  const editing = useKeymapStore((s) => keyboardOf(s.keymap))
  // キースイッチの画面で開けるのは、組み込みのキーボードと編集中のキーボードだけ
  const canFind = isBuiltinKeyboard(def.id) || def.id === editing.id

  return (
    <div className="space-y-4">
      <p className="text-[0.74rem] font-bold opacity-65">
        {[def.maker, `${def.keys.length} キー`].filter(Boolean).join(' ・ ')}
      </p>
      <KeyboardSpecCard def={def} edition={edition} onEdition={setEdition} />
      {canFind && (
        <button
          type="button"
          className="nb-btn w-full !py-2 text-[0.82rem]"
          style={{ background: 'var(--color-lime)' }}
          onClick={() => showInFinder({ keyboardId: def.id, edition })}
        >
          このキーボードに合うスイッチを探す
        </button>
      )}
    </div>
  )
}
