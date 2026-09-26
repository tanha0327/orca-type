import { useMemo, useState } from 'react'
import { getKeycode } from '../../data/keycodes'
import { LAYER_COLOR_HEX, type Combo } from '../../data/types'
import { resolveKey } from '../../engine/resolve'
import { keyboardOf } from '../../keyboards/registry'
import { useKeymapStore } from '../../store/keymapStore'
import { BindingSlot, KeycodePicker } from '../Picker/KeycodePicker'

export function ComboEditor({ combo }: { combo: Combo }) {
  const keymap = useKeymapStore((s) => s.keymap)
  const updateCombo = useKeymapStore((s) => s.updateCombo)
  const removeCombo = useKeymapStore((s) => s.removeCombo)
  const comboPickId = useKeymapStore((s) => s.comboPickId)
  const setComboPick = useKeymapStore((s) => s.setComboPick)
  const toggleComboKey = useKeymapStore((s) => s.toggleComboKey)
  const [picking, setPicking] = useState(false)
  const [listQuery, setListQuery] = useState('')

  const pickingKeys = comboPickId === combo.id
  const kc = getKeycode(combo.binding.tap)

  const listResults = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return keyboardOf(keymap).keys.filter((k) => {
      if (!q) return true
      const label = getKeycode(resolveKey(keymap, [0, combo.layers[0] ?? 0], k.id).binding.tap).label
      return k.id.toLowerCase().includes(q) || label.toLowerCase().includes(q)
    })
  }, [listQuery, keymap, combo.layers])

  return (
    <div className="nb nb-lg overflow-hidden">
      <header
        className="flex items-start gap-2 border-b-[3px] border-[var(--color-ink)] p-3"
        style={{ background: 'var(--color-purple)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="nb-eyebrow !opacity-80">コンボ</p>
          <h3 className="truncate text-[1.1rem]">{combo.name || '名前なし'}</h3>
        </div>
        <button
          type="button"
          className="nb-btn shrink-0 !py-1.5 text-[0.78rem]"
          data-active={combo.enabled}
          onClick={() => updateCombo(combo.id, { enabled: !combo.enabled })}
        >
          {combo.enabled ? '有効' : '無効'}
        </button>
      </header>

      <div className="space-y-4 p-3">
        <label className="block">
          <span className="nb-eyebrow">名前</span>
          <input
            className="nb-input mt-1"
            value={combo.name}
            maxLength={40}
            onChange={(e) => updateCombo(combo.id, { name: e.target.value })}
          />
        </label>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="nb-eyebrow">同時に押すキー</span>
            <button
              type="button"
              className="nb-btn !py-1 text-[0.72rem]"
              data-active={pickingKeys}
              onClick={() => setComboPick(pickingKeys ? null : combo.id)}
            >
              {pickingKeys ? '選択を終える' : 'キーを選ぶ'}
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {combo.keys.length === 0 && (
              <span className="text-[0.76rem] font-bold opacity-60">
                「キーを選ぶ」を押して追加してください
              </span>
            )}
            {combo.keys.map((k) => {
              const b = resolveKey(keymap, [0, combo.layers[0] ?? 0], k)
              const g = getKeycode(b.binding.tap)
              return (
                <button
                  key={k}
                  type="button"
                  className="nb-chip"
                  style={{ background: 'var(--color-lime)', cursor: 'pointer' }}
                  onClick={() => updateCombo(combo.id, { keys: combo.keys.filter((x) => x !== k) })}
                  title="クリックで外す"
                >
                  {g.label || k} ✕
                </button>
              )
            })}
          </div>
          {pickingKeys && (
            <>
              <p className="mt-1.5 text-[0.7rem] font-bold leading-relaxed opacity-70">
                盤面のキーをクリックする、手元のキーボードで押す、下のリストから選ぶ、
                のいずれかで追加／解除されます。
              </p>
              <input
                className="nb-input mt-2 !py-1.5 text-[0.82rem]"
                placeholder="リストを検索（例: Q / shift）"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
              />
              <div className="mt-1.5 grid max-h-40 grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-6">
                {listResults.map((k) => {
                  const g = getKeycode(resolveKey(keymap, [0, combo.layers[0] ?? 0], k.id).binding.tap)
                  const on = combo.keys.includes(k.id)
                  return (
                    <button
                      key={k.id}
                      type="button"
                      className="nb-chip !justify-center"
                      style={{ background: on ? 'var(--color-lime)' : 'transparent', cursor: 'pointer' }}
                      onClick={() => toggleComboKey(combo.id, k.id)}
                    >
                      {g.label || k.id}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <BindingSlot
          label="コンボの出力"
          code={combo.binding.tap}
          tone="var(--color-purple)"
          onClick={() => setPicking(true)}
        />

        <label className="block">
          <span className="flex items-baseline justify-between text-[0.8rem] font-black">
            同時押しとみなす時間
            <span className="font-mono">{combo.timeoutMs} ms</span>
          </span>
          <input
            type="range" min={15} max={200} step={5} value={combo.timeoutMs}
            className="mt-1 w-full accent-[var(--color-ink)]"
            onChange={(e) => updateCombo(combo.id, { timeoutMs: Number(e.target.value) })}
          />
          <span className="text-[0.68rem] font-bold opacity-60">
            短いほど誤爆しませんが、きっちり同時に押す必要があります。
          </span>
        </label>

        <div>
          <span className="nb-eyebrow">有効にするレイヤー</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {keymap.layers.map((l) => {
              const on = combo.layers.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  className="nb-chip"
                  style={{
                    background: on ? LAYER_COLOR_HEX[l.color] : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    updateCombo(combo.id, {
                      layers: on ? combo.layers.filter((n) => n !== l.id) : [...combo.layers, l.id],
                    })
                  }
                >
                  L{l.id} {l.name}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className="nb nb-flat p-3"
          style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}
        >
          <p className="nb-eyebrow !opacity-70">プレビュー</p>
          <p className="mt-1 font-mono text-[1rem] font-black">
            {combo.keys.length ? combo.keys.map((k) => {
              const b = resolveKey(keymap, [0, combo.layers[0] ?? 0], k)
              return getKeycode(b.binding.tap).label || k
            }).join(' + ') : '—'}
            <span className="mx-2 opacity-50">→</span>
            {kc.code === 'NONE' ? '—' : kc.label || kc.code}
          </p>
        </div>

        <button
          type="button"
          className="nb-btn w-full !py-2 text-[0.82rem]"
          style={{ background: 'var(--color-pink)' }}
          onClick={() => { if (confirm(`コンボ「${combo.name}」を削除しますか？`)) removeCombo(combo.id) }}
        >
          このコンボを削除
        </button>
      </div>

      <KeycodePicker
        open={picking}
        title="コンボの出力に割り当てる"
        value={combo.binding.tap}
        onPick={(code) => { updateCombo(combo.id, { binding: { ...combo.binding, tap: code } }); setPicking(false) }}
        onClose={() => setPicking(false)}
      />
    </div>
  )
}
