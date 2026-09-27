import {
  clipByWidth, getSocket, getSwitch, pickLabel, PICK_CHIP_WIDTH, stemColorOf, SWITCH_TYPE_HELP, SWITCH_TYPE_LABEL,
  type KeySwitch, type SocketId, type SwitchType,
} from '../../data/switches'
import type { SwitchPick } from '../../data/types'
import {
  getSpecTag, keyboardSpecOf, SPEC_TAG_GROUP_COLOR,
  type KeyboardSpec, type SpecTag,
} from '../../keyboards/specs'
import type { KeyboardDefinition } from '../../keyboards/types'
import { playSwitchSound, unlockAudio } from '../../lib/switchSound'
import { useSwitchStore } from '../../store/switchStore'

/* キースイッチの画面・詳細のシート・みんなの配列で共通に使う部品 */

/** 軸の色の小さな四角（スイッチを真上から見たときの軸の色） */
export function StemSwatch({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[3px]"
      style={{ width: size, height: size, background: color, border: '2px solid var(--color-ink)' }}
    />
  )
}

/** 種類（リニア・タクタイル・クリッキー）と静音のチップ */
export function SwitchTypeChips({ sw }: { sw: KeySwitch }) {
  return (
    <>
      <span className="nb-chip" style={{ background: 'var(--color-paper)' }} title={SWITCH_TYPE_HELP[sw.type]}>
        {SWITCH_TYPE_LABEL[sw.type]}
      </span>
      {sw.silent && (
        <span className="nb-chip" style={{ background: 'var(--color-paper)' }} title="ダンパー入りで、底打ちと戻りの音が小さい">
          静音
        </span>
      )}
    </>
  )
}

/** キーボードのスペックのタグ。押すと説明のシートが開く。そのキーボードでの補足があれば ＊ を付ける */
export function SpecTagChip({ tag, keyboardId }: { tag: SpecTag; keyboardId?: string }) {
  const openDetail = useSwitchStore((s) => s.openDetail)
  const def = getSpecTag(tag.id)
  return (
    <button
      type="button"
      className="nb-chip"
      style={{ background: SPEC_TAG_GROUP_COLOR[def.group], cursor: 'pointer' }}
      title={tag.note ? `${def.label}（${tag.note}）` : def.en ?? def.label}
      onClick={() => openDetail({ kind: 'tag', id: tag.id, keyboardId })}
    >
      {def.label}
      {tag.note && <span aria-hidden className="opacity-60">＊</span>}
    </button>
  )
}

/** ソケットのチップ。押すとソケットの説明（挿さるスイッチ）のシートが開く */
export function SocketChip({ id, note }: { id: SocketId; note?: string }) {
  const openDetail = useSwitchStore((s) => s.openDetail)
  const socket = getSocket(id)
  return (
    <button
      type="button"
      className="nb-chip"
      style={{ background: 'var(--color-lime)', cursor: 'pointer' }}
      title={note ? `${socket.label}（${note}）` : socket.label}
      onClick={() => openDetail({ kind: 'socket', id })}
    >
      🔌 {socket.short}
      {note && <span aria-hidden className="opacity-60">＊</span>}
    </button>
  )
}

/** カタログのスイッチのチップ。押すとスイッチの詳細が開く */
export function SwitchChip({ sw }: { sw: KeySwitch }) {
  const openDetail = useSwitchStore((s) => s.openDetail)
  return (
    <button
      type="button"
      className="nb-chip"
      style={{ background: 'var(--color-paper)', cursor: 'pointer' }}
      title={`${sw.name}（${SWITCH_TYPE_LABEL[sw.type]}）`}
      onClick={() => openDetail({ kind: 'switch', id: sw.id })}
    >
      <StemSwatch color={stemColorOf(sw)} size={10} />
      {sw.name}
    </button>
  )
}

/**
 * 投稿に添えられたキースイッチ。カタログにあるものは押すと詳細が開く。
 * カタログに無いもの（手で入力した名前）は、押せない灰色の見本で出す
 */
export function SwitchPickChips({ picks }: { picks: readonly SwitchPick[] }) {
  const openDetail = useSwitchStore((s) => s.openDetail)
  if (picks.length === 0) return null
  return (
    <>
      {picks.map((pick) => {
        const sw = getSwitch(pick.id)
        if (!sw) {
          return (
            <span
              key={pick.name}
              className="nb-chip"
              style={{ background: 'var(--color-paper)' }}
              title={`キースイッチ: ${pick.name}（カタログに無いもの）`}
            >
              <StemSwatch color="var(--color-gray)" size={10} />
              {clipByWidth(pick.name, PICK_CHIP_WIDTH)}
            </span>
          )
        }
        return (
          <button
            key={sw.id}
            type="button"
            className="nb-chip"
            style={{ background: 'var(--color-paper)', cursor: 'pointer' }}
            title={`キースイッチ: ${sw.name}（${SWITCH_TYPE_LABEL[sw.type]}）`}
            onClick={() => openDetail({ kind: 'switch', id: sw.id })}
          >
            <StemSwatch color={stemColorOf(sw)} size={10} />
            {clipByWidth(pickLabel(pick), PICK_CHIP_WIDTH)}
            <span className="opacity-60">{SWITCH_TYPE_LABEL[sw.type]}</span>
          </button>
        )
      })}
    </>
  )
}

/** その種類の打鍵音（シンセサイザーで作ったイメージ）を 1 回鳴らす */
export function previewSwitchSound(type: SwitchType, volume: number) {
  // クリック（ユーザー操作）の中で AudioContext を起こし、起きてから鳴らす
  unlockAudio()
  window.setTimeout(() => {
    playSwitchSound('down', type, volume)
    window.setTimeout(() => playSwitchSound('up', type, volume), 90)
  }, 30)
}

/**
 * キーボードのスペック。タグ・版ごとのソケット・補足・出典。
 * キースイッチの画面と、投稿の「⌨ キーボード名」から開く詳細のシートで使う
 */
export function KeyboardSpecCard({
  def, spec = keyboardSpecOf(def), edition, onEdition,
}: {
  def: KeyboardDefinition
  spec?: KeyboardSpec
  /** 選んでいる版の番号 */
  edition: number
  onEdition: (n: number) => void
}) {
  const current = spec.editions[edition] ?? spec.editions[0]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" aria-label={`${def.name} のスペック`}>
        {spec.tags.map((tag) => <SpecTagChip key={tag.id} tag={tag} keyboardId={def.id} />)}
      </div>
      <p className="text-[0.66rem] font-bold opacity-55">タグを押すと説明が出ます。＊ はこのキーボードでの補足があるもの。</p>

      {spec.editions.length > 1 && (
        <div>
          <p className="nb-eyebrow">版・キット（使えるスイッチが変わる）</p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="版・キット">
            {spec.editions.map((e, i) => (
              <button
                key={e.name}
                type="button"
                role="radio"
                aria-checked={e === current}
                className="nb-btn !py-1 !px-2.5 text-[0.74rem]"
                data-active={e === current}
                onClick={() => onEdition(i)}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div className="nb nb-flat space-y-1.5 p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.74rem] font-black">
              {spec.editions.length > 1 ? `${current.name} のソケット` : 'ソケット'}
            </span>
            {current.sockets.map((ref) => <SocketChip key={ref.id} id={ref.id} note={ref.note} />)}
          </div>
          {current.sockets.some((ref) => ref.note) && (
            <ul className="space-y-0.5 text-[0.7rem] font-bold opacity-70">
              {current.sockets.filter((ref) => ref.note).map((ref) => (
                <li key={ref.id}>＊ {getSocket(ref.id).short}: {ref.note}</li>
              ))}
            </ul>
          )}
          {current.note && <p className="text-[0.72rem] font-bold leading-relaxed opacity-75">{current.note}</p>}
        </div>
      )}

      {spec.note && <p className="text-[0.72rem] font-bold leading-relaxed opacity-70">{spec.note}</p>}

      {spec.sources.length > 0 && (
        <p className="text-[0.66rem] font-bold leading-relaxed opacity-60">
          調べた資料:{' '}
          {spec.sources.map((src, i) => (
            <span key={src.url}>
              {i > 0 && ' ・ '}
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline">{src.label}</a>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
