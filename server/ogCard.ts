import { getKeycode } from '../src/data/keycodes'
import { KEYS, SENSORS, halfExtent, type KeyDef, type SensorDef } from '../src/data/layout'
import {
  BODY_COLOR_LABEL, DEFAULT_ESC_COLOR, ESC_COLOR_FACE, ESC_COLOR_TEXT, FLAVOR_LABEL, LAYER_COLOR_HEX,
  TRACKBALL_COLOR_DARK, TRACKBALL_COLOR_GRADIENT, TRACKBALL_COLOR_LABEL,
  isModTap, type BodyColor, type Keymap, type PadSlot, type TrackballColor,
} from '../src/data/types'
import { glyphOf, resolveKey, resolveSensor } from '../src/engine/resolve'
import type { SharedKeymapRow } from './sharedKeymap'

/*
 * X などに貼られた共有リンクのカード画像（1200×630）。
 * 左に投稿の L0（ベース）レイヤーの盤面、右にその配列の特徴を並べる。
 * 配色はサイトと同じ（黄色の地・黒の太い縁・ハードシャドウ）。
 *
 * Satori（@vercel/og）は React 要素と同じ { type, props } の形を受け取るので、
 * React を関数に持ち込まずにその形を直接組み立てる。
 * Satori の制約: 子が複数ある div は display: flex が必須、CSS 変数は使えない。
 */

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630
const PAD = { top: 28, right: 36, bottom: 36, left: 28 }
const GAP = 26
const LEFT_WIDTH = 752
const RIGHT_WIDTH = CARD_WIDTH - PAD.left - PAD.right - LEFT_WIDTH - GAP

const INK = '#111111'
const PAPER = '#faf7f0'
const BG = '#ffd60a'
const PINK = '#ff3d71'
const MUTED = '#6b675f'

/** アプリ側の色定義は CSS 変数を含むので、ここで実際の色に置き換える */
const CSS_VAR_COLOR: Record<string, string> = {
  'var(--color-paper)': PAPER,
  'var(--color-ink)': INK,
}
const cssColor = (c: string) => CSS_VAR_COLOR[c] ?? c

type Style = Record<string, string | number>
export type CardChild = CardNode | string
export interface CardNode {
  type: string
  props: { style?: Style; src?: string; width?: number; height?: number; children?: CardChild[] }
}

function h(type: string, style: Style, children: (CardChild | false | null | undefined)[] = []): CardNode {
  const kids = children.filter((c): c is CardChild => !!c || c === '')
  // Satori は空配列でも「子が複数ある」扱いにして display: flex を要求するので、子が無ければ付けない
  return { type, props: kids.length > 0 ? { style, children: kids } : { style } }
}

function truncate(s: string, max: number): string {
  const chars = [...s]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : s
}

/* ================================================================ 盤面 */

/** 左右の盤面の間隔（ユニット） */
const HALF_GAP = 0.55

function keyCap(k: KeyDef, left: number, u: number, keymap: Keymap): CardNode {
  const dark = (keymap.settings.bodyColor ?? 'white') === 'black'
  let face = dark ? INK : PAPER
  let text = dark ? PAPER : INK
  const border = dark ? PAPER : INK
  if (k.accent) {
    const esc = keymap.settings.escColor ?? DEFAULT_ESC_COLOR
    face = cssColor(ESC_COLOR_FACE[esc])
    text = cssColor(ESC_COLOR_TEXT[esc])
  }

  const binding = resolveKey(keymap, [0], k.id).binding
  const label = glyphOf(binding.tap)
  const hold = isModTap(binding) ? getKeycode(binding.hold) : undefined
  const target = getKeycode(binding.tap).layerTarget
  const targetLayer = target !== undefined ? keymap.layers[target] : undefined

  const len = [...label].length
  const fontSize = len <= 2 ? u * 0.4 : len === 3 ? u * 0.3 : len <= 5 ? u * 0.22 : u * 0.17
  const inset = u * 0.045

  return h('div', {
    position: 'absolute',
    left: left + k.x * u + inset,
    top: k.y * u + inset,
    width: k.w * u - inset * 2,
    height: k.h * u - inset * 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: face,
    color: text,
    border: `2px solid ${border}`,
    borderRadius: u * 0.16,
    boxShadow: `2px 2px 0 ${INK}`,
    overflow: 'hidden',
  }, [
    hold && h('div', {
      position: 'absolute', top: u * 0.05, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      fontSize: u * 0.19, fontWeight: 900, color: PINK, lineHeight: 1,
    }, [truncate(hold.modSymbol ?? hold.label, 6)]),
    h('div', { display: 'flex', fontSize, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }, [truncate(label, 7)]),
    targetLayer && h('div', {
      position: 'absolute', bottom: u * 0.07, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      fontSize: u * 0.16, fontWeight: 900, color: LAYER_COLOR_HEX[targetLayer.color], lineHeight: 1,
    }, [truncate(targetLayer.name, 7)]),
  ])
}

function sensorView(s: SensorDef, left: number, u: number, keymap: Keymap): CardNode {
  const box: Style = {
    position: 'absolute',
    left: left + s.x * u,
    top: s.y * u,
    width: s.w * u,
    height: s.h * u,
    border: `2px solid ${INK}`,
    boxShadow: `2px 2px 0 ${INK}`,
  }
  const ball: TrackballColor = keymap.trackball.color ?? 'white'

  if (s.kind === 'ball') {
    const [hi, mid, lo] = TRACKBALL_COLOR_GRADIENT[ball]
    return h('div', {
      ...box,
      borderRadius: '50%',
      backgroundImage: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${mid} 42%, ${lo} 100%)`,
    })
  }

  if (s.kind === 'encoder') {
    const body: BodyColor = keymap.settings.bodyColor ?? 'white'
    const [, mid] = TRACKBALL_COLOR_GRADIENT[body]
    const knurl = TRACKBALL_COLOR_DARK[body] ? PAPER : INK
    return h('div', {
      ...box,
      borderRadius: u * 0.1,
      backgroundColor: mid,
      backgroundImage: `repeating-linear-gradient(90deg, ${knurl} 0px, ${knurl} 1.5px, transparent 1.5px, transparent 4.5px)`,
    })
  }

  // スクロールパッド: 上スワイプ / タップ / 下スワイプ の割当を縦に並べる
  const [, mid] = TRACKBALL_COLOR_GRADIENT[ball]
  const text = TRACKBALL_COLOR_DARK[ball] ? PAPER : INK
  const order: PadSlot[] = ['up', 'tap', 'down']
  return h('div', {
    ...box,
    borderRadius: u * 0.14,
    background: mid,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${u * 0.1}px 0`,
    color: text,
    fontSize: u * 0.17,
    fontWeight: 900,
    lineHeight: 1,
  }, order.map((slot) => h('div', { display: 'flex' }, [
    truncate(glyphOf(resolveSensor(keymap, [0], s.id, slot).binding.tap) || '·', 6),
  ])))
}

function keyboard(keymap: Keymap, width: number): CardNode {
  const L = halfExtent('L')
  const R = halfExtent('R')
  const u = width / (L.w + HALF_GAP + R.w)
  const offset = { L: 0, R: (L.w + HALF_GAP) * u }
  return h('div', {
    position: 'relative',
    display: 'flex',
    width,
    height: Math.max(L.h, R.h) * u,
  }, [
    ...SENSORS.map((s) => sensorView(s, offset[s.half], u, keymap)),
    ...KEYS.map((k) => keyCap(k, offset[k.half], u, keymap)),
  ])
}

/* ================================================================ 特徴 */

function colorDot(color: TrackballColor | BodyColor): CardNode {
  const [hi, mid, lo] = TRACKBALL_COLOR_GRADIENT[color]
  return h('div', {
    width: 20, height: 20, borderRadius: '50%', border: `2px solid ${INK}`, marginRight: 6,
    backgroundImage: `radial-gradient(circle at 32% 28%, ${hi} 0%, ${mid} 42%, ${lo} 100%)`,
  })
}

function features(keymap: Keymap): [string, CardChild[]][] {
  const combos = keymap.combos.filter((c) => c.enabled).length
  const modTaps = keymap.layers.reduce(
    (n, layer) => n + Object.values(layer.keys).filter((b) => isModTap(b)).length, 0,
  )
  const body: BodyColor = keymap.settings.bodyColor ?? 'white'
  const ball: TrackballColor = keymap.trackball.color ?? 'white'
  return [
    ['レイヤー', [`${keymap.layers.length} レイヤー`]],
    ['コンボ', [combos > 0 ? `${combos} 個` : 'なし']],
    ['長押し（MOD-TAP）', [modTaps > 0 ? `${modTaps} か所` : 'なし']],
    ['タッピングターム', [`${keymap.settings.tappingTermMs} ms・${FLAVOR_LABEL[keymap.settings.flavor] ?? ''}`]],
    ['トラックボール', [`${keymap.trackball.dpi} DPI`]],
    ['本体 / ボール', [
      colorDot(body), `${BODY_COLOR_LABEL[body]}`,
      h('div', { width: 14 }), colorDot(ball), `${TRACKBALL_COLOR_LABEL[ball]}`,
    ]],
  ]
}

/* ================================================================ カード全体 */

const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="7" fill="#1b1b1d"/><rect x="6" y="7.5" width="20" height="20" rx="5" fill="#2e2e32"/><rect x="13" y="3.9" width="6" height="1.9" rx="0.95" fill="#d4d4d6"/><rect x="10" y="11.5" width="12" height="12" rx="3.2" fill="#b8231c"/><path d="M15 13.2H17V16.5H20.3V18.5H17V21.8H15V18.5H11.7V16.5H15Z" fill="#e8584c"/></svg>'
export const LOGO_TEXT = 'ORCA MAP'

const cardFrame: Style = {
  display: 'flex',
  flexDirection: 'column',
  background: PAPER,
  border: `4px solid ${INK}`,
  borderRadius: 20,
  boxShadow: `8px 8px 0 ${INK}`,
}

export function buildCard(item: Pick<SharedKeymapRow, 'name' | 'author' | 'keymap'>): CardNode {
  const { keymap } = item
  const base = keymap.layers[0]
  const nameLen = [...item.name].length
  const titleSize = nameLen <= 10 ? 44 : nameLen <= 18 ? 36 : 30

  const logo: CardNode = {
    type: 'img',
    props: { src: `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`, width: 34, height: 34 },
  }

  const left = h('div', { ...cardFrame, width: LEFT_WIDTH, padding: 22 }, [
    h('div', { display: 'flex', alignItems: 'center', fontSize: 17, fontWeight: 900 }, [
      base && chip(`L0 ${base.name}`, LAYER_COLOR_HEX[base.color]),
      h('div', { display: 'flex', marginLeft: 10, color: MUTED, fontWeight: 700 }, ['ベースレイヤーの配列']),
    ]),
    h('div', { display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, [
      keyboard(keymap, LEFT_WIDTH - 22 * 2 - 8),
    ]),
    h('div', { display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 15, fontWeight: 900 },
      keymap.layers.map((l) => chip(`L${l.id} ${truncate(l.name, 10)}`, LAYER_COLOR_HEX[l.color]))),
  ])

  const right = h('div', { ...cardFrame, width: RIGHT_WIDTH, padding: '26px 24px 22px' }, [
    h('div', {
      display: 'flex', fontSize: titleSize, fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.02em',
    }, [truncate(item.name, 30)]),
    h('div', { display: 'flex', marginTop: 8, fontSize: 18, fontWeight: 700, color: MUTED }, [
      `${truncate(item.author, 16)} さんの配列`,
    ]),
    h('div', { display: 'flex', flexDirection: 'column', marginTop: 16, gap: 9 },
      features(keymap).map(([label, value]) => h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', { display: 'flex', fontSize: 13, fontWeight: 700, color: MUTED }, [label]),
        h('div', { display: 'flex', alignItems: 'center', fontSize: 21, fontWeight: 900, lineHeight: 1.2 }, value),
      ]))),
    h('div', { display: 'flex', alignItems: 'center', marginTop: 'auto', gap: 10 }, [
      logo,
      h('div', { display: 'flex', fontFamily: 'Archivo', fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }, [LOGO_TEXT]),
    ]),
  ])

  return h('div', {
    display: 'flex',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    padding: `${PAD.top}px ${PAD.right}px ${PAD.bottom}px ${PAD.left}px`,
    gap: GAP,
    background: BG,
    color: INK,
    fontFamily: 'Noto Sans JP',
  }, [left, right])
}

function chip(text: string, background: string): CardNode {
  return h('div', {
    display: 'flex',
    padding: '4px 10px',
    border: `2px solid ${INK}`,
    borderRadius: 8,
    background,
    lineHeight: 1.2,
  }, [text])
}

/** カードに出てくる文字をすべて集める（フォントのサブセット取得用） */
export function collectText(node: CardChild): string {
  if (typeof node === 'string') return node
  return (node.props.children ?? []).map(collectText).join('')
}
