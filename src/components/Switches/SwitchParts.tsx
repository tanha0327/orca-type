import type { ReactNode } from 'react'
import {
  DEFAULT_HOUSING_COLOR, LOW_CHOC_STEM_PATH, LOW_CROSS_STEM_PATH, LOW_HOUSING_PATH, MX_HOUSING_PATH, MX_STEM_PATH,
} from '../../data/switchSilhouette'
import {
  clipByWidth, FORCE_FEEL_LABEL, forceFeel, getMount, getSocket, getSwitch, pickLabel, PICK_CHIP_WIDTH, stemColorOf,
  switchSoundQuery, switchSoundUrl, SWITCH_TYPE_HELP, SWITCH_TYPE_LABEL,
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

/**
 * キースイッチを正面から見たイラスト（プロフィールのサンプルアイコンと同じ描き方）。
 * 軸はそのスイッチの色で塗り、ハウジングを太い線・軸を細い線で描く。
 * ロープロファイルは背の低い形（同じ縮尺で描くので、並べると背の低さがそのまま見える）で、Choc V1 は 2 本足の軸
 */
export function SwitchVisual({ sw, className, sameFrame = false }: {
  sw: KeySwitch
  className?: string
  /** 一般的な高さのスイッチと同じ枠・同じ足の位置で描く（背の高さを見比べるとき） */
  sameFrame?: boolean
}) {
  const mount = getMount(sw.mount)
  const low = mount.profile === 'low'
  const stem = !low ? MX_STEM_PATH : mount.stem === 'choc' ? LOW_CHOC_STEM_PATH : LOW_CROSS_STEM_PATH
  return (
    // ロープロファイルは、縮尺は同じまま見る範囲だけずらして上下の中央に置く（背の低さはそのまま見える）
    <svg viewBox={low && !sameFrame ? '8 15.5 48 48' : '8 8 48 48'} className={className} aria-hidden="true">
      <path
        d={low ? LOW_HOUSING_PATH : MX_HOUSING_PATH}
        fill={sw.housingColor ?? DEFAULT_HOUSING_COLOR}
        stroke="#111111"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d={stem} fill={stemColorOf(sw)} stroke="#111111" strokeWidth={0.8} strokeLinejoin="round" />
    </svg>
  )
}

/** 一般的な高さ（MX）のスイッチの点線の輪郭。ロープロファイルのスイッチと背の高さを見比べる見本 */
export function StandardSwitchOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="8 8 48 48" className={className} aria-hidden="true">
      <path d={MX_HOUSING_PATH} fill="none" stroke="#111111" strokeWidth={1.2} strokeDasharray="2.4 1.8" strokeLinejoin="round" opacity={0.5} />
      <path d={MX_STEM_PATH} fill="none" stroke="#111111" strokeWidth={0.8} strokeDasharray="1.8 1.4" strokeLinejoin="round" opacity={0.5} />
    </svg>
  )
}

/** ロープロファイル（背の低い）スイッチのチップ */
export function LowProfileChip() {
  return (
    <span
      className="nb-chip"
      style={{ background: 'var(--color-cyan)' }}
      title="背の低い（薄い）スイッチ。キーボード全体を薄くでき、手首を反らさずに打てる"
    >
      ロープロファイル
    </span>
  )
}

/** 押下圧のメーターの両端（gf）。いちばん軽い Choc Pink（20gf）から、重めのタクタイル（67gf）までが収まる幅 */
const FORCE_METER_MIN = 15
const FORCE_METER_MAX = 70

/** 押下圧。数値と「軽め・ふつう・重め」の目安と、軽い ← → 重いのメーター */
export function ForceMeter({ gf }: { gf?: number }) {
  if (gf === undefined) {
    return (
      <span className="flex items-baseline justify-between gap-1" title="メーカーがまだ押下圧を公表していません">
        <span className="text-[0.66rem] font-bold opacity-60">押下圧</span>
        <span className="text-[0.74rem] font-black opacity-60">公表待ち</span>
      </span>
    )
  }
  const ratio = Math.min(1, Math.max(0.06, (gf - FORCE_METER_MIN) / (FORCE_METER_MAX - FORCE_METER_MIN)))
  const feel = FORCE_FEEL_LABEL[forceFeel(gf)]
  return (
    <span className="block" title={`押下圧 ${gf}gf（${feel}）: キーが反応する点での重さ`}>
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-[0.66rem] font-bold">
          <span className="opacity-60">押下圧</span> <span className="nb-chip !px-1.5 !py-0 !text-[0.58rem]" style={{ background: 'var(--color-paper)' }}>{feel}</span>
        </span>
        <span className="shrink-0 font-mono font-black leading-none">
          <span className="text-[1.2rem]">{gf}</span>
          <span className="text-[0.68rem]">gf</span>
        </span>
      </span>
      <span
        className="mt-1 block h-2.5 overflow-hidden rounded-full"
        style={{ border: '2px solid var(--color-ink)', background: 'var(--color-paper)' }}
        role="meter"
        aria-label="押下圧"
        aria-valuemin={FORCE_METER_MIN}
        aria-valuemax={FORCE_METER_MAX}
        aria-valuenow={gf}
        aria-valuetext={`${gf}gf（${feel}）`}
      >
        <span className="block h-full" style={{ width: `${ratio * 100}%`, background: 'var(--color-ink)' }} />
      </span>
    </span>
  )
}

/** 打鍵音を聞けるページへのリンク（新しいタブ）。個別のページが無いスイッチは YouTube の検索結果 */
export function SwitchSoundLink({ sw, className, children }: { sw: KeySwitch; className?: string; children?: ReactNode }) {
  const title = sw.soundUrl
    ? `${sw.name} の打鍵音のページを開きます（新しいタブ）`
    : `YouTube で「${switchSoundQuery(sw)}」を探します（新しいタブ）`
  return (
    <a href={switchSoundUrl(sw)} target="_blank" rel="noopener noreferrer" className={className} title={title}>
      {children ?? <>🔊 打鍵音を聞く <span aria-hidden>↗</span></>}
    </a>
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
  def, spec = keyboardSpecOf(def), edition, onEdition, showEditions = true,
}: {
  def: KeyboardDefinition
  spec?: KeyboardSpec
  /** 選んでいる版の番号 */
  edition: number
  onEdition: (n: number) => void
  /** 版・キットの切り替えを出すか（キースイッチの画面では、スイッチの一覧の上に出すので出さない） */
  showEditions?: boolean
}) {
  const current = spec.editions[edition] ?? spec.editions[0]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" aria-label={`${def.name} のスペック`}>
        {spec.tags.map((tag) => <SpecTagChip key={tag.id} tag={tag} keyboardId={def.id} />)}
      </div>
      <p className="text-[0.66rem] font-bold opacity-55">タグを押すと説明が出ます。＊ はこのキーボードでの補足があるもの。</p>

      {showEditions && spec.editions.length > 1 && (
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
