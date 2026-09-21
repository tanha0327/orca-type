import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { targetTitle } from '../Inspector/Inspector'
import { type KeyId } from '../../data/layout'
import { LAYER_COLOR_HEX, type Binding } from '../../data/types'
import { engine } from '../../engine/useEngine'
import { getBinding, useKeymapStore } from '../../store/keymapStore'
import { BindingSlot, KeycodePicker } from '../Picker/KeycodePicker'

type Slot = 'tap' | 'hold'

const MENU_WIDTH = 232

/** 盤面のキーをクリックした直後、その真下に出す単押し／長押しのクイック編集メニュー */
export function KeyMenu({
  keyId, anchorRect, onClose,
}: {
  keyId: KeyId
  anchorRect: DOMRect
  onClose: () => void
}) {
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const setTap = useKeymapStore((s) => s.setTap)
  const setHold = useKeymapStore((s) => s.setHold)
  const [picking, setPicking] = useState<Slot | null>(null)

  const target = { kind: 'key' as const, keyId }
  const binding: Binding = getBinding(keymap, editingLayer, target) ?? { tap: 'TRANS' }
  const layer = keymap.layers[editingLayer]
  const hex = LAYER_COLOR_HEX[layer?.color ?? 'gray']
  const { title, sub } = targetTitle(target)
  const hasHold = !!binding.hold && binding.hold !== 'NONE'

  const slotLabel: Record<Slot, string> = {
    tap: '単押し（TAP）',
    hold: '長押し（HOLD）',
  }

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
    if (picking === 'tap') setTap(editingLayer, target, code)
    else if (picking === 'hold') setHold(editingLayer, target, code === 'NONE' ? undefined : code)
    setPicking(null)
  }

  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 8)

  return createPortal(
    <div
      id="key-menu-popover"
      className="nb nb-lg fixed z-50 overflow-hidden"
      style={{ left, top, width: MENU_WIDTH, background: 'var(--color-paper)' }}
    >
      <header
        className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-2"
        style={{ background: hex }}
      >
        <div className="min-w-0 flex-1">
          <p className="nb-eyebrow !text-[0.6rem] !opacity-80">L{editingLayer} {layer?.name}</p>
          <h3 className="truncate text-[0.9rem] leading-tight">{title}</h3>
          {sub && <p className="truncate text-[0.65rem] font-bold opacity-75">{sub}</p>}
        </div>
        <button
          type="button"
          className="nb-btn shrink-0 !p-1.5 text-[0.7rem]"
          onClick={() => engine.pulse(keyId)}
          aria-label="試し打ち"
        >
          ▶
        </button>
        <button
          type="button"
          className="nb-btn shrink-0 !p-1.5 text-[0.7rem]"
          onClick={onClose}
          aria-label="閉じる"
        >
          ✕
        </button>
      </header>

      <div className="space-y-2 p-2">
        <BindingSlot
          label={slotLabel.tap}
          code={binding.tap === 'TRANS' ? undefined : binding.tap}
          tone={hex}
          onClick={() => setPicking('tap')}
          onClear={binding.tap !== 'TRANS' ? () => setTap(editingLayer, target, 'TRANS') : undefined}
        />
        <BindingSlot
          label={slotLabel.hold}
          code={binding.hold}
          tone="var(--color-pink)"
          onClick={() => setPicking('hold')}
          onClear={hasHold ? () => setHold(editingLayer, target, undefined) : undefined}
        />
      </div>

      <KeycodePicker
        open={picking !== null}
        title={picking ? `${slotLabel[picking]} に割り当てる` : ''}
        value={picking === 'tap' ? binding.tap : binding.hold}
        allowNone={picking === 'hold'}
        onPick={pick}
        onClose={() => setPicking(null)}
      />
    </div>,
    document.body,
  )
}
