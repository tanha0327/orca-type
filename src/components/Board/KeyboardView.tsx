import { useEffect, useMemo, useState } from 'react'
import { getKeycode } from '../../data/keycodes'
import {
  halfExtent, KEYS, SENSORS, type Half, type KeyId,
} from '../../data/layout'
import {
  DEFAULT_ESC_COLOR, LAYER_COLOR_HEX, type EncoderSlot, type EscColor, type Keymap, type PadSlot,
} from '../../data/types'
import { engine, useEngineSnapshot } from '../../engine/useEngine'
import { resolveKey } from '../../engine/resolve'
import { sameTarget, useKeymapStore, type Selection } from '../../store/keymapStore'
import { KeyCap, type CapTone } from './KeyCap'
import { KeyMenu } from './KeyMenu'
import { BallView, EncoderView, PadView, sensorGlyph } from './Sensors'

export interface KeyboardViewProps {
  /** false ならクリック編集なしの表示専用（HUD のミニキーマップ用） */
  interactive?: boolean
  /** 実機写真のように他レイヤーの印字を重ねる */
  subLegends?: boolean
  compact?: boolean
  /**
   * 指定すると、ストアの編集中の内容ではなく、このキーマップ・レイヤーを表示する
   * （フィードの配列プレビューなど、他人のキーマップを覗き見るとき用）。
   */
  previewKeymap?: Keymap
  previewLayer?: number
  /** プレビュー時、他方のキーマップと割当が違うキーの ID 集合（比較モーダル用） */
  diffKeys?: ReadonlySet<KeyId>
}

/** esc キーキャップの色を、本体色の上での地色・文字色・縁の色にする */
function escCapTone(esc: EscColor, dark: boolean): CapTone {
  const bodyBorder = dark ? 'var(--color-paper)' : 'var(--color-ink)'
  switch (esc) {
    case 'white':
      return { face: 'var(--color-paper)', text: 'var(--color-ink)', border: 'var(--color-ink)' }
    case 'black':
      return { face: 'var(--color-ink)', text: 'var(--color-paper)', border: bodyBorder }
    case 'orange':
      return { face: 'var(--color-orange)', text: 'var(--color-ink)', border: bodyBorder }
  }
}

export function KeyboardView({
  interactive = true, subLegends = false, compact = false, previewKeymap, previewLayer, diffKeys,
}: KeyboardViewProps) {
  const storeKeymap = useKeymapStore((s) => s.keymap)
  const storeEditingLayer = useKeymapStore((s) => s.editingLayer)
  const storeSelection = useKeymapStore((s) => s.selection)
  const select = useKeymapStore((s) => s.select)
  const storeComboPickId = useKeymapStore((s) => s.comboPickId)
  const toggleComboKey = useKeymapStore((s) => s.toggleComboKey)
  const setKeyMenuOpen = useKeymapStore((s) => s.setKeyMenuOpen)
  const snap = useEngineSnapshot()

  // プレビュー中は他人のキーマップを表示するので、いまの編集状態（選択・コンボ選択中・押下中）は一切持ち込まない
  const isPreview = !!previewKeymap
  const keymap = previewKeymap ?? storeKeymap
  const editingLayer = previewLayer ?? storeEditingLayer
  const selection = isPreview ? null : storeSelection
  const comboPickId = isPreview ? null : storeComboPickId

  // 実際に入力を受けているときは、押下中に有効なレイヤーを映す
  const viewLayer = !isPreview && snap.down.length > 0 ? snap.activeLayer : editingLayer
  const accent = LAYER_COLOR_HEX[keymap.layers[viewLayer]?.color ?? 'gray']
  const bodyColor = keymap.settings.bodyColor ?? 'white'
  const dark = bodyColor === 'black'
  const escTone = escCapTone(keymap.settings.escColor ?? DEFAULT_ESC_COLOR, dark)
  const displayStack = useMemo(
    () => (viewLayer === 0 ? [0] : [0, viewLayer]),
    [viewLayer],
  )

  const pressByKey = useMemo(
    () => (isPreview ? new Map() : new Map(snap.presses.map((p) => [p.keyId, p]))),
    [snap.presses, isPreview],
  )

  // 参加キーを選んでいる最中は、そのコンボのキーだけに印を絞る。
  // 普通のときは、このレイヤーで有効なコンボ全部のキーに印をつける。
  const comboCount = useMemo(() => {
    const m = new Map<KeyId, number>()
    if (comboPickId) {
      const combo = keymap.combos.find((c) => c.id === comboPickId)
      for (const k of combo?.keys ?? []) m.set(k, 1)
      return m
    }
    for (const c of keymap.combos) {
      if (!c.enabled || !c.layers.includes(viewLayer)) continue
      for (const k of c.keys) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [keymap.combos, viewLayer, comboPickId])

  const [menuAnchor, setMenuAnchor] = useState<{ keyId: KeyId; rect: DOMRect } | null>(null)

  const doSelect = (s: Selection) => {
    if (!interactive || isPreview) return
    // コンボのキーを選んでいる最中は、クリックを「参加キーの追加／解除」に回す
    if (comboPickId && s.kind === 'key') {
      toggleComboKey(comboPickId, s.keyId)
      return
    }
    if (s.kind !== 'key') setMenuAnchor(null)
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
              selectedTone={comboPickId ? 'var(--color-purple)' : undefined}
              dimmed={interactive && !comboPickId && selection?.kind === 'key' && selection.keyId !== k.id}
              diff={diffKeys?.has(k.id) ?? false}
              dark={dark}
              capTone={k.accent ? escTone : undefined}
              press={pressByKey.get(k.id)}
              comboCount={comboCount.get(k.id) ?? 0}
              accent={accent}
              subLegends={subs}
              interactive={interactive}
              totalW={ext.w}
              totalH={ext.h}
              onSelect={(e) => {
                doSelect({ kind: 'key', keyId: k.id })
                if (interactive && !isPreview && !comboPickId) {
                  setMenuAnchor({ keyId: k.id, rect: e.currentTarget.getBoundingClientRect() })
                }
              }}
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
                }}
                color={bodyColor}
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
                glyphs={{ up: g('up'), down: g('down'), tap: g('tap') }}
                color={bodyColor}
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
              color={keymap.trackball.color ?? 'white'}
              interactive={interactive}
              onSelect={() => doSelect({ kind: 'ball' })}
            />
          )
        })}
      </div>
    )
  }

  // 別の方法（リストからキーを選ぶ等）で選択が変わったり、コンボ選択中に入ったら、古い位置のメニューは出さない
  const showMenu = !!menuAnchor
    && !comboPickId
    && selection?.kind === 'key'
    && selection.keyId === menuAnchor.keyId

  // このメニューが開いている間は、盤面の下の「1」等のレイヤー切替ショートカットを止める
  useEffect(() => {
    setKeyMenuOpen(showMenu)
    return () => setKeyMenuOpen(false)
  }, [showMenu, setKeyMenuOpen])

  return (
    <div className={`flex w-full items-start ${compact ? 'gap-2' : 'gap-3 sm:gap-6'}`}>
      <div className="min-w-0 flex-1">{renderHalf('L')}</div>
      <div className="min-w-0 flex-1">{renderHalf('R')}</div>
      {showMenu && menuAnchor && (
        <KeyMenu keyId={menuAnchor.keyId} anchorRect={menuAnchor.rect} onClose={() => setMenuAnchor(null)} />
      )}
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
