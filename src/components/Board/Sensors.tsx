import { useCallback, useEffect, useRef, useState } from 'react'
import { getKeycode } from '../../data/keycodes'
import type { SensorDef } from '../../data/layout'
import {
  TRACKBALL_COLOR_DARK, TRACKBALL_COLOR_GRADIENT,
  type BodyColor, type EncoderSlot, type PadSlot, type TrackballColor,
} from '../../data/types'

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
   実機は横向きのホイールなので、左右ドラッグ・横スクロール・← → で回す。
   縦ホイールしかないマウスでも回せるよう、縦スクロールも受け付ける。
   ================================================================ */
export function EncoderView({
  def, geo, selected, glyphs, color = 'white', onSlot, onSelect, interactive = true,
}: {
  def: SensorDef
  geo: Geo
  selected: boolean
  glyphs: Record<EncoderSlot, string>
  color?: BodyColor
  onSlot: (slot: EncoderSlot) => void
  /** クリック（ドラッグせずに離した）で呼ぶ。rect は編集メニューを出す位置 */
  onSelect: (slot: EncoderSlot, rect: DOMRect) => void
  interactive?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const accum = useRef(0)
  const dragging = useRef(false)
  const lastX = useRef(0)
  const dragDistance = useRef(0)
  const [spin, setSpin] = useState(0)
  const [, mid] = TRACKBALL_COLOR_GRADIENT[color]
  const knurlColor = TRACKBALL_COLOR_DARK[color] ? 'var(--color-paper)' : 'var(--color-ink)'

  // 右へ回す = 時計回り (cw)、左へ回す = 反時計回り (ccw)
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

  // React の onWheel は passive なので preventDefault が効かず、回すたびにページもスクロールしてしまう。
  // ネイティブのリスナーを passive: false で付ける
  useEffect(() => {
    const el = rootRef.current
    if (!el || !interactive) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      feed(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [feed, interactive])

  return (
    <div
      ref={rootRef}
      {...inertProps(interactive, '左ロータリーエンコーダー')}
      title="左右ドラッグ／ホイールで回す・クリックで割当を編集"
      className="absolute touch-none"
      style={{ ...place(def, geo), cursor: interactive ? 'ew-resize' : 'default', pointerEvents: interactive ? undefined : 'none' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
        dragging.current = true
        dragDistance.current = 0
        lastX.current = e.clientX
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        const dx = e.clientX - lastX.current
        dragDistance.current += Math.abs(dx)
        feed(dx)
        lastX.current = e.clientX
      }}
      onPointerUp={(e) => {
        if (!dragging.current) return
        dragging.current = false
        // 回すためにドラッグしたときは編集メニューを出さない
        if (dragDistance.current < 4) onSelect('cw', e.currentTarget.getBoundingClientRect())
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect('cw', e.currentTarget.getBoundingClientRect())
          return
        }
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (!dir) return
        // ← → はレイヤー切替のショートカットでもあるので、ホイールを操作中はそちらに流さない
        e.preventDefault()
        e.stopPropagation()
        step(dir)
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          border: `${selected ? 3.5 : 2.5}px solid var(--color-ink)`,
          borderRadius: 'clamp(4px, 1.2cqw, 9px)',
          background: mid,
          boxShadow: '2px 2px 0 var(--color-ink)',
        }}
      >
        {/* ローレット（刻み）。横に転がるので刻みは縦線で、回すと左右に流れる */}
        <div
          className="absolute inset-y-0"
          style={{
            left: '-5px',
            right: '-5px',
            backgroundImage:
              `repeating-linear-gradient(to right, ${knurlColor} 0 1.5px, transparent 1.5px 5px)`,
            transform: `translateX(${spin % 5}px)`,
            opacity: 0.75,
          }}
        />
        {/* 円筒の左右の端に影を落として、横向きのホイールに見せる */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #0007 0%, #0000 28%, #0000 72%, #0007 100%)' }}
        />
      </div>
      {/* 回転方向の割当を脇に出す（左に回す／右に回す の並び） */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-black"
        style={{ top: '104%', fontSize: 'clamp(5px, 2cqw, 9px)' }}
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
  def, geo, selectedSlot, glyphs, color = 'white', onSlot, onSelect, interactive = true,
}: {
  def: SensorDef
  geo: Geo
  selectedSlot: PadSlot | null
  glyphs: Record<PadSlot, string>
  color?: BodyColor
  onSlot: (slot: PadSlot) => void
  /** rect は編集メニューを出す位置 */
  onSelect: (slot: PadSlot, rect: DOMRect) => void
  interactive?: boolean
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const accum = useRef(0)
  const [flash, setFlash] = useState(0)
  const [, mid] = TRACKBALL_COLOR_GRADIENT[color]
  const dark = TRACKBALL_COLOR_DARK[color]
  const dotColor = dark ? 'var(--color-paper)' : 'var(--color-ink)'

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
      title="上下ドラッグでスワイプ・クリックでタップ（割当の編集メニューも開く）"
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
        const rect = e.currentTarget.getBoundingClientRect()
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= 10) {
          // 横方向が主な動きなら（左右スワイプは実機にないので）何もしない
          if (Math.abs(dy) >= Math.abs(dx)) {
            const slot: PadSlot = dy > 0 ? 'down' : 'up'
            onSelect(slot, rect)
            fire(slot)
          }
          return
        }
        onSelect('tap', rect)
        fire('tap')
      }}
    >
      <div
        key={flash}
        className="relative h-full w-full overflow-hidden"
        style={{
          border: `${selectedSlot ? 3.5 : 2.5}px solid var(--color-ink)`,
          borderRadius: 'clamp(5px, 1.5cqw, 11px)',
          background: mid,
          boxShadow: '2px 2px 0 var(--color-ink)',
          animation: flash ? 'orca-ring 420ms ease-out' : undefined,
        }}
      >
        {/* 写真のドットテクスチャ */}
        <div
          className="absolute inset-[10%]"
          style={{
            backgroundImage: `radial-gradient(${dotColor} 38%, transparent 40%)`,
            backgroundSize: 'clamp(4px, 1.4cqw, 8px) clamp(4px, 1.4cqw, 8px)',
            opacity: 0.55,
          }}
        />
        {/* 割当の表示 */}
        <div className="absolute inset-0 flex flex-col items-center justify-between" style={{ padding: '6% 2%' }}>
          <PadTag glyph={glyphs.up} active={selectedSlot === 'up'} dark={dark} />
          <PadTag glyph={glyphs.tap} active={selectedSlot === 'tap'} dark={dark} />
          <PadTag glyph={glyphs.down} active={selectedSlot === 'down'} dark={dark} />
        </div>
      </div>
    </div>
  )
}

function PadTag({ glyph, active, dark }: { glyph: string; active: boolean; dark: boolean }) {
  if (!glyph) return <span style={{ fontSize: 'clamp(5px, 1.8cqw, 8px)' }} />
  return (
    <span
      className="whitespace-nowrap rounded-full px-[0.3em] font-black leading-tight"
      style={{
        fontSize: 'clamp(5px, 2.1cqw, 9px)',
        color: active ? 'var(--color-ink)' : dark ? 'var(--color-paper)' : 'var(--color-ink)',
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
  def, geo, selected, onSelect, dpi, color = 'white', interactive = true,
}: {
  def: SensorDef
  geo: Geo
  selected: boolean
  onSelect: () => void
  dpi: number
  color?: TrackballColor
  interactive?: boolean
}) {
  const [nudge, setNudge] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const [hi, mid, lo] = TRACKBALL_COLOR_GRADIENT[color]

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
          background: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${mid} 42%, ${lo} 100%)`,
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
