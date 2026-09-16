import type React from 'react'
import { getKeycode } from '../../data/keycodes'
import type { KeyDef } from '../../data/layout'
import type { Binding } from '../../data/types'
import type { PressView } from '../../engine/KeyEngine'

export interface KeyCapProps {
  keyDef: KeyDef
  binding: Binding | undefined
  /** 下のレイヤーから落ちてきた（このレイヤーでは透過）割当か */
  inherited: boolean
  selected: boolean
  press?: PressView
  comboCount: number
  /** 編集中レイヤーの色 */
  accent: string
  /** 重ね印字（写真の赤／緑のサブ表記） */
  subLegends?: { glyph: string; color: string }[]
  /** false なら読み取り専用（HUD のミニキーマップ）。支援技術からも隠す */
  interactive?: boolean
  totalW: number
  totalH: number
  onSelect: () => void
  onPulse: () => void
}

export function KeyCap({
  keyDef, binding, inherited, selected, press, comboCount, accent,
  subLegends, interactive = true, totalW, totalH, onSelect, onPulse,
}: KeyCapProps) {
  const kc = getKeycode(binding?.tap)
  const hold = binding?.hold ? getKeycode(binding.hold) : undefined
  const isDown = !!press
  const isHeld = press?.state === 'hold'
  const awaiting = press?.awaitingHold ?? false

  const label = kc.code === 'NONE' ? '' : kc.label || kc.code
  // 文字数でフォントを落とす。fn2 のような 3 文字が折り返さないようにする
  const mainFontSize =
    label.length <= 2 ? 'clamp(9px, 4.6cqw, 21px)'
      : label.length === 3 ? 'clamp(7px, 3.5cqw, 16px)'
        : 'clamp(6px, 2.6cqw, 13px)'

  const Tag = interactive ? 'button' : 'div'
  const interactiveProps = interactive
    ? {
        type: 'button' as const,
        'aria-label': `${keyDef.id} ${kc.name}`,
        onClick: (e: React.MouseEvent) => { onSelect(); if (e.altKey) onPulse() },
        onDoubleClick: onPulse,
      }
    : { 'aria-hidden': true }

  return (
    <Tag
      {...interactiveProps}
      className="absolute select-none"
      style={{
        left: `${(keyDef.x / totalW) * 100}%`,
        top: `${(keyDef.y / totalH) * 100}%`,
        width: `${(keyDef.w / totalW) * 100}%`,
        height: `${(keyDef.h / totalH) * 100}%`,
        padding: '0.18cqw',
      }}
    >
      <span
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{
          // HUD の中では周囲の文字色が paper なので、明示的に ink に戻す
          // （キーキャップは常に明るい面なので、継承すると文字が消える）
          color: 'var(--color-ink)',
          border: `${selected ? 3.5 : 2.5}px solid var(--color-ink)`,
          borderRadius: 'clamp(5px, 1.5cqw, 11px)',
          background: isDown
            ? accent
            : selected
              ? 'color-mix(in srgb, var(--color-paper) 70%, #fff)'
              : keyDef.accent
                ? 'var(--color-orange)'
                : 'var(--color-paper)',
          boxShadow: isDown ? 'none' : `${selected ? 3 : 2}px ${selected ? 3 : 2}px 0 var(--color-ink)`,
          transform: isDown ? 'translate(2px, 2px)' : 'none',
          transition: 'transform 60ms ease, box-shadow 60ms ease, background 90ms ease',
          opacity: inherited && !isDown ? 0.5 : 1,
        }}
      >
        {/* Shift 時の表記（写真の "& 7" のような小さい肩文字） */}
        {kc.shifted && (
          <span
            className="absolute font-black leading-none opacity-45"
            style={{ top: '6%', right: '9%', fontSize: 'clamp(6px, 2.3cqw, 11px)' }}
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
            marginTop: hold || subLegends?.length ? '-6%' : 0,
          }}
        >
          {label}
        </span>

        {/* 長押し（MOD-TAP）— キーキャップには現れない情報なので必ず出す */}
        {hold && hold.code !== 'NONE' && (
          <span
            className="absolute font-black leading-none"
            style={{
              bottom: '7%',
              color: isDown ? 'var(--color-ink)' : 'var(--color-pink)',
              fontSize: 'clamp(6px, 2.4cqw, 11px)',
              opacity: isHeld ? 1 : 0.9,
            }}
          >
            {hold.modSymbol ?? hold.label}
          </span>
        )}

        {/* 他レイヤーの重ね印字（実機の赤／緑サブ印字の再現） */}
        {!hold && subLegends && subLegends.length > 0 && (
          <span
            className="absolute flex items-center gap-[0.35em] font-black leading-none"
            style={{ bottom: '7%', fontSize: 'clamp(5px, 2.2cqw, 10px)' }}
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
              width: 'clamp(3px, 1.3cqw, 6px)', height: 'clamp(3px, 1.3cqw, 6px)',
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
      </span>
    </Tag>
  )
}
