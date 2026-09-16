import { useMemo } from 'react'
import { LAYER_COLOR_HEX, LAYER_COLORS, type Layer, type LayerColor } from '../../data/types'
import { useEngineSnapshot } from '../../engine/useEngine'
import { useKeymapStore } from '../../store/keymapStore'

function countAssignments(layer: Layer): number {
  let n = 0
  for (const b of Object.values(layer.keys)) {
    if (b && b.tap !== 'TRANS' && b.tap !== 'NONE') n++
  }
  return n
}

function countSensors(layer: Layer): number {
  const all = [
    ...Object.values(layer.encoder),
    ...Object.values(layer.padL),
    ...Object.values(layer.padR),
  ]
  return all.filter((b) => b && b.tap !== 'TRANS' && b.tap !== 'NONE').length
}

export function LayerBar() {
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const setEditingLayer = useKeymapStore((s) => s.setEditingLayer)
  const renameLayer = useKeymapStore((s) => s.renameLayer)
  const recolorLayer = useKeymapStore((s) => s.recolorLayer)
  const clearLayer = useKeymapStore((s) => s.clearLayer)
  const snap = useEngineSnapshot()

  const active = keymap.layers[editingLayer]
  const comboCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of keymap.combos) {
      if (!c.enabled) continue
      for (const n of c.layers) m.set(n, (m.get(n) ?? 0) + 1)
    }
    return m
  }, [keymap.combos])

  return (
    <section aria-label="レイヤー">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[1.35rem] sm:text-[1.6rem]">レイヤー</h2>
        <p className="nb-eyebrow">8 LAYERS</p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
        {keymap.layers.map((layer) => {
          const hex = LAYER_COLOR_HEX[layer.color]
          const isEditing = layer.id === editingLayer
          const isLive = snap.stack.includes(layer.id) && snap.down.length > 0
          return (
            <div
              key={layer.id}
              className="nb-folder"
              style={{
                // @ts-expect-error CSS カスタムプロパティ
                '--tab-color': hex,
              }}
            >
              <button
                type="button"
                onClick={() => setEditingLayer(layer.id)}
                className="nb-btn !block w-full !p-0 text-left"
                style={{
                  background: isEditing ? hex : 'var(--color-paper)',
                  transform: isEditing ? 'translate(3px, 3px)' : undefined,
                  boxShadow: isEditing ? '1px 1px 0 var(--color-ink)' : undefined,
                }}
                aria-pressed={isEditing}
              >
                <div className="flex items-start justify-between gap-2 p-2.5">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] font-mono text-[1rem] font-black"
                    style={{ background: hex, border: '3px solid var(--color-ink)' }}
                  >
                    {layer.id}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="font-mono text-[0.68rem] font-black leading-tight opacity-70">
                      {countAssignments(layer)} キー
                    </div>
                    <div className="font-mono text-[0.68rem] font-black leading-tight opacity-70">
                      {countSensors(layer)} センサー
                      {comboCounts.get(layer.id) ? ` / ${comboCounts.get(layer.id)} コンボ` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
                  <span className="truncate text-[0.95rem] font-black leading-none">{layer.name}</span>
                  {isLive && (
                    <span
                      className="nb-chip shrink-0 !py-0 !text-[0.55rem]"
                      style={{ background: 'var(--color-lime)' }}
                    >
                      LIVE
                    </span>
                  )}
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* 編集中レイヤーの名前と色 */}
      {active && (
        <div className="nb mt-5 flex flex-wrap items-center gap-3 p-3">
          <span className="nb-eyebrow shrink-0">編集中 L{active.id}</span>
          <input
            className="nb-input !w-auto min-w-[8rem] flex-1"
            value={active.name}
            aria-label="レイヤー名"
            maxLength={16}
            onChange={(e) => renameLayer(active.id, e.target.value)}
          />
          <div className="flex items-center gap-1.5" role="group" aria-label="レイヤーの色">
            {LAYER_COLORS.map((c: LayerColor) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={active.color === c}
                onClick={() => recolorLayer(active.id, c)}
                className="h-7 w-7 rounded-[7px]"
                style={{
                  background: LAYER_COLOR_HEX[c],
                  border: '3px solid var(--color-ink)',
                  boxShadow: active.color === c ? 'none' : '2px 2px 0 var(--color-ink)',
                  transform: active.color === c ? 'translate(2px,2px)' : undefined,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="nb-btn shrink-0 !py-1.5 text-[0.8rem]"
            onClick={() => {
              if (confirm(`L${active.id} 「${active.name}」のキー割当をすべて消去しますか？`)) {
                clearLayer(active.id)
              }
            }}
          >
            このレイヤーを空に
          </button>
        </div>
      )}
    </section>
  )
}
