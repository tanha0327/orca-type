import { getKeycode } from '../../data/keycodes'
import { LAYER_COLOR_HEX } from '../../data/types'
import { engine } from '../../engine/useEngine'
import { resolveSensor } from '../../engine/resolve'
import { bindableSensors, hasBall, keyboardOf } from '../../keyboards/registry'
import {
  SENSOR_SLOT_GLYPH, SENSOR_SLOT_LABEL, SENSOR_SLOTS,
  type SensorId, type SensorSlot,
} from '../../keyboards/types'
import { sameTarget, useKeymapStore, type Selection } from '../../store/keymapStore'

const SENSOR_TONES = ['var(--color-purple)', 'var(--color-lime)', 'var(--color-cyan)', 'var(--color-sand)']

export function GestureView() {
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const layer = keymap.layers[editingLayer]
  const hex = LAYER_COLOR_HEX[layer?.color ?? 'gray']
  const def = keyboardOf(keymap)

  return (
    <section className="nb nb-lg p-4">
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[1.35rem]">ジェスチャーと回転</h2>
        <span className="nb-chip" style={{ background: hex }}>L{editingLayer} {layer?.name}</span>
      </div>
      <p className="mb-4 text-[0.78rem] font-bold leading-relaxed opacity-70">
        スワイプ・回転・タップはレイヤーごとに設定できます。
        「透過」のスロットは下のレイヤーの割当がそのまま使われます。
      </p>

      <div className="space-y-5">
        {bindableSensors(def).map((sensor, i) => (
          <Group
            key={sensor.id}
            title={sensor.name}
            note={sensor.kind === 'encoder' ? 'ホイールを回したときの出力。' : 'スワイプ・タップしたときの出力。'}
            tone={SENSOR_TONES[i % SENSOR_TONES.length]}
          >
            {SENSOR_SLOTS[sensor.kind].map((slot) => (
              <SlotCard
                key={slot}
                glyph={SENSOR_SLOT_GLYPH[slot]}
                label={SENSOR_SLOT_LABEL[slot]}
                sensor={sensor.id}
                slotKey={slot}
                target={{ kind: 'sensor', sensorId: sensor.id, slot }}
                onTry={() => engine.sensor(sensor.id, slot)}
              />
            ))}
          </Group>
        ))}

        {hasBall(def) && (
          <Group title="トラックボール" note="DPI・角度・精密モードの設定。" tone="#d21f3c">
            <button
              type="button"
              className="nb-btn !w-full !justify-start !p-3"
              onClick={() => useKeymapStore.getState().select({ kind: 'ball' })}
            >
              <span className="flex flex-col text-left">
                <span className="nb-eyebrow !text-[0.6rem]">
                  {def.sensors?.find((s) => s.kind === 'ball')?.name}
                </span>
                <span className="text-[0.85rem] font-black">
                  {keymap.trackball.dpi} dpi / {keymap.trackball.angle}° / 精密 {Math.round(keymap.trackball.snipeRatio * 100)}%
                </span>
              </span>
            </button>
          </Group>
        )}
      </div>
    </section>
  )
}

function Group({
  title, note, tone, children,
}: { title: string; note: string; tone: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: tone, border: '2px solid var(--color-ink)' }} />
        <h3 className="text-[1rem]">{title}</h3>
      </div>
      <p className="mb-2 text-[0.72rem] font-bold opacity-60">{note}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  )
}

function SlotCard({
  glyph, label, sensor, slotKey, target, onTry,
}: {
  glyph: string
  label: string
  sensor: SensorId
  slotKey: SensorSlot
  target: Selection
  onTry: () => void
}) {
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const selection = useKeymapStore((s) => s.selection)
  const select = useKeymapStore((s) => s.select)

  const own = resolveSensor(keymap, [editingLayer], sensor, slotKey)
  const fallback = resolveSensor(keymap, [0, editingLayer], sensor, slotKey)
  const inherited = own.binding.tap === 'NONE' && editingLayer !== 0
  const kc = getKeycode(fallback.binding.tap)
  const active = sameTarget(selection, target)

  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        className="nb-btn !min-h-[3.2rem] !flex-1 !items-center !justify-start !gap-2.5 !p-2"
        data-active={active}
        onClick={() => select(target)}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] font-mono text-[1rem] font-black"
          style={{ background: 'var(--color-paper)', border: '3px solid var(--color-ink)', color: 'var(--color-ink)' }}
        >
          {glyph}
        </span>
        <span className="flex min-w-0 flex-col text-left">
          <span className="nb-eyebrow !text-[0.58rem]">{label}</span>
          <span className="truncate text-[0.82rem] font-black leading-tight">
            {kc.code === 'NONE' ? '—' : kc.label || kc.code}
            {inherited && <span className="ml-1 text-[0.62rem] font-bold opacity-55">（透過）</span>}
          </span>
          {kc.code !== 'NONE' && (
            <span className="truncate text-[0.66rem] font-bold leading-tight opacity-60">{kc.name}</span>
          )}
        </span>
      </button>
      <button type="button" className="nb-btn !px-2.5 text-[0.72rem]" onClick={onTry} title="試し撃ち">
        ▶
      </button>
    </div>
  )
}
