import { LAYER_COLOR_HEX, LAYER_COLORS, type LayerColor } from '../../data/types'
import { useKeymapStore } from '../../store/keymapStore'

export function LayerBar() {
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const setEditingLayer = useKeymapStore((s) => s.setEditingLayer)
  const renameLayer = useKeymapStore((s) => s.renameLayer)
  const recolorLayer = useKeymapStore((s) => s.recolorLayer)
  const clearLayer = useKeymapStore((s) => s.clearLayer)

  const active = keymap.layers[editingLayer]

  return (
    <section aria-label="レイヤー">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[1.35rem] sm:text-[1.6rem]">レイヤー</h2>
        <p className="nb-eyebrow">8 LAYERS</p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-5">
        {keymap.layers.map((layer) => {
          const hex = LAYER_COLOR_HEX[layer.color]
          const isEditing = layer.id === editingLayer
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => setEditingLayer(layer.id)}
              className="nb-folder nb-btn !inline-flex h-9 w-9 !p-0"
              title={`L${layer.id} ${layer.name}`}
              aria-label={`レイヤー ${layer.id} ${layer.name}`}
              style={{
                // @ts-expect-error CSS カスタムプロパティ
                '--tab-color': hex,
                background: isEditing ? hex : 'var(--color-paper)',
                borderRadius: '9px',
                transform: isEditing ? 'translate(3px, 3px)' : undefined,
                boxShadow: isEditing ? '1px 1px 0 var(--color-ink)' : undefined,
              }}
              aria-pressed={isEditing}
            />
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
