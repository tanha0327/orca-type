import { getKeycode } from '../src/data/keycodes.js'
import {
  DEFAULT_ESC_COLOR, ESC_COLOR_FACE, ESC_COLOR_TEXT, FLAVOR_LABEL, LAYER_COLOR_HEX,
  TRACKBALL_COLOR_DARK, TRACKBALL_COLOR_GRADIENT, TRACKBALL_COLOR_LABEL,
  isModTap, type BodyColor, type Keymap, type TrackballColor,
} from '../src/data/types.js'
import { classifyKeymap, getCategory } from '../src/engine/analyze.js'
import { glyphOf, resolveKey, resolveSensor } from '../src/engine/resolve.js'
import { boardBounds } from '../src/keyboards/geometry.js'
import { hasBall, keyboardOf } from '../src/keyboards/registry.js'
import { SENSOR_SLOTS, type KeyDef, type SensorDef } from '../src/keyboards/types.js'
import { getOsTag, osOf } from '../src/lib/os.js'
import type { SharedKeymapRow } from './sharedKeymap.js'

/*
 * X などに貼られた共有リンクのカード画像（1200×630）。
 * 左に投稿の L0（ベース）レイヤーの盤面、右にその配列の特徴を並べる。
 * 盤面は投稿のキーボード定義（Orca echo・Corne・取り込んだ定義など）からそのまま描く。
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
/** 左のカードの中で盤面に使える大きさ（見出しとレイヤー一覧のぶんを除く） */
const BOARD_MAX_W = LEFT_WIDTH - 22 * 2 - 8
const BOARD_MAX_H = 360

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

/** 盤面の縮尺（1u の px）と原点 */
interface Place { u: number; minX: number; minY: number }

function keyCap(k: KeyDef, p: Place, keymap: Keymap): CardNode {
  const { u } = p
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
  const fontSize = Math.min(len <= 2 ? u * 0.38 : len === 3 ? u * 0.29 : len <= 5 ? u * 0.22 : u * 0.17, 24)
  const small = Math.min(u * 0.17, 11)
  const inset = u * 0.045

  // 回転（分割キーボードの親指キーなど）。中心 (rx, ry) を、このキー自身の左上からの px に直す
  const r = k.r ?? 0
  const rotation: Style = r
    ? {
        transform: `rotate(${r}deg)`,
        transformOrigin: `${((k.rx ?? 0) - k.x) * u - inset}px ${((k.ry ?? 0) - k.y) * u - inset}px`,
      }
    : {}

  return h('div', {
    position: 'absolute',
    left: (k.x - p.minX) * u + inset,
    top: (k.y - p.minY) * u + inset,
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
    ...rotation,
  }, [
    hold && h('div', {
      position: 'absolute', top: u * 0.05, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      fontSize: small * 1.1, fontWeight: 900, color: PINK, lineHeight: 1,
    }, [truncate(hold.modSymbol ?? hold.label, 6)]),
    h('div', { display: 'flex', fontSize, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }, [truncate(label, 7)]),
    targetLayer && h('div', {
      position: 'absolute', bottom: u * 0.07, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      fontSize: small, fontWeight: 900, color: LAYER_COLOR_HEX[targetLayer.color], lineHeight: 1,
    }, [truncate(targetLayer.name, 7)]),
  ])
}

function sensorView(s: SensorDef, p: Place, keymap: Keymap): CardNode {
  const { u } = p
  const box: Style = {
    position: 'absolute',
    left: (s.x - p.minX) * u,
    top: (s.y - p.minY) * u,
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
  return h('div', {
    ...box,
    borderRadius: u * 0.14,
    background: mid,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${u * 0.1}px 0`,
    color: TRACKBALL_COLOR_DARK[ball] ? PAPER : INK,
    fontSize: Math.min(u * 0.17, 11),
    fontWeight: 900,
    lineHeight: 1,
  }, SENSOR_SLOTS.pad.map((slot) => h('div', { display: 'flex' }, [
    truncate(glyphOf(resolveSensor(keymap, [0], s.id, slot).binding.tap) || '·', 6),
  ])))
}

/** 盤面全体。キーボードの形に合わせて、決められた枠に収まる縮尺で描く */
function board(keymap: Keymap): CardNode {
  const def = keyboardOf(keymap)
  const b = boardBounds(def)
  const u = Math.min(BOARD_MAX_W / b.w, BOARD_MAX_H / b.h)
  const p: Place = { u, minX: b.minX, minY: b.minY }
  return h('div', {
    position: 'relative',
    display: 'flex',
    width: b.w * u,
    height: b.h * u,
  }, [
    ...(def.sensors ?? []).map((s) => sensorView(s, p, keymap)),
    ...def.keys.map((k) => keyCap(k, p, keymap)),
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

/**
 * 右に並べる特徴。枠に収まるよう最大 6 項目。
 * 絵文字は描画時に CDN から取ってくるので出たり出なかったりする。カードでは文字だけにする
 */
function features(item: CardInput): [string, CardChild[]][] {
  const { keymap } = item
  const def = keyboardOf(keymap)
  const category = getCategory(item.category ?? classifyKeymap(keymap))
  const os = osOf(keymap)
  const combos = keymap.combos.filter((c) => c.enabled).length
  const modTaps = keymap.layers.reduce(
    (n, layer) => n + Object.values(layer.keys ?? {}).filter((b) => isModTap(b)).length, 0,
  )
  const ball: TrackballColor = keymap.trackball.color ?? 'white'

  const rows: [string, CardChild[]][] = [
    ['キーボード', [truncate(def.name, 22)]],
    ['タイプ', [category.label]],
    ['レイヤー', [`${keymap.layers.length} レイヤー`]],
    ['コンボ / 長押し（MOD-TAP）', [
      `${combos > 0 ? `${combos} 個` : 'なし'} / ${modTaps > 0 ? `${modTaps} か所` : 'なし'}`,
    ]],
  ]
  if (os) rows.push(['OS', [getOsTag(os).label]])
  if (hasBall(def)) {
    rows.push(['トラックボール', [colorDot(ball), `${TRACKBALL_COLOR_LABEL[ball]}・${keymap.trackball.dpi} DPI`]])
  }
  rows.push(['タッピングターム', [`${keymap.settings.tappingTermMs} ms・${FLAVOR_LABEL[keymap.settings.flavor] ?? ''}`]])
  return rows.slice(0, 6)
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

type CardInput = Pick<SharedKeymapRow, 'name' | 'author' | 'keymap' | 'category'>

export function buildCard(item: CardInput): CardNode {
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
      base && chip(`L0 ${truncate(base.name, 12)}`, LAYER_COLOR_HEX[base.color]),
      h('div', { display: 'flex', marginLeft: 10, color: MUTED, fontWeight: 700 }, ['ベースレイヤーの配列']),
    ]),
    h('div', { display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, [
      board(keymap),
    ]),
    h('div', { display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 15, fontWeight: 900 },
      keymap.layers.slice(0, 12).map((l) => chip(`L${l.id} ${truncate(l.name, 10)}`, LAYER_COLOR_HEX[l.color]))),
  ])

  const right = h('div', { ...cardFrame, width: RIGHT_WIDTH, padding: '24px 24px 20px' }, [
    h('div', {
      display: 'flex', fontSize: titleSize, fontWeight: 900, lineHeight: 1.12, letterSpacing: '-0.02em',
    }, [truncate(item.name, 30)]),
    h('div', { display: 'flex', marginTop: 8, fontSize: 18, fontWeight: 700, color: MUTED }, [
      `${truncate(item.author, 16)} さんの配列`,
    ]),
    h('div', { display: 'flex', flexDirection: 'column', marginTop: 14, gap: 8 },
      features(item).map(([label, value]) => h('div', { display: 'flex', flexDirection: 'column' }, [
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
