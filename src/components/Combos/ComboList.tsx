import { getKeycode } from '../../data/keycodes'
import { LAYER_COLOR_HEX } from '../../data/types'
import { resolveKey } from '../../engine/resolve'
import { sameTarget, useKeymapStore } from '../../store/keymapStore'

export function ComboList() {
  const keymap = useKeymapStore((s) => s.keymap)
  const selection = useKeymapStore((s) => s.selection)
  const select = useKeymapStore((s) => s.select)
  const addCombo = useKeymapStore((s) => s.addCombo)
  const setComboPick = useKeymapStore((s) => s.setComboPick)

  return (
    <section className="nb nb-lg p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[1.35rem]">コンボ</h2>
          <p className="mt-1 text-[0.78rem] font-bold leading-relaxed opacity-70">
            複数のキーを同時に押したときの出力。ジェスチャー的な操作をここに割り当てます。
          </p>
        </div>
        <button
          type="button"
          className="nb-btn shrink-0 !py-2 text-[0.82rem]"
          style={{ background: 'var(--color-purple)' }}
          onClick={() => {
            const id = addCombo()
            select({ kind: 'combo', comboId: id })
            setComboPick(id)
          }}
        >
          ＋ コンボを追加
        </button>
      </div>

      {keymap.combos.length === 0 ? (
        <p className="py-6 text-center text-[0.85rem] font-bold opacity-60">
          まだコンボがありません
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {keymap.combos.map((c) => {
            const out = getKeycode(c.binding.tap)
            const active = sameTarget(selection, { kind: 'combo', comboId: c.id })
            const keyGlyphs = c.keys.map((k) => {
              const b = resolveKey(keymap, [0, c.layers[0] ?? 0], k)
              return getKeycode(b.binding.tap).label || k
            })
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="nb-btn !w-full !flex-col !items-start !gap-1.5 !p-3 text-left"
                  data-active={active}
                  onClick={() => select({ kind: 'combo', comboId: c.id })}
                  style={{ opacity: c.enabled ? 1 : 0.5 }}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[0.88rem] font-black">{c.name}</span>
                    {!c.enabled && <span className="nb-chip !py-0 !text-[0.55rem]">無効</span>}
                  </span>
                  <span className="flex w-full flex-wrap items-center gap-1 font-mono text-[0.9rem] font-black">
                    {keyGlyphs.length ? keyGlyphs.join(' + ') : <span className="opacity-40">キー未選択</span>}
                    <span className="opacity-40">→</span>
                    <span>{out.code === 'NONE' ? '—' : out.label || out.code}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {c.layers.map((n) => (
                      <span
                        key={n}
                        className="nb-chip !py-0 !text-[0.55rem]"
                        style={{ background: LAYER_COLOR_HEX[keymap.layers[n]?.color ?? 'gray'] }}
                      >
                        L{n}
                      </span>
                    ))}
                    <span className="nb-chip !py-0 !text-[0.55rem] !border-dashed">{c.timeoutMs}ms</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
