import { getKeycode } from '../data/keycodes'
import { isTrans, type Binding, type Keymap, type Layer } from '../data/types'
import { bindableSensors, keyboardOf } from '../keyboards/registry'
import { SENSOR_SLOTS, type KeyId } from '../keyboards/types'
import { modSymbolOf } from './resolve'

/* ================================================================
   みんなの配列の「自動フォルダ分け」と「自分に近い配列」のための解析。
   resolve.ts と同じく副作用のない純粋関数だけを置く。
   ================================================================ */

export type CategoryId =
  | 'homerow' | 'vim' | 'combo' | 'mouse' | 'multilayer' | 'minimal' | 'standard'

export interface CategoryDef {
  id: CategoryId
  label: string
  emoji: string
  /** どういう配列が入るフォルダか（ツールチップ・投稿モーダル用） */
  help: string
}

/** 表示順。classifyKeymap の判定順もこれと同じ */
export const FEED_CATEGORIES: readonly CategoryDef[] = [
  { id: 'homerow', label: 'ホームロー修飾派', emoji: '🏠', help: 'ASDF / JKL; の長押しに修飾キーを仕込んでいる配列' },
  { id: 'vim', label: 'Vim 派', emoji: '⌨', help: 'どこかのレイヤーで HJKL が矢印になっている配列' },
  { id: 'combo', label: 'コンボ使い', emoji: '🤝', help: '同時押しのコンボを 3 つ以上使っている配列' },
  { id: 'mouse', label: 'マウス派', emoji: '🖱', help: 'クリックやポインタ操作をキーにたくさん割り当てている配列' },
  { id: 'multilayer', label: '多層派', emoji: '🗂', help: '5 枚以上のレイヤーを使い込んでいる配列' },
  { id: 'minimal', label: 'ミニマル', emoji: '◻', help: '2 枚以下のレイヤーで完結している配列' },
  { id: 'standard', label: 'スタンダード', emoji: '⭐', help: '上のどれにも当てはまらない、素直な配列' },
]

const CATEGORY_BY_ID = new Map<CategoryId, CategoryDef>(FEED_CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id: CategoryId): CategoryDef {
  return CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get('standard')!
}

export function isCategoryId(x: unknown): x is CategoryId {
  return typeof x === 'string' && CATEGORY_BY_ID.has(x as CategoryId)
}

/** Vim の H J K L と、その位置に置く矢印 */
const VIM_ARROWS: [string, string][] = [['H', 'LEFT'], ['J', 'DOWN'], ['K', 'UP'], ['L', 'RIGHT']]

/**
 * ベースレイヤーでそのキーコードを出しているキー。
 * キーボードごとにキーの位置は違うので、「H の位置」などは L0 の割当から見つける
 */
function keyOfBaseTap(km: Keymap, code: string): KeyId | undefined {
  const base = km.layers[0]
  return keyboardOf(km).keys.find((k) => base?.keys[k.id]?.tap === code)?.id
}

/** 文字キー（と ;）。ホームロー修飾は、どの配列でも文字キーの長押しに修飾を仕込む形になる */
const isAlphaCode = (code: string | undefined) => !!code && (/^[A-Z]$/.test(code) || code === 'SEMI')

/** 何も割り当てていない（透過か未割当） */
function isEmpty(b: Binding | undefined): boolean {
  return isTrans(b) || b!.tap === 'NONE'
}

function layerBindings(km: Keymap, layer: Layer): Binding[] {
  const def = keyboardOf(km)
  return [
    ...def.keys.map((k) => layer.keys[k.id]),
    ...bindableSensors(def).flatMap((s) => SENSOR_SLOTS[s.kind].map((slot) => layer.sensors[s.id]?.[slot])),
  ].filter((b): b is Binding => !!b)
}

/** TRANS / NONE 以外の割当が 1 つでもあるレイヤーの枚数 */
export function usedLayerCount(km: Keymap): number {
  return km.layers.filter((layer) => layerBindings(km, layer).some((b) => !isEmpty(b))).length
}

/**
 * 配列の特徴から、みんなの配列のフォルダ（カテゴリ）を 1 つ決める。
 * FEED_CATEGORIES の上から順に判定し、最初に当てはまったものを返す。
 */
export function classifyKeymap(km: Keymap): CategoryId {
  const base = km.layers[0]
  const keys = keyboardOf(km).keys

  if (base) {
    const homeMods = keys.filter((k) => {
      const b = base.keys[k.id]
      return isAlphaCode(b?.tap) && !!modSymbolOf(b?.hold)
    }).length
    if (homeMods >= 4) return 'homerow'
  }

  const vimKeys = VIM_ARROWS.map(([letter, arrow]) => [keyOfBaseTap(km, letter), arrow] as const)
  const hasVim = km.layers.some((layer) =>
    vimKeys.filter(([id, arrow]) => id !== undefined && layer.keys[id]?.tap === arrow).length >= 3)
  if (hasVim) return 'vim'

  if (km.combos.filter((c) => c.enabled).length >= 3) return 'combo'

  let mouseKeys = 0
  for (const layer of km.layers) {
    for (const k of keys) {
      const b = layer.keys[k.id]
      if (!b) continue
      if (getKeycode(b.tap).category === 'mouse') mouseKeys++
      if (b.hold && getKeycode(b.hold).category === 'mouse') mouseKeys++
    }
  }
  if (mouseKeys >= 4) return 'mouse'

  const used = usedLayerCount(km)
  if (used >= 5) return 'multilayer'
  if (used <= 2) return 'minimal'
  return 'standard'
}

function sameBinding(a: Binding | undefined, b: Binding | undefined): boolean {
  const tapA = a?.tap ?? 'TRANS'
  const tapB = b?.tap ?? 'TRANS'
  return tapA === tapB && (a?.hold ?? '') === (b?.hold ?? '')
}

/**
 * 2 つの配列がどれくらい似ているか（0〜1）。
 * 全レイヤーのキー・エンコーダー・パッドの単押し／長押しを位置ごとに比べ、有効なコンボも比べる。
 * L1 以降で両方とも何も割り当てていない位置は、似ている根拠にならないので数えない。
 * 別のキーボードの配列はキーの位置が対応しないので、比べずに 0 とする（近い順ではいちばん後ろ）。
 */
export function keymapSimilarity(a: Keymap, b: Keymap): number {
  if (a.keyboard !== b.keyboard) return 0
  const def = keyboardOf(a)
  const sensors = bindableSensors(def)
  let same = 0
  let total = 0
  const compare = (x: Binding | undefined, y: Binding | undefined, isBase: boolean) => {
    if (!isBase && isEmpty(x) && isEmpty(y)) return
    total++
    if (sameBinding(x, y)) same++
  }

  const layerCount = Math.max(a.layers.length, b.layers.length)
  for (let i = 0; i < layerCount; i++) {
    const la = a.layers[i]
    const lb = b.layers[i]
    const isBase = i === 0
    for (const k of def.keys) compare(la?.keys[k.id], lb?.keys[k.id], isBase)
    for (const s of sensors) {
      for (const slot of SENSOR_SLOTS[s.kind]) compare(la?.sensors[s.id]?.[slot], lb?.sensors[s.id]?.[slot], isBase)
    }
  }

  // コンボは「同じキーの組み合わせで同じものを出すか」で比べる
  const comboSig = (c: Keymap['combos'][number]) => `${[...c.keys].sort().join('+')}=${c.binding.tap}`
  const combosA = new Set(a.combos.filter((c) => c.enabled).map(comboSig))
  const combosB = new Set(b.combos.filter((c) => c.enabled).map(comboSig))
  for (const sig of new Set([...combosA, ...combosB])) {
    total++
    if (combosA.has(sig) && combosB.has(sig)) same++
  }

  return total === 0 ? 1 : same / total
}
