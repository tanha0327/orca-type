import { getKeycode } from '../data/keycodes'
import { KEYS, type KeyId } from '../data/layout'
import {
  ENCODER_SLOTS, PAD_SLOTS, isTrans,
  type Binding, type Keymap, type Layer,
} from '../data/types'
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

/** ホームロー（A S D F / J K L ;） */
const HOME_ROW_KEYS: KeyId[] = ['L11', 'L12', 'L13', 'L14', 'R12', 'R13', 'R14', 'R15']
/** H J K L の位置と、Vim の矢印の対応 */
const VIM_ARROWS: [KeyId, string][] = [['R11', 'LEFT'], ['R12', 'DOWN'], ['R13', 'UP'], ['R14', 'RIGHT']]

/** 何も割り当てていない（透過か未割当） */
function isEmpty(b: Binding | undefined): boolean {
  return isTrans(b) || b!.tap === 'NONE'
}

function layerBindings(layer: Layer): Binding[] {
  return [
    ...KEYS.map((k) => layer.keys[k.id]),
    ...ENCODER_SLOTS.map((s) => layer.encoder?.[s]),
    ...PAD_SLOTS.map((s) => layer.padL?.[s]),
    ...PAD_SLOTS.map((s) => layer.padR?.[s]),
  ].filter((b): b is Binding => !!b)
}

/** TRANS / NONE 以外の割当が 1 つでもあるレイヤーの枚数 */
export function usedLayerCount(km: Keymap): number {
  return km.layers.filter((layer) => layerBindings(layer).some((b) => !isEmpty(b))).length
}

/**
 * 配列の特徴から、みんなの配列のフォルダ（カテゴリ）を 1 つ決める。
 * FEED_CATEGORIES の上から順に判定し、最初に当てはまったものを返す。
 */
export function classifyKeymap(km: Keymap): CategoryId {
  const base = km.layers[0]

  if (base) {
    const homeMods = HOME_ROW_KEYS.filter((id) => !!modSymbolOf(base.keys[id]?.hold)).length
    if (homeMods >= 4) return 'homerow'
  }

  const hasVim = km.layers.some((layer) =>
    VIM_ARROWS.filter(([id, code]) => layer.keys[id]?.tap === code).length >= 3)
  if (hasVim) return 'vim'

  if (km.combos.filter((c) => c.enabled).length >= 3) return 'combo'

  let mouseKeys = 0
  for (const layer of km.layers) {
    for (const k of KEYS) {
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
 */
export function keymapSimilarity(a: Keymap, b: Keymap): number {
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
    for (const k of KEYS) compare(la?.keys[k.id], lb?.keys[k.id], isBase)
    for (const s of ENCODER_SLOTS) compare(la?.encoder?.[s], lb?.encoder?.[s], isBase)
    for (const s of PAD_SLOTS) {
      compare(la?.padL?.[s], lb?.padL?.[s], isBase)
      compare(la?.padR?.[s], lb?.padR?.[s], isBase)
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
