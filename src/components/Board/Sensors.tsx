import { useCallback, useRef, useState } from 'react'
import { getKeycode } from '../../data/keycodes'
import type { SensorDef } from '../../data/layout'
import type { EncoderSlot, PadSlot } from '../../data/types'

interface Geo { totalW: number; totalH: number }

/** 表示専用のときは、操作も支援技術への露出も止める */
function inertProps(interactive: boolean, label: string) {
  return interactive
    ? { role: 'button' as const, tabIndex: 0, 'aria-label': label }
    : { 'aria-hidden': true as const }
}

function place(def: SensorDef, { totalW, totalH }: Geo) {
  return {
    left: `${(def.x / totalW) * 100}%`,
    top: `${(def.y / totalH) * 100}%`,
    width: `${(def.w / totalW) * 100}%`,
    height: `${(def.h / totalH) * 100}%`,
  }
}

/* ================================================================
   ロータリーエンコーダー（左）
   ホイール操作・上下ドラッグで回転。
   ================================================================ */
export function EncoderView({
  def, geo, selected, glyphs, onSlot, onSelect, interactive = true,
}: {
  def: SensorDef
  geo: Geo
  selected: boolean
  glyphs: Record<EncoderSlot, string>
  onSlot: (slot: EncoderSlot) => void
  onSelect: (slot: EncoderSlot) => void
  interactive?: boolean
}) {
  const accum = useRef(0)
  const dragging = useRef(false)
  const lastY = useRef(0)
  const [spin, setSpin] = useState(0)

  const step = useCallback((dir: 1 | -1) => {
    setSpin((v) => v + dir * 18)
    onSlot(dir > 0 ? 'cw' : 'ccw')
  }, [onSlot])

  const feed = useCallback((delta: number) => {
    accum.current += delta
    while (Math.abs(accum.current) >= 22) {
      const dir: 1 | -1 = accum.current > 0 ? 1 : -1
      accum.current -= dir * 22
      step(dir)
    }
  }, [step])

  return (
    <div
      {...inertProps(interactive, '左ロータリーエンコーダー')}
      title="ホイール／上下ドラッグで回す・クリックで選択"
      className="absolute touch-none"
      style={{ ...place(def, geo), cursor: interactive ? 'ns-resize' : 'default', pointerEvents: interactive ? undefined : 'none' }}
      onWheel={(e) => { e.preventDefault(); feed(e.deltaY) }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
        dragging.current = true
        lastY.current = e.clientY
        onSelect('cw')
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        feed(e.clientY - lastY.current)
        lastY.current = e.clientY
      }}
      onPointerUp={() => { dragging.current = false }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
        if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          border: `${selected ? 3.5 : 2.5}px solid var(--color-ink)`,
          borderRadius: 'clamp(4px, 1.2cqw, 9px)',
          background: 'var(--color-ink)',
          boxShadow: '2px 2px 0 var(--color-ink)',
        }}
      >
        {/* ローレット（刻み） */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, var(--color-paper) 0 1.5px, transparent 1.5px 5px)',
            transform: `translateY(${spin % 5}px)`,
            opacity: 0.75,
          }}
        />
        <div className="absolute inset-x-0 top-0 h-[22%]" style={{ background: 'linear-gradient(#0000 0%, #0008 100%)' }} />
      </div>
      {/* 回転方向の割当を脇に出す */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-black"
        style={{ top: '102%', fontSize: 'clamp(5px, 2cqw, 9px)' }}
      >
        <span style={{ color: 'var(--color-pink)' }}>↺{glyphs.ccw}</span>
        <span className="opacity-30"> / </span>
        <span style={{ color: 'var(--color-purple)' }}>↻{glyphs.cw}</span>
      </div>
    </div>
  )
}

/* ================================================================
   スクロールパッド（左右）
   上下ドラッグ／ホイールでスワイプ、クリックでタップ。
   ================================================================ */
export function PadView({
  def, geo, selectedSlot, glyphs, onSlot, onSelect, interactive = true,
}: {
  def: SensorDef
  geo: Geo
  selectedSlot: PadSlot | null
  glyphs: Record<PadSlot, string>
  onSlot: (slot: PadSlot) => void
  onSelect: (slot: PadSlot) => void
  interactive?: boolean
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const accum = useRef(0)
  const [flash, setFlash] = useState(0)

  const fire = (slot: PadSlot) => {
    setFlash((v) => v + 1)
    onSlot(slot)
  }

  const feedWheel = (dy: number) => {
    accum.current += dy
    while (Math.abs(accum.current) >= 40) {
      const dir = accum.current > 0 ? 1 : -1
      accum.current -= dir * 40
      fire(dir > 0 ? 'down' : 'up')
    }
  }

  const label = def.id === 'pad-l' ? '左パッド' : '右パッド'

  return (
    <div
      {...inertProps(interactive, `${label}（スワイプ）`)}
      title="上下ドラッグでスワイプ・クリックでタップ"
      className="absolute touch-none"
      style={{ ...place(def, geo), pointerEvents: interactive ? undefined : 'none' }}
      onWheel={(e) => { e.preventDefault(); feedWheel(e.deltaY) }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const s = start.current
        start.current = null
        if (!s) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= 10) {
          // 横方向が主な動きなら（左右スワイプは実機にないので）何もしない
          if (Math.abs(dy) >= Math.abs(dx)) {
            const slot: PadSlot = dy > 0 ? 'down' : 'up'
            onSelect(slot)
            fire(slot)
          }
          return
        }
        onSelect('tap')
        fire('tap')
      }}
    >
      <div
        key={flash}
        className="relative h-full w-full overflow-hidden"
        style={{
          border: `${selectedSlot ? 3.5 : 2.5}px solid var(--color-ink)`,
          borderRadius: 'clamp(5px, 1.5cqw, 11px)',
          background: 'var(--color-ink)',
          boxShadow: '2px 2px 0 var(--color-ink)',
          animation: flash ? 'orca-ring 420ms ease-out' : undefined,
        }}
      >
        {/* 写真のドットテクスチャ */}
        <div
          className="absolute inset-[10%]"
          style={{
            backgroundImage: 'radial-gradient(var(--color-paper) 38%, transparent 40%)',
            backgroundSize: 'clamp(4px, 1.4cqw, 8px) clamp(4px, 1.4cqw, 8px)',
            opacity: 0.55,
          }}
        />
        {/* 割当の表示 */}
        <div className="absolute inset-0 flex flex-col items-center justify-between" style={{ padding: '6% 2%' }}>
          <PadTag glyph={glyphs.up} active={selectedSlot === 'up'} />
          <PadTag glyph={glyphs.tap} active={selectedSlot === 'tap'} />
          <PadTag glyph={glyphs.down} active={selectedSlot === 'down'} />
        </div>
      </div>
    </div>
  )
}

function PadTag({ glyph, active }: { glyph: string; active: boolean }) {
  if (!glyph) return <span style={{ fontSize: 'clamp(5px, 1.8cqw, 8px)' }} />
  return (
    <span
      className="whitespace-nowrap rounded-full px-[0.3em] font-black leading-tight"
      style={{
        fontSize: 'clamp(5px, 2.1cqw, 9px)',
        color: active ? 'var(--color-ink)' : 'var(--color-paper)',
        background: active ? 'var(--color-lime)' : 'transparent',
      }}
    >
      {glyph}
    </span>
  )
}

/* ================================================================
   トラックボール（右・19mm）
   ================================================================ */
export function BallView({
  def, geo, selected, onSelect, dpi, interactive = true,
}: {
  def: SensorDef
  geo: Geo
  selected: boolean
  onSelect: () => void
  dpi: number
  interactive?: boolean
}) {
  const [nudge, setNudge] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)

  return (
    <div
      {...inertProps(interactive, '19mm トラックボール')}
      title="ドラッグで転がす・クリックで設定"
      className="absolute touch-none"
      style={{ ...place(def, geo), cursor: interactive ? 'grab' : 'default', pointerEvents: interactive ? undefined : 'none' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
        dragging.current = true
        onSelect()
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        setNudge((n) => ({
          x: Math.max(-4, Math.min(4, n.x + e.movementX * 0.25)),
          y: Math.max(-4, Math.min(4, n.y + e.movementY * 0.25)),
        }))
      }}
      onPointerUp={() => { dragging.current = false; setNudge({ x: 0, y: 0 }) }}
    >
      <div
        className="relative h-full w-full rounded-full"
        style={{
          border: `${selected ? 3.5 : 2.5}px solid var(--color-ink)`,
          background: 'radial-gradient(circle at 32% 28%, #ff8a9b 0%, #d21f3c 42%, #6d0f1f 100%)',
          boxShadow: selected ? '3px 3px 0 var(--color-ink)' : '2px 2px 0 var(--color-ink)',
          transform: `translate(${nudge.x}px, ${nudge.y}px)`,
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            top: '18%', left: '22%', width: '22%', height: '18%',
            background: '#fff', opacity: 0.65, filter: 'blur(1px)',
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-black opacity-60"
        style={{ top: '102%', fontSize: 'clamp(5px, 1.9cqw, 9px)' }}
      >
        {dpi} DPI
      </div>
    </div>
  )
}

export function sensorGlyph(code: string | undefined): string {
  const kc = getKeycode(code)
  return kc.code === 'NONE' || kc.code === 'TRANS' ? '' : kc.label || kc.code
}
