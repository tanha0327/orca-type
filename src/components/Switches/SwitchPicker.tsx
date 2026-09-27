import { useState } from 'react'
import {
  clipByWidth, getSwitch, KEYSWITCHES, pickLabel, pickOf, PICK_CHIP_WIDTH, samePick, socketFit, stemColorOf, switchesOf, SWITCH_TYPE_LABEL,
  type KeySwitch,
} from '../../data/switches'
import { MAX_SWITCH_PICKS, SWITCH_NAME_MAX, type SwitchPick } from '../../data/types'
import { keyboardOf } from '../../keyboards/registry'
import { keyboardSockets, keyboardSpecOf } from '../../keyboards/specs'
import { useKeymapStore } from '../../store/keymapStore'
import { useSwitchStore } from '../../store/switchStore'
import { StemSwatch } from './SwitchParts'

/** 候補に出す数の上限（名前で探しているとき） */
const MAX_SUGGESTIONS = 24

/**
 * 投稿画面の「使っているキースイッチ」。編集中の配列のスイッチ（キースイッチの画面の「使っている」と同じもの）を直接編集する。
 * 何も打っていないときは、このキーボードのソケットに合うスイッチを候補に出す。
 * カタログに無いスイッチは、打った名前のまま添えられる
 */
export function SwitchPicker() {
  const keymap = useKeymapStore((s) => s.keymap)
  const setSwitches = useKeymapStore((s) => s.setSwitches)
  const openDetail = useSwitchStore((s) => s.openDetail)
  const [query, setQuery] = useState('')

  const picks = switchesOf(keymap)
  const full = picks.length >= MAX_SWITCH_PICKS
  const board = keyboardOf(keymap)
  const sockets = keyboardSockets(keyboardSpecOf(board))

  const q = query.trim().toLowerCase()
  const notPicked = (sw: KeySwitch) => !picks.some((p) => samePick(p, pickOf(sw)))
  const suggestions = KEYSWITCHES.filter(notPicked).filter((sw) => (
    q
      ? `${sw.name} ${sw.maker}`.toLowerCase().includes(q)
      // ソケットが分からない（取り込んだ）キーボードでは全部を候補にする
      : sockets.length === 0 || sockets.some((s) => socketFit(s, sw.mount))
  )).slice(0, q ? MAX_SUGGESTIONS : undefined)
  // カタログにちょうど同じ名前が無ければ、打った名前のまま添えられるようにする（もう添えてある名前は除く）
  const typed: SwitchPick = { name: query.trim().replace(/\s+/g, ' ').slice(0, SWITCH_NAME_MAX) }
  const custom = q && !KEYSWITCHES.some((sw) => sw.name.toLowerCase() === q) && !picks.some((p) => samePick(p, typed))
    ? typed
    : null

  const add = (pick: SwitchPick) => {
    if (full || picks.some((p) => samePick(p, pick))) return
    setSwitches([...picks, pick])
    setQuery('')
  }
  const remove = (pick: SwitchPick) => setSwitches(picks.filter((p) => !samePick(p, pick)))

  return (
    <div>
      <span className="nb-eyebrow">キースイッチ（任意）</span>
      <p className="mt-0.5 text-[0.7rem] font-bold leading-relaxed opacity-60">
        使っているスイッチを {MAX_SWITCH_PICKS} つまで添えられます。キースイッチの画面の「使っている」と同じもので、
        {board.name} の配列に覚えておきます。
      </p>

      {picks.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="添えるキースイッチ">
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
                    <button type="button" className="underline decoration-dotted" onClick={() => openDetail({ kind: 'switch', id: sw.id })}>
                      {pickLabel(pick)}
                    </button>
                  )
                  : <span title={pick.name}>{clipByWidth(pick.name, PICK_CHIP_WIDTH)}</span>}
                <button
                  type="button"
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem]"
                  style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}
                  aria-label={`${pickLabel(pick)} を外す`}
                  onClick={() => remove(pick)}
                >
                  ✕
                </button>
              </span>
            )
          })}
        </div>
      )}

      {full
        ? <p className="mt-1.5 text-[0.7rem] font-bold opacity-60">{MAX_SWITCH_PICKS} つ選びました。変えるときは ✕ で外してください。</p>
        : (
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
            <div className="mt-1.5 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto p-0.5">
              {!q && sockets.length > 0 && (
                <span className="w-full text-[0.66rem] font-bold opacity-55">{board.name} のソケットに合うもの</span>
              )}
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
        )}
    </div>
  )
}
