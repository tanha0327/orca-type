import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { targetTitle } from '../Inspector/Inspector'
import { getSensor, type KeyId } from '../../data/layout'
import {
  LAYER_COLOR_HEX, PAD_SLOT_LABEL,
  type Binding, type EncoderSlot, type PadSlot,
} from '../../data/types'
import { engine } from '../../engine/useEngine'
import { getBinding, useKeymapStore, type BindingTarget } from '../../store/keymapStore'
import { BindingSlot, KeycodePicker } from '../Picker/KeycodePicker'

export type SensorMenuId = 'enc-l' | 'pad-l' | 'pad-r'

/** クイック編集メニューの対象。キー 1 つ、またはエンコーダー／スクロールパッド 1 つ（全スロット） */
export type BoardMenuTarget =
  | { kind: 'key'; keyId: KeyId }
  | { kind: 'sensor'; sensor: SensorMenuId }

interface SlotRow {
  label: string
  target: BindingTarget
  onTry: () => void
}

/** メニュー幅に収まる短い呼び名（横向きのホイールなので左右で呼ぶ） */
const ENCODER_MENU_LABEL: Record<EncoderSlot, string> = {
  ccw: '左に回す',
  cw: '右に回す',
}

/** 読む順（左→右、上→下）に並べたセンサーのスロット */
function sensorRows(sensor: SensorMenuId): SlotRow[] {
  if (sensor === 'enc-l') {
    return (['ccw', 'cw'] as EncoderSlot[]).map((slot) => ({
      label: ENCODER_MENU_LABEL[slot],
      target: { kind: 'encoder', slot },
      onTry: () => engine.encoder(slot),
    }))
  }
  return (['up', 'tap', 'down'] as PadSlot[]).map((slot) => ({
    label: PAD_SLOT_LABEL[slot],
    target: { kind: 'pad', sensor, slot },
    onTry: () => engine.pad(sensor, slot),
  }))
}

interface Picking {
  target: BindingTarget
  slot: 'tap' | 'hold'
  label: string
}

/**
 * 盤面のキー・エンコーダー・スクロールパッドをクリックした直後、その真下に出すクイック編集メニュー。
 * キーは単押し／長押し、センサーは回転・スワイプ・タップの各スロットを編集できる。
 */
export function KeyMenu({
  target, anchorRect, onClose,
}: {
  target: BoardMenuTarget
  anchorRect: DOMRect
  onClose: () => void
}) {
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const setTap = useKeymapStore((s) => s.setTap)
  const setHold = useKeymapStore((s) => s.setHold)
  const [picking, setPicking] = useState<Picking | null>(null)

  const layer = keymap.layers[editingLayer]
  const hex = LAYER_COLOR_HEX[layer?.color ?? 'gray']
  const bindingOf = (t: BindingTarget): Binding => getBinding(keymap, editingLayer, t) ?? { tap: 'TRANS' }

  const keyTarget: BindingTarget | null = target.kind === 'key' ? { kind: 'key', keyId: target.keyId } : null
  const keyHold = keyTarget ? bindingOf(keyTarget).hold : undefined

  const header = target.kind === 'key'
    ? targetTitle({ kind: 'key', keyId: target.keyId })
    : {
        title: getSensor(target.sensor).name,
        sub: target.sensor === 'enc-l' ? '左右に回したときの出力' : 'スワイプ・タップしたときの出力',
      }
  const width = target.kind === 'key' ? 232 : 300

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && picking === null) onClose() }
    const onPointerDown = (e: PointerEvent) => {
      const el = document.getElementById('key-menu-popover')
      if (el && !el.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // クリックした直後の同じイベントで即閉じないよう、次のティックから拾う
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onPointerDown, true), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(id)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [onClose, picking])

  const pick = (code: string) => {
    if (!picking) return
    if (picking.slot === 'tap') setTap(editingLayer, picking.target, code)
    else setHold(editingLayer, picking.target, code === 'NONE' ? undefined : code)
    setPicking(null)
  }

  const tapSlot = (row: { label: string; target: BindingTarget }, tone: string) => {
    const b = bindingOf(row.target)
    return (
      <BindingSlot
        label={row.label}
        code={b.tap === 'TRANS' ? undefined : b.tap}
        tone={tone}
        onClick={() => setPicking({ target: row.target, slot: 'tap', label: row.label })}
        onClear={b.tap !== 'TRANS' ? () => setTap(editingLayer, row.target, 'TRANS') : undefined}
      />
    )
  }

  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - width - 8)
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 8)
  const pickingBinding = picking ? bindingOf(picking.target) : undefined

  return createPortal(
    <div
      id="key-menu-popover"
      className="nb nb-lg fixed z-50 overflow-hidden"
      style={{ left, top, width, background: 'var(--color-paper)' }}
    >
      <header
        className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-2"
        style={{ background: hex }}
      >
        <div className="min-w-0 flex-1">
          <p className="nb-eyebrow !text-[0.6rem] !opacity-80">L{editingLayer} {layer?.name}</p>
          <h3 className="truncate text-[0.9rem] leading-tight">{header.title}</h3>
          {header.sub && <p className="truncate text-[0.65rem] font-bold opacity-75">{header.sub}</p>}
        </div>
        {target.kind === 'key' && (
          <button
            type="button"
            className="nb-btn shrink-0 !p-1.5 text-[0.7rem]"
            onClick={() => engine.pulse(target.keyId)}
            aria-label="試し打ち"
          >
            ▶
          </button>
        )}
        <button
          type="button"
          className="nb-btn shrink-0 !p-1.5 text-[0.7rem]"
          onClick={onClose}
          aria-label="閉じる"
        >
          ✕
        </button>
      </header>

      {keyTarget ? (
        <div className="space-y-2 p-2">
          {tapSlot({ label: '単押し（TAP）', target: keyTarget }, hex)}
          <BindingSlot
            label="長押し（HOLD）"
            code={keyHold}
            tone="var(--color-pink)"
            onClick={() => setPicking({ target: keyTarget, slot: 'hold', label: '長押し（HOLD）' })}
            onClear={keyHold && keyHold !== 'NONE' ? () => setHold(editingLayer, keyTarget, undefined) : undefined}
          />
        </div>
      ) : target.kind === 'sensor' && (
        <div className="space-y-2 p-2">
          {sensorRows(target.sensor).map((row) => (
            <div key={row.label} className="flex items-stretch gap-1.5">
              <div className="min-w-0 flex-1">{tapSlot(row, hex)}</div>
              <button
                type="button"
                className="nb-btn shrink-0 !px-2.5 text-[0.72rem]"
                onClick={row.onTry}
                aria-label={`${row.label}を試す`}
                title="試し撃ち"
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      )}

      <KeycodePicker
        open={picking !== null}
        title={picking ? `${picking.label} に割り当てる` : ''}
        value={picking?.slot === 'hold' ? pickingBinding?.hold : pickingBinding?.tap}
        allowNone={picking?.slot === 'hold'}
        onPick={pick}
        onClose={() => setPicking(null)}
      />
    </div>,
    document.body,
  )
}
