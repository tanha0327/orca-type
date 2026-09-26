import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getKeycode } from '../../data/keycodes'
import {
  DEFAULT_ESC_COLOR, ESC_COLOR_FACE, ESC_COLOR_TEXT, LAYER_COLOR_HEX,
  type EscColor, type Keymap,
} from '../../data/types'
import { engine, useEngineSnapshot } from '../../engine/useEngine'
import { resolveKey } from '../../engine/resolve'
import { boardBounds } from '../../keyboards/geometry'
import { keyboardOf } from '../../keyboards/registry'
import type { KeyId, PadSlot, SensorSlot } from '../../keyboards/types'
import { sameTarget, useKeymapStore, type Selection } from '../../store/keymapStore'
import { KeyCap, type CapTone } from './KeyCap'
import { KeyMenu, type BoardMenuTarget } from './KeyMenu'
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

/**
 * esc キーキャップの色を、本体色の上での地色・文字色・縁の色にする。
 * 縁は黒が基本。黒本体に黒い esc のときだけ、他のキーと同じ白い縁にそろえる
 * （色付きのキーに白い縁を付けると、背景に溶けて輪郭が消える）。
 */
function escCapTone(esc: EscColor, dark: boolean): CapTone {
  return {
    face: ESC_COLOR_FACE[esc],
    text: ESC_COLOR_TEXT[esc],
    border: esc === 'black' && dark ? 'var(--color-paper)' : 'var(--color-ink)',
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

  const boardRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ target: BoardMenuTarget; rect: DOMRect } | null>(null)
  const canEdit = interactive && !isPreview

  const doSelect = (s: Selection) => {
    if (!canEdit) return
    // コンボのキーを選んでいる最中は、クリックを「参加キーの追加／解除」に回す
    if (comboPickId && s.kind === 'key') {
      toggleComboKey(comboPickId, s.keyId)
      return
    }
    select(s)
  }

  const openMenu = (target: BoardMenuTarget, rect: DOMRect) => {
    if (canEdit && !comboPickId) setMenu({ target, rect })
  }

  // メニューを閉じたら選択も外し、他のキーのグレーアウトを戻す
  const closeMenu = useCallback(() => {
    setMenu(null)
    select(null)
  }, [select])

  const def = keyboardOf(keymap)
  const bounds = boardBounds(def)
  const layer = keymap.layers[viewLayer]

  const renderBoard = () => (
    <div
      className="relative w-full"
      style={{
        containerType: 'inline-size',
        aspectRatio: `${bounds.w} / ${bounds.h}`,
        // 1u（キー 1 個分）の幅。文字や線の太さはこれに比例させて、どの大きさのキーボードでも同じ見た目にする
        '--u': `calc(100cqw / ${bounds.w})`,
      } as React.CSSProperties}
    >
      {def.keys.map((k) => {
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
            bounds={bounds}
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
            onSelect={(e) => {
              doSelect({ kind: 'key', keyId: k.id })
              openMenu({ kind: 'key', keyId: k.id }, e.currentTarget.getBoundingClientRect())
            }}
            onPulse={() => engine.pulse(k.id)}
          />
        )
      })}

      {(def.sensors ?? []).map((s) => {
        const slots = layer?.sensors[s.id]
        const glyph = (slot: SensorSlot) => sensorGlyph(slots?.[slot]?.tap)
        const selectedSlot = selection?.kind === 'sensor' && selection.sensorId === s.id ? selection.slot : null
        const onSelect = (slot: SensorSlot, rect: DOMRect) => {
          doSelect({ kind: 'sensor', sensorId: s.id, slot })
          openMenu({ kind: 'sensor', sensorId: s.id }, rect)
        }
        if (s.kind === 'encoder') {
          return (
            <EncoderView
              key={s.id}
              def={s}
              bounds={bounds}
              selected={selectedSlot !== null}
              glyphs={{ cw: glyph('cw'), ccw: glyph('ccw') }}
              color={bodyColor}
              interactive={interactive}
              onSlot={(slot) => engine.sensor(s.id, slot)}
              onSelect={onSelect}
            />
          )
        }
        if (s.kind === 'pad') {
          return (
            <PadView
              key={s.id}
              def={s}
              bounds={bounds}
              selectedSlot={selectedSlot as PadSlot | null}
              glyphs={{ up: glyph('up'), down: glyph('down'), tap: glyph('tap') }}
              color={bodyColor}
              interactive={interactive}
              onSlot={(slot) => engine.sensor(s.id, slot)}
              onSelect={onSelect}
            />
          )
        }
        return (
          <BallView
            key={s.id}
            def={s}
            bounds={bounds}
            selected={selection?.kind === 'ball'}
            dpi={keymap.trackball.dpi}
            color={keymap.trackball.color ?? 'white'}
            interactive={interactive}
            onSelect={() => { setMenu(null); doSelect({ kind: 'ball' }) }}
          />
        )
      })}
    </div>
  )

  // 別の方法で選択が変わったり、コンボ選択中に入ったら、古い位置のメニューは出さない
  const menuMatchesSelection = (() => {
    if (!menu || !selection) return false
    const t = menu.target
    if (t.kind === 'key') return selection.kind === 'key' && selection.keyId === t.keyId
    return selection.kind === 'sensor' && selection.sensorId === t.sensorId
  })()
  const showMenu = !!menu && !comboPickId && menuMatchesSelection

  // 盤面の外や、キーのすき間を触ったら選択を外す（メニューが開いている間はメニュー側で閉じる）。
  // コンボの編集中の選択はコンボ一覧のものなので触らない
  const boardSelected = !!selection && selection.kind !== 'combo'
  useEffect(() => {
    if (!canEdit || comboPickId || !boardSelected || showMenu) return
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null
      const onBoardItem = !!el && !!boardRef.current?.contains(el) && !!el.closest('button, [role="button"]')
      if (!onBoardItem) select(null)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [canEdit, comboPickId, boardSelected, showMenu, select])

  // このメニューが開いている間は、盤面の下の「1」等のレイヤー切替ショートカットを止める
  useEffect(() => {
    setKeyMenuOpen(showMenu)
    return () => setKeyMenuOpen(false)
  }, [showMenu, setKeyMenuOpen])

  return (
    <div ref={boardRef} className="w-full">
      {renderBoard()}
      {showMenu && menu && (
        <KeyMenu target={menu.target} anchorRect={menu.rect} onClose={closeMenu} />
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
