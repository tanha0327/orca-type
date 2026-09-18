import { useMemo, useState } from 'react'
import { getKeycode } from '../../data/keycodes'
import { getKey, KEYS } from '../../data/layout'
import {
  ENCODER_SLOT_GLYPH, ENCODER_SLOT_LABEL, FLAVOR_HELP, FLAVOR_LABEL,
  LAYER_COLOR_HEX, PAD_SLOT_GLYPH, PAD_SLOT_LABEL,
  type Binding, type Flavor,
} from '../../data/types'
import { engine } from '../../engine/useEngine'
import { resolveKey } from '../../engine/resolve'
import {
  getBinding, sameTarget, useKeymapStore, type BindingTarget,
} from '../../store/keymapStore'
import { BindingSlot, KeycodePicker } from '../Picker/KeycodePicker'
import { ComboEditor } from '../Combos/ComboEditor'
import { TrackballPanel } from './TrackballPanel'

type Slot = 'tap' | 'hold'

export function Inspector() {
  const selection = useKeymapStore((s) => s.selection)
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)

  const body = selection?.kind === 'ball'
    ? <TrackballPanel />
    : selection?.kind === 'combo'
      ? (() => {
          const combo = keymap.combos.find((c) => c.id === selection.comboId)
          return combo ? <ComboEditor combo={combo} /> : <EmptyState />
        })()
      : selection
        ? <BindingInspector target={selection} layerId={editingLayer} />
        : <EmptyState />

  return (
    <div className="space-y-2">
      <KeyListPicker />
      {body}
    </div>
  )
}

/** 編集したいキーを、盤面をクリックせずに検索して選べるリスト */
function KeyListPicker() {
  const selection = useKeymapStore((s) => s.selection)
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const select = useKeymapStore((s) => s.select)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return KEYS.filter((k) => {
      if (!q) return true
      const label = getKeycode(resolveKey(keymap, [0, editingLayer], k.id).binding.tap).label
      return k.id.toLowerCase().includes(q) || label.toLowerCase().includes(q)
    })
  }, [query, keymap, editingLayer])

  return (
    <div className="nb shrink-0 p-2.5">
      <button
        type="button"
        className="nb-btn w-full !py-1.5 text-[0.78rem]"
        data-active={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '閉じる' : 'リストからキーを選ぶ'}
      </button>
      {open && (
        <>
          <input
            className="nb-input mt-2 !py-1.5 text-[0.82rem]"
            placeholder="キーを検索（例: Q / shift）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="mt-1.5 grid max-h-40 grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-6">
            {results.map((k) => {
              const g = getKeycode(resolveKey(keymap, [0, editingLayer], k.id).binding.tap)
              const active = sameTarget(selection, { kind: 'key', keyId: k.id })
              return (
                <button
                  key={k.id}
                  type="button"
                  className="nb-chip !justify-center"
                  style={{ background: active ? 'var(--color-lime)' : 'transparent', cursor: 'pointer' }}
                  onClick={() => { select({ kind: 'key', keyId: k.id }); setOpen(false); setQuery('') }}
                >
                  {g.label || k.id}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="nb nb-lg flex flex-col gap-2 p-5 text-center">
      <p className="text-[2rem] leading-none">👆</p>
      <h3 className="text-[1.05rem]">編集したいところを選ぶ</h3>
      <p className="text-[0.82rem] font-bold leading-relaxed opacity-70">
        盤面のキー・ロータリーエンコーダー・スクロールパッド・トラックボールをクリックするか、
        上の「リストからキーを選ぶ」で検索すると、
        ここで<strong>単押し</strong>と<strong>長押し（MOD-TAP）</strong>を編集できます。
      </p>
      <p className="text-[0.75rem] font-bold leading-relaxed opacity-50">
        キーをダブルクリックすると、その場で試し打ちできます。
      </p>
    </div>
  )
}

function targetTitle(target: BindingTarget): { title: string; sub: string } {
  switch (target.kind) {
    case 'key': {
      const k = getKey(target.keyId)
      return {
        title: `キー ${target.keyId}`,
        sub: k ? `${k.half === 'L' ? '左' : '右'}手 / ${k.kind === 'thumb' ? '親指' : `${k.row + 1} 段 ${k.col + 1} 列`}` : '',
      }
    }
    case 'encoder':
      return { title: ENCODER_SLOT_LABEL[target.slot], sub: '左ロータリーエンコーダー' }
    case 'pad':
      return {
        title: PAD_SLOT_LABEL[target.slot],
        sub: target.sensor === 'pad-l' ? '左スクロールパッド' : '右スクロールパッド',
      }
    default:
      return { title: '', sub: '' }
  }
}

function BindingInspector({ target, layerId }: { target: BindingTarget; layerId: number }) {
  const keymap = useKeymapStore((s) => s.keymap)
  const setTap = useKeymapStore((s) => s.setTap)
  const setHold = useKeymapStore((s) => s.setHold)
  const patchBinding = useKeymapStore((s) => s.patchBinding)
  const [picking, setPicking] = useState<Slot | null>(null)

  const binding: Binding = getBinding(keymap, layerId, target) ?? { tap: 'TRANS' }
  const layer = keymap.layers[layerId]
  const hex = LAYER_COLOR_HEX[layer?.color ?? 'gray']
  const { title, sub } = targetTitle(target)
  const isTrans = binding.tap === 'TRANS'
  const term = binding.tappingTermMs ?? keymap.settings.tappingTermMs
  const flavor: Flavor = binding.flavor ?? keymap.settings.flavor
  const hasHold = !!binding.hold && binding.hold !== 'NONE'

  const slotLabel: Record<Slot, string> = {
    tap: '単押し（TAP）',
    hold: '長押し（HOLD）',
  }

  const pick = (code: string) => {
    if (picking === 'tap') setTap(layerId, target, code)
    else if (picking === 'hold') setHold(layerId, target, code === 'NONE' ? undefined : code)
    setPicking(null)
  }

  return (
    <div className="nb nb-lg overflow-hidden">
      <header
        className="flex items-center gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
        style={{ background: hex }}
      >
        <div className="min-w-0 flex-1">
          <p className="nb-eyebrow !opacity-80">L{layerId} {layer?.name}</p>
          <h3 className="truncate text-[1.15rem]">{title}</h3>
          {sub && <p className="truncate text-[0.72rem] font-bold opacity-75">{sub}</p>}
        </div>
        {target.kind === 'key' && (
          <button
            type="button"
            className="nb-btn shrink-0 !py-1.5 text-[0.78rem]"
            onClick={() => engine.pulse(target.keyId)}
          >
            試し打ち
          </button>
        )}
      </header>

      <div className="space-y-4 p-3">
        {isTrans && (
          <div
            className="nb nb-flat p-2.5 text-[0.76rem] font-bold leading-relaxed"
            style={{ background: 'color-mix(in srgb, var(--color-sand) 55%, var(--color-paper))' }}
          >
            このレイヤーでは<strong>透過</strong>です。下のレイヤーの割当がそのまま使われます。
            単押しを設定すると、このレイヤー専用の割当になります。
          </div>
        )}

        <BindingSlot
          label={slotLabel.tap}
          code={binding.tap === 'TRANS' ? undefined : binding.tap}
          tone={hex}
          onClick={() => setPicking('tap')}
          onClear={binding.tap !== 'TRANS' ? () => setTap(layerId, target, 'TRANS') : undefined}
        />

        <div>
          <BindingSlot
            label={slotLabel.hold}
            code={binding.hold}
            tone="var(--color-pink)"
            onClick={() => setPicking('hold')}
            onClear={hasHold ? () => setHold(layerId, target, undefined) : undefined}
          />
          <p className="mt-1.5 text-[0.7rem] font-bold leading-relaxed opacity-60">
            長押しを設定すると <strong>MOD-TAP</strong> になります。
            短く押せば単押しの出力、押し続ければ長押しの出力（Shift やレイヤー）になります。
          </p>
        </div>

        {hasHold && (
          <div className="nb nb-flat space-y-3 p-3">
            <p className="nb-eyebrow">長押しの判定</p>

            <label className="block">
              <span className="flex items-baseline justify-between text-[0.78rem] font-black">
                タッピングターム
                <span className="font-mono">{term} ms</span>
              </span>
              <input
                type="range"
                min={80}
                max={500}
                step={10}
                value={term}
                className="mt-1 w-full accent-[var(--color-ink)]"
                onChange={(e) => patchBinding(layerId, target, { tappingTermMs: Number(e.target.value) })}
              />
              <span className="text-[0.68rem] font-bold opacity-60">
                この時間を超えて押し続けると長押しと判定されます。
                {binding.tappingTermMs !== undefined && (
                  <button
                    type="button"
                    className="ml-1 underline"
                    onClick={() => patchBinding(layerId, target, { tappingTermMs: undefined })}
                  >
                    全体設定に戻す
                  </button>
                )}
              </span>
            </label>

            <div>
              <p className="text-[0.78rem] font-black">フレーバー</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(Object.keys(FLAVOR_LABEL) as Flavor[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="nb-btn !py-1 text-[0.72rem]"
                    data-active={flavor === f}
                    onClick={() => patchBinding(layerId, target, { flavor: f })}
                  >
                    {FLAVOR_LABEL[f]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[0.68rem] font-bold leading-relaxed opacity-60">
                {FLAVOR_HELP[flavor]}
              </p>
            </div>
          </div>
        )}

        <Preview binding={binding} />
      </div>

      <KeycodePicker
        open={picking !== null}
        title={picking ? `${slotLabel[picking]} に割り当てる` : ''}
        value={picking === 'tap' ? binding.tap : binding.hold}
        allowNone={picking === 'hold'}
        onPick={pick}
        onClose={() => setPicking(null)}
      />
    </div>
  )
}

function Preview({ binding }: { binding: Binding }) {
  const rows: [string, string | undefined][] = [
    ['単押し', binding.tap === 'TRANS' ? undefined : binding.tap],
    ['長押し', binding.hold],
  ]
  return (
    <div className="nb nb-flat p-3" style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}>
      <p className="nb-eyebrow !opacity-70">出力プレビュー</p>
      <dl className="mt-1.5 space-y-1">
        {rows.map(([label, code]) => {
          const kc = getKeycode(code)
          const empty = !code || kc.code === 'NONE'
          return (
            <div key={label} className="flex items-baseline gap-2 text-[0.82rem] font-black">
              <dt className="w-[5.5rem] shrink-0 opacity-60">{label}</dt>
              <dd className="min-w-0 flex-1 truncate">
                {empty ? <span className="opacity-40">—</span> : (
                  <>
                    <span className="font-mono">{kc.label || kc.code}</span>
                    <span className="ml-2 text-[0.7rem] font-bold opacity-55">{kc.name}</span>
                  </>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

export { PAD_SLOT_GLYPH, ENCODER_SLOT_GLYPH }
