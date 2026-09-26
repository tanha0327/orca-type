import type React from 'react'
import { getKeycode } from '../../data/keycodes'
import type { Binding } from '../../data/types'
import type { PressView } from '../../engine/KeyEngine'
import { keyRotation, placeRect, u, type Bounds } from '../../keyboards/geometry'
import type { KeyDef } from '../../keyboards/types'

export interface KeyCapProps {
  keyDef: KeyDef
  /** 盤面の外形。キーの位置を % に直すのに使う */
  bounds: Bounds
  binding: Binding | undefined
  /** 下のレイヤーから落ちてきた（このレイヤーでは透過）割当か */
  inherited: boolean
  selected: boolean
  /** 選択中の縁の色（既定は黒。コンボの参加キー選択中は紫にする） */
  selectedTone?: string
  /** 他のキーを選択中で、このキーは選択されていない（少しグレーを重ねて目立たなくする） */
  dimmed?: boolean
  /** 比較プレビューで、もう一方のキーマップとこのキーの割当が違う */
  diff?: boolean
  /** キーボード本体の色がブラックのとき true。キーキャップの地色と文字色を反転する */
  dark?: boolean
  /** 本体色とは別の色のキーキャップ（esc の交換用キーキャップなど）。未指定なら本体色に従う */
  capTone?: CapTone
  press?: PressView
  comboCount: number
  /** 編集中レイヤーの色 */
  accent: string
  /** 重ね印字（写真の赤／緑のサブ表記） */
  subLegends?: { glyph: string; color: string }[]
  /** false なら読み取り専用（HUD のミニキーマップ）。支援技術からも隠す */
  interactive?: boolean
  onSelect: (e: React.MouseEvent<HTMLElement>) => void
  onPulse: () => void
}

export interface CapTone {
  face: string
  text: string
  border: string
}

export function KeyCap({
  keyDef, bounds, binding, inherited, selected, selectedTone, dimmed, diff, dark, capTone, press, comboCount, accent,
  subLegends, interactive = true, onSelect, onPulse,
}: KeyCapProps) {
  const kc = getKeycode(binding?.tap)
  const hold = binding?.hold ? getKeycode(binding.hold) : undefined
  const isDown = !!press
  const isHeld = press?.state === 'hold'
  const awaiting = press?.awaitingHold ?? false

  // 本体色に応じて、キーキャップの地色・縁・文字色を反転する
  const faceDefault = capTone?.face ?? (dark ? 'var(--color-ink)' : 'var(--color-paper)')
  const borderDefault = capTone?.border ?? (dark ? 'var(--color-paper)' : 'var(--color-ink)')
  const textDefault = capTone?.text ?? (dark ? 'var(--color-paper)' : 'var(--color-ink)')
  const selectedBorder = selectedTone ?? borderDefault
  // esc のように本体と別色のキーキャップは、選択中も色を変えない（選択は太い縁と影で示す）
  const selectedFace = capTone
    ? capTone.face
    : dark
      ? 'color-mix(in srgb, var(--color-ink) 55%, #000)'
      : 'color-mix(in srgb, var(--color-paper) 70%, #fff)'
  const diffFace = dark
    ? 'color-mix(in srgb, var(--color-pink) 28%, var(--color-ink))'
    : 'color-mix(in srgb, var(--color-pink) 20%, var(--color-paper))'

  const label = kc.code === 'NONE' ? '' : kc.label || kc.code
  // 文字数でフォントを落とす。fn2 のような 3 文字が折り返さないようにする
  const mainFontSize =
    label.length <= 2 ? `clamp(9px, ${u(0.32)}, 21px)`
      : label.length === 3 ? `clamp(7px, ${u(0.245)}, 16px)`
        : `clamp(6px, ${u(0.18)}, 13px)`

  const Tag = interactive ? 'button' : 'div'
  const interactiveProps = interactive
    ? {
        type: 'button' as const,
        'aria-label': `${keyDef.id} ${kc.name}`,
        onClick: (e: React.MouseEvent<HTMLElement>) => { onSelect(e); if (e.altKey) onPulse() },
        onDoubleClick: onPulse,
      }
    : { 'aria-hidden': true }

  return (
    <Tag
      {...interactiveProps}
      className="absolute select-none"
      style={{
        ...placeRect(keyDef, bounds),
        ...keyRotation(keyDef),
        padding: u(0.0125),
      }}
    >
      <span
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{
          // HUD の中では周囲の文字色が paper なので、明示的に戻す
          // （キーキャップは常に本体色の面なので、継承すると文字が消える）
          color: textDefault,
          border: `${selected ? 3.5 : diff ? 3 : 2.5}px solid ${
            selected ? selectedBorder : diff ? 'var(--color-pink)' : borderDefault
          }`,
          borderRadius: `clamp(5px, ${u(0.105)}, 11px)`,
          background: isDown
            ? accent
            : selected
              ? selectedFace
              : diff
                ? diffFace
                : faceDefault,
          boxShadow: isDown
            ? 'none'
            : `${selected ? 3 : 2}px ${selected ? 3 : 2}px 0 ${
              selected ? (selectedTone ?? 'var(--color-ink)') : diff ? 'var(--color-pink)' : 'var(--color-ink)'
            }`,
          transform: isDown ? 'translate(2px, 2px)' : 'none',
          transition: 'transform 60ms ease, box-shadow 60ms ease, background 90ms ease',
          opacity: inherited && !isDown ? 0.5 : 1,
        }}
      >
        {/* Shift 時の表記（写真の "& 7" のような小さい肩文字） */}
        {kc.shifted && (
          <span
            className="absolute font-black leading-none opacity-45"
            style={{ top: '6%', right: '9%', fontSize: `clamp(6px, ${u(0.16)}, 11px)` }}
          >
            {kc.shifted}
          </span>
        )}

        {/* 主表記 */}
        <span
          className="whitespace-nowrap font-black leading-none"
          style={{
            fontSize: mainFontSize,
            letterSpacing: '-0.02em',
            marginTop: subLegends?.length ? '-6%' : 0,
          }}
        >
          {label}
        </span>

        {/* 長押し（MOD-TAP）— キーキャップには現れない情報なので必ず出す。
            重ね印字（JKL などの下側の赤／緑サブ表記）とかぶらないよう、キーキャップの上側に出す */}
        {hold && hold.code !== 'NONE' && (
          <span
            className="absolute font-black leading-none"
            style={{
              top: '6%',
              left: '50%',
              transform: 'translateX(-50%)',
              color: isDown ? 'var(--color-ink)' : 'var(--color-pink)',
              fontSize: `clamp(6px, ${u(0.168)}, 11px)`,
              opacity: isHeld ? 1 : 0.9,
            }}
          >
            {hold.modSymbol ?? hold.label}
          </span>
        )}

        {/* 他レイヤーの重ね印字（実機の赤／緑サブ印字の再現）。長押しがあっても消さない */}
        {subLegends && subLegends.length > 0 && (
          <span
            className="absolute flex items-center gap-[0.35em] font-black leading-none"
            style={{ bottom: '7%', fontSize: `clamp(5px, ${u(0.154)}, 10px)` }}
          >
            {subLegends.map((s, i) => (
              <span key={i} style={{ color: s.color }}>{s.glyph}</span>
            ))}
          </span>
        )}

        {/* コンボ参加マーク */}
        {comboCount > 0 && (
          <span
            className="absolute rounded-full"
            style={{
              top: '8%', left: '9%',
              width: `clamp(3px, ${u(0.09)}, 6px)`, height: `clamp(3px, ${u(0.09)}, 6px)`,
              background: 'var(--color-purple)',
              border: '1px solid var(--color-ink)',
            }}
          />
        )}

        {/* 長押し判定までの進行バー */}
        {awaiting && press && (
          <span
            key={press.downAt}
            className="absolute bottom-0 left-0 h-[3px]"
            style={{
              background: 'var(--color-ink)',
              animation: `orca-term ${press.termMs}ms linear forwards`,
            }}
          />
        )}

        {/* 他のキーを選択中：このキーを少しグレーで覆って目立たなくする */}
        {dimmed && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'color-mix(in srgb, var(--color-ink) 40%, transparent)',
              transition: 'background 120ms ease',
            }}
          />
        )}
      </span>
    </Tag>
  )
}
