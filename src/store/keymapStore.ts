import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MAX_LAYERS, type Keycode } from '../data/keycodes'
import { normalizeKeymap } from '../data/normalize'
import { keymapIdFromUrl } from '../lib/permalink'
import { SWITCH_SOUND_PROFILES, type SwitchSoundProfile } from '../lib/switchSound'
import {
  DEFAULT_ESC_COLOR,
  type Binding, type Combo, type Keymap, type KeymapSettings,
  type LayerColor, type TrackballConfig,
} from '../data/types'
import { blankLayer, createKeymap, DEFAULT_KEYBOARD, keyboardOf } from '../keyboards/registry'
import type { KeyboardDefinition, KeyId, SensorId, SensorSlot } from '../keyboards/types'

/** 編集対象。キー・センサー（エンコーダー／パッド）のスロット・コンボを同じ型で指す */
export type BindingTarget =
  | { kind: 'key'; keyId: KeyId }
  | { kind: 'sensor'; sensorId: SensorId; slot: SensorSlot }
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

/** 打鍵音（見た目や割当とは関係ない、この端末での好み） */
export interface SoundOptions {
  profile: SwitchSoundProfile
  /** 0〜1 */
  volume: number
}

interface EditorState {
  keymap: Keymap
  /**
   * 編集中でないキーボードのキーマップ（キーボード ID → キーマップ）。
   * キーボードを切り替えても、前のキーボードの編集内容はここに残しておき、戻ったときに復元する。
   */
  savedKeymaps: Record<string, Keymap>
  /** 編集中のレイヤー */
  editingLayer: number
  selection: Selection | null
  captureEnabled: boolean
  /** 盤面クリックでコンボのキーを選んでいる最中なら、そのコンボ ID */
  comboPickId: string | null
  /** キーのクイック編集メニューを開いている最中か（開いている間はレイヤー切替のショートカットを止める） */
  keyMenuOpen: boolean
  view: ViewId
  hud: HudOptions
  /** HUD をページ内にドッキング表示するか */
  hudDocked: boolean
  sound: SoundOptions

  setEditingLayer: (n: number) => void
  select: (s: Selection | null) => void
  setCapture: (on: boolean) => void
  setComboPick: (id: string | null) => void
  setKeyMenuOpen: (open: boolean) => void
  toggleComboKey: (comboId: string, keyId: KeyId) => void
  setView: (v: ViewId) => void
  setHud: (patch: Partial<HudOptions>) => void
  setHudDocked: (on: boolean) => void
  setSound: (patch: Partial<SoundOptions>) => void

  setBinding: (layerId: number, target: BindingTarget, binding: Binding) => void
  patchBinding: (layerId: number, target: BindingTarget, patch: Partial<Binding>) => void
  setTap: (layerId: number, target: BindingTarget, code: Keycode) => void
  setHold: (layerId: number, target: BindingTarget, code: Keycode | undefined) => void

  renameLayer: (layerId: number, name: string) => void
  recolorLayer: (layerId: number, color: LayerColor) => void
  clearLayer: (layerId: number) => void
  /** 白紙のレイヤーを末尾に足す（MAX_LAYERS まで） */
  addLayer: () => void
  /** 末尾のレイヤーを消す（最低 1 枚は残す） */
  removeLastLayer: () => void

  addCombo: () => string
  updateCombo: (id: string, patch: Partial<Combo>) => void
  removeCombo: (id: string) => void

  setTrackball: (patch: Partial<TrackballConfig>) => void
  setSettings: (patch: Partial<KeymapSettings>) => void

  /** 読み込んだキーマップに差し替える。別のキーボードのものなら、いまのキーマップは保存しておいて切り替える */
  importKeymap: (km: Keymap) => void
  resetKeymap: () => void
  /** 編集するキーボードを切り替える。そのキーボードの前回のキーマップがあれば復元し、無ければ初期キーマップを作る */
  switchKeyboard: (def: KeyboardDefinition) => void
  /** 保存しておいた別のキーボードのキーマップを消す */
  forgetKeyboard: (keyboardId: string) => void
}

/* -------------------------------------------------- 割当の読み書き補助 */

export function getBinding(keymap: Keymap, layerId: number, target: BindingTarget): Binding | undefined {
  if (target.kind === 'combo') {
    return keymap.combos.find((c) => c.id === target.comboId)?.binding
  }
  const layer = keymap.layers[layerId]
  if (!layer) return undefined
  return target.kind === 'key'
    ? layer.keys[target.keyId]
    : layer.sensors[target.sensorId]?.[target.slot]
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
    if (target.kind === 'key') {
      return { ...layer, keys: { ...layer.keys, [target.keyId]: binding } }
    }
    const slots = { ...layer.sensors[target.sensorId], [target.slot]: binding }
    return { ...layer, sensors: { ...layer.sensors, [target.sensorId]: slots } }
  })
  return { ...keymap, layers }
}

export function sameTarget(a: Selection | null, b: Selection | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === 'key' && b.kind === 'key') return a.keyId === b.keyId
  if (a.kind === 'sensor' && b.kind === 'sensor') return a.sensorId === b.sensorId && a.slot === b.slot
  if (a.kind === 'combo' && b.kind === 'combo') return a.comboId === b.comboId
  return a.kind === 'ball'
}

/** 編集中の状態をまっさらにして、キーマップを差し替えるときの共通部分 */
const freshEditing = { selection: null, editingLayer: 0, comboPickId: null } as const

/** いまのキーマップを棚に戻し、next を編集対象にする */
function swapIn(state: Pick<EditorState, 'keymap' | 'savedKeymaps'>, next: Keymap) {
  const { [next.keyboard]: _taken, ...rest } = state.savedKeymaps
  const savedKeymaps = state.keymap.keyboard === next.keyboard
    ? rest
    : { ...rest, [state.keymap.keyboard]: state.keymap }
  return { keymap: next, savedKeymaps, ...freshEditing }
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

const DEFAULT_SOUND: SoundOptions = { profile: 'off', volume: 0.6 }

const STORAGE_KEY = 'orca-map/keymap'
const STORAGE_VERSION = 3
const LEGACY_STORAGE_KEY = 'orca-type/keymap'

/** ORCA TYPE 時代の保存データを一度だけ新しいキーへ引き継ぐ */
function migrateLegacyStorage() {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy !== null && localStorage.getItem(STORAGE_KEY) === null) {
      localStorage.setItem(STORAGE_KEY, legacy)
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    /* localStorage が使えない環境では何もしない */
  }
}

migrateLegacyStorage()

export const useKeymapStore = create<EditorState>()(
  persist(
    (set, get) => ({
      keymap: createKeymap(DEFAULT_KEYBOARD),
      savedKeymaps: {},
      editingLayer: 0,
      selection: null,
      captureEnabled: false,
      comboPickId: null,
      keyMenuOpen: false,
      // X などで共有された投稿のリンク（?k=<投稿ID>）から来たら、最初から「みんなの配列」を開く
      view: keymapIdFromUrl() ? 'feed' : 'edit',
      hud: DEFAULT_HUD,
      hudDocked: true,
      sound: DEFAULT_SOUND,

      setEditingLayer: (n) => set({ editingLayer: n }),
      select: (s) => set({ selection: s }),
      setCapture: (on) => set({ captureEnabled: on }),
      setComboPick: (id) => set({ comboPickId: id }),
      setKeyMenuOpen: (open) => set({ keyMenuOpen: open }),

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
      setSound: (patch) => set({ sound: { ...get().sound, ...patch } }),

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

      addLayer: () => {
        const keymap = get().keymap
        if (keymap.layers.length >= MAX_LAYERS) return
        const layer = blankLayer(keyboardOf(keymap), keymap.layers.length)
        set({ keymap: { ...keymap, layers: [...keymap.layers, layer] }, editingLayer: layer.id })
      },

      removeLastLayer: () => {
        const keymap = get().keymap
        if (keymap.layers.length <= 1) return
        const removed = keymap.layers.length - 1
        const combos = keymap.combos.map((c) => (
          c.layers.includes(removed) ? { ...c, layers: c.layers.filter((n) => n !== removed) } : c
        ))
        set({
          keymap: { ...keymap, layers: keymap.layers.slice(0, removed), combos },
          editingLayer: Math.min(get().editingLayer, removed - 1),
          selection: null,
        })
      },

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

      setSettings: (patch) => {
        const keymap = get().keymap
        const prevBody = keymap.settings.bodyColor ?? 'white'
        const nextBody = patch.bodyColor
        let { trackball } = keymap
        const linked: Partial<KeymapSettings> = {}
        // 本体を白↔黒で切り替えたら、本体と同じ色だったボールと esc も一緒に切り替える（他の色はそのまま）
        if (nextBody && nextBody !== prevBody) {
          if ((trackball.color ?? 'white') === prevBody) trackball = { ...trackball, color: nextBody }
          if ((keymap.settings.escColor ?? DEFAULT_ESC_COLOR) === prevBody) linked.escColor = nextBody
        }
        set({ keymap: { ...keymap, trackball, settings: { ...keymap.settings, ...linked, ...patch } } })
      },

      importKeymap: (km) => set(swapIn(get(), km)),

      resetKeymap: () => set({ keymap: createKeymap(keyboardOf(get().keymap)), ...freshEditing }),

      switchKeyboard: (def) => {
        const state = get()
        if (state.keymap.keyboard === def.id) return
        set(swapIn(state, state.savedKeymaps[def.id] ?? createKeymap(def)))
      },

      forgetKeyboard: (keyboardId) => {
        const { [keyboardId]: _gone, ...rest } = get().savedKeymaps
        set({ savedKeymaps: rest })
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      // v1: Orca echo 専用の形 / v2: MO_n → FN_n の改名 / v3: キーボード定義を参照する形。
      // どの版から来ても、キーマップは normalizeKeymap で今の形にそろえる
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<EditorState>
        if (version >= STORAGE_VERSION) return state as EditorState
        const keymap = normalizeKeymap(state.keymap) ?? createKeymap(DEFAULT_KEYBOARD)
        return { ...state, keymap, savedKeymaps: {}, editingLayer: 0 } as EditorState
      },
      // 同じ版の保存データでも、壊れていたり手で書き換えられていたりしたら初期状態に戻す
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as Partial<EditorState>
        const keymap = normalizeKeymap(state.keymap) ?? current.keymap
        const savedKeymaps: Record<string, Keymap> = {}
        for (const km of Object.values(state.savedKeymaps ?? {})) {
          const n = normalizeKeymap(km)
          if (n && n.keyboard !== keymap.keyboard) savedKeymaps[n.keyboard] = n
        }
        const editingLayer = typeof state.editingLayer === 'number' && state.editingLayer < keymap.layers.length
          ? state.editingLayer
          : 0
        const sound = state.sound
        return {
          ...current,
          ...(state.hud ? { hud: { ...current.hud, ...state.hud } } : {}),
          ...(typeof state.hudDocked === 'boolean' ? { hudDocked: state.hudDocked } : {}),
          ...(sound && SWITCH_SOUND_PROFILES.includes(sound.profile)
            && typeof sound.volume === 'number' && sound.volume >= 0 && sound.volume <= 1
            ? { sound: { profile: sound.profile, volume: sound.volume } }
            : {}),
          keymap,
          savedKeymaps,
          editingLayer,
        }
      },
      partialize: (s) => ({
        keymap: s.keymap,
        savedKeymaps: s.savedKeymaps,
        hud: s.hud,
        hudDocked: s.hudDocked,
        sound: s.sound,
        editingLayer: s.editingLayer,
      }),
    },
  ),
)
