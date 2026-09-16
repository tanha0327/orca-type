import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createDefaultKeymap } from '../data/defaultKeymap'
import type { KeyId } from '../data/layout'
import type { Keycode } from '../data/keycodes'
import type {
  Binding, Combo, EncoderSlot, Keymap, KeymapSettings,
  LayerColor, PadSlot, TrackballConfig,
} from '../data/types'

export type PadSensor = 'pad-l' | 'pad-r'

/** 編集対象。キー・エンコーダー・パッド・コンボを同じ型で指す */
export type BindingTarget =
  | { kind: 'key'; keyId: KeyId }
  | { kind: 'encoder'; slot: EncoderSlot }
  | { kind: 'pad'; sensor: PadSensor; slot: PadSlot }
  | { kind: 'combo'; comboId: string }

export type Selection = BindingTarget | { kind: 'ball' }

export type ViewId = 'edit' | 'feed' | 'export'

export interface HudOptions {
  showCombination: boolean
  showJudgement: boolean
  showCombo: boolean
  showSensor: boolean
  showLog: boolean
  showMiniMap: boolean
}

interface EditorState {
  keymap: Keymap
  /** 編集中のレイヤー */
  editingLayer: number
  selection: Selection | null
  captureEnabled: boolean
  /** 盤面クリックでコンボのキーを選んでいる最中なら、そのコンボ ID */
  comboPickId: string | null
  view: ViewId
  hud: HudOptions
  /** HUD をページ内にドッキング表示するか */
  hudDocked: boolean
  /** 共有フィードに投稿するときの表示名（一度入れたら覚えておく） */
  authorName: string

  setEditingLayer: (n: number) => void
  select: (s: Selection | null) => void
  setCapture: (on: boolean) => void
  setComboPick: (id: string | null) => void
  toggleComboKey: (comboId: string, keyId: KeyId) => void
  setView: (v: ViewId) => void
  setHud: (patch: Partial<HudOptions>) => void
  setHudDocked: (on: boolean) => void
  setAuthorName: (name: string) => void

  setBinding: (layerId: number, target: BindingTarget, binding: Binding) => void
  patchBinding: (layerId: number, target: BindingTarget, patch: Partial<Binding>) => void
  setTap: (layerId: number, target: BindingTarget, code: Keycode) => void
  setHold: (layerId: number, target: BindingTarget, code: Keycode | undefined) => void

  renameLayer: (layerId: number, name: string) => void
  recolorLayer: (layerId: number, color: LayerColor) => void
  clearLayer: (layerId: number) => void

  addCombo: () => string
  updateCombo: (id: string, patch: Partial<Combo>) => void
  removeCombo: (id: string) => void

  setTrackball: (patch: Partial<TrackballConfig>) => void
  setSettings: (patch: Partial<KeymapSettings>) => void

  importKeymap: (km: Keymap) => void
  resetKeymap: () => void
}

/* -------------------------------------------------- 割当の読み書き補助 */

export function getBinding(keymap: Keymap, layerId: number, target: BindingTarget): Binding | undefined {
  if (target.kind === 'combo') {
    return keymap.combos.find((c) => c.id === target.comboId)?.binding
  }
  const layer = keymap.layers[layerId]
  if (!layer) return undefined
  switch (target.kind) {
    case 'key':
      return layer.keys[target.keyId]
    case 'encoder':
      return layer.encoder[target.slot]
    case 'pad':
      return (target.sensor === 'pad-l' ? layer.padL : layer.padR)[target.slot]
  }
}

function writeBinding(keymap: Keymap, layerId: number, target: BindingTarget, binding: Binding): Keymap {
  if (target.kind === 'combo') {
    return {
      ...keymap,
      combos: keymap.combos.map((c) => (c.id === target.comboId ? { ...c, binding } : c)),
    }
  }
  const layers = keymap.layers.map((layer) => {
    if (layer.id !== layerId) return layer
    switch (target.kind) {
      case 'key':
        return { ...layer, keys: { ...layer.keys, [target.keyId]: binding } }
      case 'encoder':
        return { ...layer, encoder: { ...layer.encoder, [target.slot]: binding } }
      case 'pad':
        return target.sensor === 'pad-l'
          ? { ...layer, padL: { ...layer.padL, [target.slot]: binding } }
          : { ...layer, padR: { ...layer.padR, [target.slot]: binding } }
    }
  })
  return { ...keymap, layers }
}

export function targetLabel(target: Selection): string {
  switch (target.kind) {
    case 'key': return `キー ${target.keyId}`
    case 'encoder': return 'ロータリーエンコーダー'
    case 'pad': return target.sensor === 'pad-l' ? '左スクロールパッド' : '右スクロールパッド'
    case 'combo': return 'コンボ'
    case 'ball': return 'トラックボール'
  }
}

export function sameTarget(a: Selection | null, b: Selection | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'key' && b.kind === 'key') return a.keyId === b.keyId
  if (a.kind === 'encoder' && b.kind === 'encoder') return a.slot === b.slot
  if (a.kind === 'pad' && b.kind === 'pad') return a.sensor === b.sensor && a.slot === b.slot
  if (a.kind === 'combo' && b.kind === 'combo') return a.comboId === b.comboId
  return a.kind === 'ball'
}

/* -------------------------------------------------- 旧キーコードの移行 */

/** v1 で MO_1/MO_2/MO_3 と呼んでいたキーコードを fn1/fn2/fn3 の新コードへ */
const LEGACY_LAYER_CODE_MAP: Record<string, Keycode> = {
  MO_1: 'FN_1',
  MO_2: 'FN_2',
  MO_3: 'FN_3',
}

function remapBinding(b: Binding): Binding {
  return {
    ...b,
    tap: LEGACY_LAYER_CODE_MAP[b.tap] ?? b.tap,
    ...(b.hold ? { hold: LEGACY_LAYER_CODE_MAP[b.hold] ?? b.hold } : {}),
  }
}

function remapBindingsRecord<T extends Record<string, Binding>>(rec: T): T {
  const out = {} as Record<string, Binding>
  for (const k of Object.keys(rec)) out[k] = remapBinding(rec[k])
  return out as T
}

function remapLegacyKeymap(km: Keymap): Keymap {
  return {
    ...km,
    layers: km.layers.map((l) => ({
      ...l,
      keys: remapBindingsRecord(l.keys),
      encoder: remapBindingsRecord(l.encoder),
      padL: remapBindingsRecord(l.padL),
      padR: remapBindingsRecord(l.padR),
    })),
    combos: km.combos.map((c) => ({ ...c, binding: remapBinding(c.binding) })),
  }
}

/* -------------------------------------------------- ストア本体 */

const DEFAULT_HUD: HudOptions = {
  showCombination: true,
  showJudgement: true,
  showCombo: true,
  showSensor: true,
  showLog: true,
  showMiniMap: true,
}

export const useKeymapStore = create<EditorState>()(
  persist(
    (set, get) => ({
      keymap: createDefaultKeymap(),
      editingLayer: 0,
      selection: null,
      captureEnabled: false,
      comboPickId: null,
      view: 'edit',
      hud: DEFAULT_HUD,
      hudDocked: true,
      authorName: '',

      setEditingLayer: (n) => set({ editingLayer: n }),
      select: (s) => set({ selection: s }),
      setCapture: (on) => set({ captureEnabled: on }),
      setComboPick: (id) => set({ comboPickId: id }),

      toggleComboKey: (comboId, keyId) => {
        const combo = get().keymap.combos.find((c) => c.id === comboId)
        if (!combo) return
        const keys = combo.keys.includes(keyId)
          ? combo.keys.filter((k) => k !== keyId)
          : [...combo.keys, keyId]
        get().updateCombo(comboId, { keys })
      },
      setView: (v) => set({ view: v }),
      setHud: (patch) => set({ hud: { ...get().hud, ...patch } }),
      setHudDocked: (on) => set({ hudDocked: on }),
      setAuthorName: (name) => set({ authorName: name }),

      setBinding: (layerId, target, binding) =>
        set({ keymap: writeBinding(get().keymap, layerId, target, binding) }),

      patchBinding: (layerId, target, patch) => {
        const km = get().keymap
        const current = getBinding(km, layerId, target) ?? { tap: 'TRANS' }
        set({ keymap: writeBinding(km, layerId, target, { ...current, ...patch }) })
      },

      setTap: (layerId, target, code) => get().patchBinding(layerId, target, { tap: code }),

      setHold: (layerId, target, code) => {
        const km = get().keymap
        const current = getBinding(km, layerId, target) ?? { tap: 'TRANS' }
        const next: Binding = { ...current }
        if (code === undefined || code === 'NONE') delete next.hold
        else next.hold = code
        set({ keymap: writeBinding(km, layerId, target, next) })
      },

      renameLayer: (layerId, name) =>
        set({
          keymap: {
            ...get().keymap,
            layers: get().keymap.layers.map((l) => (l.id === layerId ? { ...l, name } : l)),
          },
        }),

      recolorLayer: (layerId, color) =>
        set({
          keymap: {
            ...get().keymap,
            layers: get().keymap.layers.map((l) => (l.id === layerId ? { ...l, color } : l)),
          },
        }),

      clearLayer: (layerId) =>
        set({
          keymap: {
            ...get().keymap,
            layers: get().keymap.layers.map((l) => (l.id === layerId ? { ...l, keys: {} } : l)),
          },
        }),

      addCombo: () => {
        const id = `combo-${Date.now().toString(36)}`
        const combo: Combo = {
          id,
          name: '新しいコンボ',
          keys: [],
          binding: { tap: 'NONE' },
          timeoutMs: 50,
          layers: [get().editingLayer],
          enabled: true,
        }
        set({ keymap: { ...get().keymap, combos: [...get().keymap.combos, combo] } })
        return id
      },

      updateCombo: (id, patch) =>
        set({
          keymap: {
            ...get().keymap,
            combos: get().keymap.combos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          },
        }),

      removeCombo: (id) =>
        set({
          keymap: { ...get().keymap, combos: get().keymap.combos.filter((c) => c.id !== id) },
          selection: null,
          comboPickId: null,
        }),

      setTrackball: (patch) =>
        set({ keymap: { ...get().keymap, trackball: { ...get().keymap.trackball, ...patch } } }),

      setSettings: (patch) =>
        set({ keymap: { ...get().keymap, settings: { ...get().keymap.settings, ...patch } } }),

      importKeymap: (km) => set({ keymap: km, selection: null, editingLayer: 0 }),

      resetKeymap: () => set({ keymap: createDefaultKeymap(), selection: null, editingLayer: 0 }),
    }),
    {
      name: 'orca-type/keymap',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<
          Pick<EditorState, 'keymap' | 'hud' | 'hudDocked' | 'editingLayer' | 'authorName'>
        >
        if (version < 2 && state?.keymap) {
          return { ...state, keymap: remapLegacyKeymap(state.keymap) } as EditorState
        }
        return state as EditorState
      },
      partialize: (s) => ({
        keymap: s.keymap,
        hud: s.hud,
        hudDocked: s.hudDocked,
        editingLayer: s.editingLayer,
        authorName: s.authorName,
      }),
    },
  ),
)
