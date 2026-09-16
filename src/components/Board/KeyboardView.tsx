import { useMemo } from 'react'
import { getKeycode } from '../../data/keycodes'
import {
  halfExtent, KEYS, SENSORS, type Half, type KeyId,
} from '../../data/layout'
import { LAYER_COLOR_HEX, type EncoderSlot, type PadSlot } from '../../data/types'
import { engine, useEngineSnapshot } from '../../engine/useEngine'
import { resolveKey } from '../../engine/resolve'
import { sameTarget, useKeymapStore, type Selection } from '../../store/keymapStore'
import { KeyCap } from './KeyCap'
import { BallView, EncoderView, PadView, sensorGlyph } from './Sensors'

export interface KeyboardViewProps {
  /** false ならクリック編集なしの表示専用（HUD のミニキーマップ用） */
  interactive?: boolean
  /** 実機写真のように他レイヤーの印字を重ねる */
  subLegends?: boolean
  compact?: boolean
}

export function KeyboardView({ interactive = true, subLegends = false, compact = false }: KeyboardViewProps) {
  const keymap = useKeymapStore((s) => s.keymap)
  const editingLayer = useKeymapStore((s) => s.editingLayer)
  const selection = useKeymapStore((s) => s.selection)
  const select = useKeymapStore((s) => s.select)
  const comboPickId = useKeymapStore((s) => s.comboPickId)
  const toggleComboKey = useKeymapStore((s) => s.toggleComboKey)
  const snap = useEngineSnapshot()

  // 実際に入力を受けているときは、押下中に有効なレイヤーを映す
  const viewLayer = snap.down.length > 0 ? snap.activeLayer : editingLayer
  const accent = LAYER_COLOR_HEX[keymap.layers[viewLayer]?.color ?? 'gray']
  const displayStack = useMemo(
    () => (viewLayer === 0 ? [0] : [0, viewLayer]),
    [viewLayer],
  )

  const pressByKey = useMemo(
    () => new Map(snap.presses.map((p) => [p.keyId, p])),
    [snap.presses],
  )

  const comboCount = useMemo(() => {
    const m = new Map<KeyId, number>()
    for (const c of keymap.combos) {
      if (!c.enabled || !c.layers.includes(viewLayer)) continue
      for (const k of c.keys) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [keymap.combos, viewLayer])

  const doSelect = (s: Selection) => {
    if (!interactive) return
    // コンボのキーを選んでいる最中は、クリックを「参加キーの追加／解除」に回す
    if (comboPickId && s.kind === 'key') {
      toggleComboKey(comboPickId, s.keyId)
      return
    }
    select(s)
  }

  const renderHalf = (half: Half) => {
    const ext = halfExtent(half)
    const layer = keymap.layers[viewLayer]
    const keys = KEYS.filter((k) => k.half === half)
    const sensors = SENSORS.filter((s) => s.half === half)

    return (
      <div
        className="relative w-full"
        style={{
          containerType: 'inline-size',
          aspectRatio: `${ext.w} / ${ext.h}`,
        }}
      >
        {keys.map((k) => {
          const own = layer?.keys[k.id]
          const resolved = resolveKey(keymap, displayStack, k.id)
          const inherited = !own || own.tap === 'TRANS'
          // レイヤー切替キーは、行き先のレイヤー名をその色で添える。
          // ミニキーマップでは文字が潰れて主表記に重なるので、副表記は一切出さない。
          const targetLayer = getKeycode(resolved.binding.tap).layerTarget
          const subs = compact
            ? undefined
            : targetLayer !== undefined && keymap.layers[targetLayer]
              ? [{
                  glyph: keymap.layers[targetLayer].name,
                  color: LAYER_COLOR_HEX[keymap.layers[targetLayer].color],
                }]
              : subLegends && viewLayer === 0
                ? ([1, 2] as const).flatMap((n) => {
                    const b = keymap.layers[n]?.keys[k.id]
                    const g = sensorGlyph(b?.tap)
                    return g ? [{ glyph: g, color: LAYER_COLOR_HEX[keymap.layers[n].color] }] : []
                  })
                : undefined

          return (
            <KeyCap
              key={k.id}
              keyDef={k}
              binding={resolved.binding}
              inherited={inherited && viewLayer !== 0}
              selected={
                comboPickId
                  ? (keymap.combos.find((c) => c.id === comboPickId)?.keys.includes(k.id) ?? false)
                  : sameTarget(selection, { kind: 'key', keyId: k.id })
              }
              dimmed={interactive && !comboPickId && selection?.kind === 'key' && selection.keyId !== k.id}
              press={pressByKey.get(k.id)}
              comboCount={comboCount.get(k.id) ?? 0}
              accent={accent}
              subLegends={subs}
              interactive={interactive}
              totalW={ext.w}
              totalH={ext.h}
              onSelect={() => doSelect({ kind: 'key', keyId: k.id })}
              onPulse={() => engine.pulse(k.id)}
            />
          )
        })}

        {sensors.map((s) => {
          if (s.kind === 'encoder') {
            const e = layer?.encoder
            return (
              <EncoderView
                key={s.id}
                def={s}
                geo={{ totalW: ext.w, totalH: ext.h }}
                selected={selection?.kind === 'encoder'}
                glyphs={{
                  cw: sensorGlyph(e?.cw.tap),
                  ccw: sensorGlyph(e?.ccw.tap),
                  press: sensorGlyph(e?.press.tap),
                }}
                interactive={interactive}
                onSlot={(slot: EncoderSlot) => engine.encoder(slot)}
                onSelect={(slot) => doSelect({ kind: 'encoder', slot })}
              />
            )
          }
          if (s.kind === 'pad') {
            const cfg = s.id === 'pad-l' ? layer?.padL : layer?.padR
            const sensorId = s.id as 'pad-l' | 'pad-r'
            const g = (slot: PadSlot) => sensorGlyph(cfg?.[slot].tap)
            return (
              <PadView
                key={s.id}
                def={s}
                geo={{ totalW: ext.w, totalH: ext.h }}
                selectedSlot={
                  selection?.kind === 'pad' && selection.sensor === sensorId ? selection.slot : null
                }
                glyphs={{
                  up: g('up'), down: g('down'), left: g('left'), right: g('right'),
                  tap: g('tap'), doubleTap: g('doubleTap'),
                }}
                interactive={interactive}
                onSlot={(slot) => engine.pad(sensorId, slot)}
                onSelect={(slot) => doSelect({ kind: 'pad', sensor: sensorId, slot })}
              />
            )
          }
          return (
            <BallView
              key={s.id}
              def={s}
              geo={{ totalW: ext.w, totalH: ext.h }}
              selected={selection?.kind === 'ball'}
              dpi={keymap.trackball.dpi}
              interactive={interactive}
              onSelect={() => doSelect({ kind: 'ball' })}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className={`flex w-full items-start ${compact ? 'gap-2' : 'gap-3 sm:gap-6'}`}>
      <div className="min-w-0 flex-1">{renderHalf('L')}</div>
      <div className="min-w-0 flex-1">{renderHalf('R')}</div>
    </div>
  )
}

/** HUD 内のミニキーマップ。押下中のキーだけ色が乗る */
export function MiniKeymap() {
  return <KeyboardView interactive={false} compact />
}

export function keycodeGlyph(code: string | undefined) {
  const kc = getKeycode(code)
  return kc.label || kc.code
}
