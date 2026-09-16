import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CATEGORY_LABEL, CATEGORY_ORDER, CODE_TO_KEYCODE, getKeycode, searchKeycodes,
  type Keycode, type KeycodeCategory,
} from '../../data/keycodes'

export interface KeycodePickerProps {
  open: boolean
  title: string
  value?: Keycode
  /** 「割当を外す」を出すか */
  allowNone?: boolean
  onPick: (code: Keycode) => void
  onClose: () => void
}

export function KeycodePicker({ open, title, value, allowNone, onPick, onClose }: KeycodePickerProps) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<KeycodeCategory | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCat(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      // 検索欄に入力中は普通にタイプさせる。それ以外では、押した物理キーで直接選ぶ
      if (e.repeat || e.target === inputRef.current) return
      const mapped = CODE_TO_KEYCODE[e.code]
      if (mapped) { e.preventDefault(); onPick(mapped) }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [open, onClose, onPick])

  const results = useMemo(
    () => (open ? searchKeycodes(query, cat ?? undefined) : []),
    [open, query, cat],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'color-mix(in srgb, var(--color-ink) 45%, transparent)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="nb nb-lg flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        <header className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3">
          <h3 className="min-w-0 flex-1 truncate text-[1.05rem]">{title}</h3>
          {allowNone && (
            <button type="button" className="nb-btn !py-1.5 text-[0.78rem]" onClick={() => onPick('NONE')}>
              割当を外す
            </button>
          )}
          <button type="button" className="nb-btn !py-1.5 !px-3 text-[0.9rem]" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>

        <div className="border-b-[3px] border-[var(--color-ink)] p-3">
          <input
            ref={inputRef}
            className="nb-input"
            placeholder="キーコードを検索（例: おんりょう / vol / shift / MO）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="mt-1.5 text-[0.68rem] font-bold leading-relaxed opacity-55">
            手元のキーボードのキーを押しても選べます（この検索欄に入力中は無効）
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <CatChip label="すべて" active={cat === null} onClick={() => setCat(null)} />
            {CATEGORY_ORDER.map((c) => (
              <CatChip key={c} label={CATEGORY_LABEL[c]} active={cat === c} onClick={() => setCat(c)} />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {results.length === 0 ? (
            <p className="py-8 text-center text-[0.9rem] font-bold opacity-60">
              該当するキーコードがありません
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((d) => {
                const selected = d.code === value
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => onPick(d.code)}
                    className="nb-btn !items-start !justify-start !p-2 text-left"
                    style={selected ? { background: 'var(--color-lime)' } : undefined}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-[1rem] font-black leading-none">
                        {d.label || d.code}
                        {d.shifted && <span className="ml-1 text-[0.7rem] opacity-50">{d.shifted}</span>}
                      </span>
                      <span className="truncate text-[0.68rem] font-bold leading-tight opacity-70">
                        {d.name}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nb-chip"
      aria-pressed={active}
      style={{
        background: active ? 'var(--color-ink)' : 'transparent',
        color: active ? 'var(--color-paper)' : 'inherit',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

/** 割当を 1 枠ぶん表示するボタン。Inspector / コンボ編集で使い回す */
export function BindingSlot({
  label, code, tone, onClick, onClear,
}: {
  label: string
  code: Keycode | undefined
  tone?: string
  onClick: () => void
  onClear?: () => void
}) {
  const kc = getKeycode(code)
  const empty = !code || kc.code === 'NONE'
  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className="nb-btn !min-h-[3.1rem] !flex-1 !items-center !justify-start !gap-2.5 !p-2"
      >
        <span
          className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-[8px] px-1.5 font-mono text-[0.95rem] font-black"
          style={{ background: tone ?? 'var(--color-sand)', border: '3px solid var(--color-ink)' }}
        >
          {empty ? '—' : kc.label || kc.code}
        </span>
        <span className="flex min-w-0 flex-col text-left">
          <span className="nb-eyebrow !text-[0.6rem]">{label}</span>
          <span className="truncate text-[0.82rem] font-black leading-tight">
            {empty ? '未設定' : kc.name}
          </span>
        </span>
      </button>
      {onClear && !empty && (
        <button type="button" className="nb-btn !px-2.5" onClick={onClear} aria-label={`${label}を外す`}>
          ✕
        </button>
      )}
    </div>
  )
}
