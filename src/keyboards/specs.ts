import type { SocketId, SwitchMount } from '../data/switches.js'
import type { KeyboardDefinition } from './types.js'

/* ================================================================
   キーボードのスペック（タグ）

   組み込みのキーボードは、作者・メーカーの公開情報（下の sources）から調べたタグと、
   「どの版（エディション）にどのソケットが付いているか」を持つ。
   同じキーボードでも版によって使えるスイッチが違う（Corne の Cherry 版と Chocolate 版など）ので、
   スイッチ探しはエディションごとのソケットで絞り込む。
   取り込んだキーボードは定義から分かることだけ（分割か・センサー）をタグにする。
   ================================================================ */

export type SpecTagId =
  | 'size-30' | 'size-40' | 'size-50' | 'size-60' | 'number-row'
  | 'split' | 'unibody' | 'column-stagger' | 'ortholinear' | 'row-stagger' | 'thumb-cluster'
  | 'cherry-mx' | 'choc-v1' | 'choc-v2' | 'gateron-lp' | 'keychron-lp' | 'hotswap' | 'solder'
  | 'backlight' | 'underglow' | 'oled' | 'encoder' | 'trackball' | 'scroll-pad' | 'wireless'

/** タグの分類（チップの色分けと並びに使う） */
export type SpecTagGroup = 'size' | 'shape' | 'switch' | 'feature'

export const SPEC_TAG_GROUP_LABEL: Record<SpecTagGroup, string> = {
  size: '大きさ',
  shape: '形・配列',
  switch: 'スイッチ',
  feature: '機能',
}

export const SPEC_TAG_GROUP_COLOR: Record<SpecTagGroup, string> = {
  size: 'var(--color-sand)',
  shape: 'var(--color-cyan)',
  switch: 'var(--color-lime)',
  feature: 'var(--color-paper)',
}

export interface SpecTagDef {
  id: SpecTagId
  /** チップに出す名前 */
  label: string
  /** 英語での呼び名（ショップや海外の資料で見かける表記） */
  en?: string
  group: SpecTagGroup
  detail: string
  /** スイッチの足の形を表すタグなら、その形（タップすると合うスイッチを出す） */
  mount?: SwitchMount
}

export const SPEC_TAGS: readonly SpecTagDef[] = [
  {
    id: 'size-30', label: '30%', group: 'size',
    detail: 'アルファベットの 3 段と親指キーだけの、30 キー台の超小型。数字・記号・矢印はすべてレイヤーに置く。'
      + '指をほとんど動かさずに打てるのが持ち味。',
  },
  {
    id: 'size-40', label: '40%', group: 'size',
    detail: '数字の段とファンクションキーの段を持たない、40 キー前後の小型キーボード。'
      + '数字や記号はレイヤー（LOWER / RAISE など）を切り替えて打つ。手の移動が少なく、机の上も広く使える。',
  },
  {
    id: 'size-50', label: '50%', group: 'size',
    detail: '40% に数字の段を 1 段足した大きさ。数字はそのまま打てて、記号やファンクションキーはレイヤーに置く。',
  },
  {
    id: 'size-60', label: '60%', group: 'size',
    detail: '一般的なキーボードから、ファンクションキーの段・矢印キー・テンキーを省いた大きさ。'
      + '数字の段はそのままで、いつもの配列に近い感覚で使える。',
  },
  {
    id: 'number-row', label: '数字段あり', en: 'Number row', group: 'size',
    detail: 'いちばん上に数字の段があるタイプ。数字をレイヤーに移さなくてよいので、分割キーボードの入門にも向く。',
  },
  {
    id: 'split', label: '分割', en: 'Split', group: 'shape',
    detail: '左右の手ごとに本体が分かれている形。肩幅に開いて置けるので、手首を内側にひねらずに打てる。'
      + '左右はケーブル（TRRS など）か無線でつなぐ。',
  },
  {
    id: 'unibody', label: '一体型', en: 'Unibody', group: 'shape',
    detail: '左右がつながった 1 枚の本体。持ち運びや置き場所で迷わない。',
  },
  {
    id: 'column-stagger', label: 'カラムスタッガード', en: 'Column Staggered', group: 'shape',
    detail: 'キーを縦の列ごとに上下にずらした配列。中指の列を高く、小指の列を低くして、指の長さに合わせてある。'
      + '一般的なキーボードの「段ごとに横にずれた配列（ロースタッガード）」とは逆の考え方で、指を真っすぐ伸ばし縮みさせるだけで打てる。',
  },
  {
    id: 'ortholinear', label: 'オーソリニア（格子配列）', en: 'Ortholinear', group: 'shape',
    detail: 'キーが縦横まっすぐな格子状に並ぶ配列。隣の段へは指を真上・真下に動かすだけで届く。',
  },
  {
    id: 'row-stagger', label: 'ロースタッガード', en: 'Row Staggered', group: 'shape',
    detail: 'ふつうのキーボードの配列。段ごとにキーが横に少しずつずれている（タイプライターの名残り）。',
  },
  {
    id: 'thumb-cluster', label: '親指クラスタ', en: 'Thumb cluster', group: 'shape',
    detail: '親指で押すキーがまとまって並んでいる。Space・Enter・レイヤーキーなどを親指に集めて、小指の負担を減らす。',
  },
  {
    id: 'cherry-mx', label: 'Cherry MX', en: 'Cherry MX compatible', group: 'switch', mount: 'mx',
    detail: 'Cherry MX と同じ足（ピン配置）のスイッチが使える。Gateron・Kailh BOX・Akko など、世の中のスイッチの大半がこの形で、'
      + 'キーキャップも MX 用（十字の軸）が使える。',
  },
  {
    id: 'choc-v1', label: 'Kailh Choc V1', en: 'Kailh Choc V1 (PG1350)', group: 'switch', mount: 'choc-v1',
    detail: 'Kailh のロープロファイル（背の低い）スイッチ Choc の初代が使える。軸は 2 本足の独自の形なので、キーキャップも Choc 用が要る。'
      + 'キーの間隔が 18×17mm の「Choc スペーシング」の基板が多い。',
  },
  {
    id: 'choc-v2', label: 'Kailh Choc V2', en: 'Kailh Choc V2 (PG1353)', group: 'switch', mount: 'choc-v2',
    detail: 'Choc の 2 代目が使える。背の低さはそのままで、軸が MX と同じ十字になったので MX 用のキーキャップが付く。'
      + 'ピンの位置は V1 と同じだが真ん中のポストが太く、V2 に対応した基板でないと挿さらない。',
  },
  {
    id: 'gateron-lp', label: 'Gateron LP', en: 'Gateron Low Profile (KS-33)', group: 'switch', mount: 'gateron-lp',
    detail: 'Gateron のロープロファイルスイッチ（KS-33 など）が使える。ソケットは Choc とも MX とも違う専用のもの。',
  },
  {
    id: 'keychron-lp', label: 'Keychron LP', en: 'Keychron Low Profile', group: 'switch', mount: 'keychron-lp',
    detail: 'Keychron のロープロファイルスイッチ（Orca echo の Ninja / Samurai）が使える。',
  },
  {
    id: 'hotswap', label: 'ホットスワップ', en: 'Hot-swap', group: 'switch',
    detail: 'スイッチをはんだ付けせず、ソケットに挿すだけで付け外しできる。あとから好きなスイッチに入れ替えたり、'
      + 'キーごとに違うスイッチを試したりできる。挿さるのはソケットの形に合うスイッチだけなので、下の対応表で確かめる。',
  },
  {
    id: 'solder', label: 'はんだ付け', en: 'Solder', group: 'switch',
    detail: 'スイッチを基板に直接はんだ付けする。薄く・安く作れるが、スイッチを替えるにははんだを外す作業が要る。',
  },
  {
    id: 'backlight', label: 'バックライト LED', en: 'Backlight LED', group: 'feature',
    detail: 'キーの下にひとつずつ LED があり、キーやその周りを光らせられる。フルカラー（RGB）のものが多く、'
      + 'レイヤーごとに色を変えるといった使い方もできる。',
  },
  {
    id: 'underglow', label: 'アンダーグロー', en: 'Underglow', group: 'feature',
    detail: '本体の裏側に LED があり、机を照らすように光る。',
  },
  {
    id: 'oled', label: 'OLED', en: 'OLED display', group: 'feature',
    detail: '小さな有機 EL の画面を載せられる。いまのレイヤー・入力モード・ロゴやアニメーションなどを表示できる。',
  },
  {
    id: 'encoder', label: 'ロータリーエンコーダー', en: 'Rotary encoder', group: 'feature',
    detail: '回せるつまみ（ホイール）。音量・スクロール・ズームなどを割り当てられ、押し込めるものはキーとしても使える。',
  },
  {
    id: 'trackball', label: 'トラックボール', en: 'Trackball', group: 'feature',
    detail: 'ボールを転がしてマウスカーソルを動かせる。手をキーボードから離さずにポインタを操作できる。',
  },
  {
    id: 'scroll-pad', label: 'スクロールパッド', en: 'Scroll pad', group: 'feature',
    detail: '指でなぞってスクロールできるタッチ式のパッド。',
  },
  {
    id: 'wireless', label: 'ワイヤレス', en: 'Wireless', group: 'feature',
    detail: 'Bluetooth などで無線でつなげる。分割キーボードでは、左右の間も無線のものが多い。',
  },
]

const TAG_BY_ID = new Map(SPEC_TAGS.map((t) => [t.id, t]))

export function getSpecTag(id: SpecTagId): SpecTagDef {
  return TAG_BY_ID.get(id)!
}

export function isSpecTagId(x: unknown): x is SpecTagId {
  return TAG_BY_ID.has(x as SpecTagId)
}

/* ---------------------------------------------------------------- キーボードごとのスペック */

/** キーボードに付いたタグ。note はそのキーボードでの補足（「Glow モデル」など） */
export interface SpecTag {
  id: SpecTagId
  note?: string
}

export interface SocketRef {
  id: SocketId
  /** そのソケットが一部のキーにしか無いときなどの補足 */
  note?: string
}

/** 同じキーボードの版・キット違い。版によって付いているソケット（＝使えるスイッチ）が違う */
export interface KeyboardEdition {
  name: string
  sockets: readonly SocketRef[]
  note?: string
}

export interface KeyboardSpec {
  tags: readonly SpecTag[]
  editions: readonly KeyboardEdition[]
  note?: string
  sources: readonly { label: string; url: string }[]
  /** 調べた情報ではなく、取り込んだ定義から推し量ったもの */
  derived?: boolean
}

const t = (id: SpecTagId, note?: string): SpecTag => (note ? { id, note } : { id })
const s = (id: SocketId, note?: string): SocketRef => (note ? { id, note } : { id })

const SPECS: Record<string, KeyboardSpec> = {
  'keychron-orca-echo': {
    tags: [
      t('size-40'), t('split'), t('column-stagger'), t('keychron-lp', 'Ninja / Samurai'),
      t('cherry-mx', '別売り予定の標準プロファイル用プレートで'), t('hotswap', 'Nova Socket'),
      t('trackball', '19mm'), t('encoder', 'ホイール'), t('scroll-pad', '左右に 1 つずつ'),
      t('wireless', 'Bluetooth・2.4GHz・有線'),
    ],
    editions: [
      {
        name: 'Orca echo',
        sockets: [s('nova-socket')],
        note: '標準は Keychron Apex POM ロープロファイルスイッチ（Ninja: リニア / Samurai: タクタイル から選ぶ）。バックライトは無し',
      },
    ],
    sources: [
      { label: 'GIZMART・メディアジーン（発表）', url: 'https://www.mediagene.co.jp/en/2026/06/19858.html' },
      { label: 'ギズモード・ジャパン（よくある質問）', url: 'https://www.gizmodo.jp/article/orca_echo_faq/' },
    ],
  },
  'olkb-planck': {
    tags: [
      t('size-40'), t('unibody'), t('ortholinear'), t('cherry-mx'), t('hotswap', 'rev6 以降・Planck EZ'),
      t('backlight', 'Planck EZ Glow'),
    ],
    editions: [
      { name: 'Planck rev6 以降（OLKB・Drop）', sockets: [s('mx-hotswap')] },
      { name: 'Planck EZ（ZSA）', sockets: [s('mx-hotswap')], note: 'Glow モデルはキーごとの RGB LED 付き' },
    ],
    sources: [
      { label: 'QMK（keyboards/planck）', url: 'https://github.com/qmk/qmk_firmware/tree/master/keyboards/planck' },
    ],
  },
  'zsa-ergodox-ez': {
    tags: [
      t('split'), t('column-stagger'), t('number-row'), t('thumb-cluster'), t('cherry-mx'), t('hotswap'),
      t('backlight', 'Glow モデル'),
    ],
    editions: [{ name: 'ErgoDox EZ', sockets: [s('mx-hotswap')] }],
    sources: [{ label: 'ErgoDox EZ と Moonlander の比較（ZSA）', url: 'https://ergodox-ez.com/comparison' }],
  },
  'qmk-60-ansi': {
    tags: [t('size-60'), t('unibody'), t('row-stagger'), t('number-row'), t('cherry-mx')],
    editions: [
      {
        name: '一般的な 60% キーボード',
        sockets: [s('mx-hotswap'), s('mx-solder')],
        note: '60% の基板は製品ごとに違う。ホットスワップか・LED があるかは製品の説明で確かめる',
      },
    ],
    note: '特定の製品ではなく、よくある 60%（ANSI）の配列です。',
    sources: [],
  },
  'foostan-corne-6col': {
    tags: [
      t('size-40'), t('split'), t('column-stagger'), t('backlight'),
      t('cherry-mx', 'Corne Cherry'), t('choc-v1', 'Corne Chocolate'), t('choc-v2', 'Corne Chocolate v4'),
      t('hotswap'), t('oled'),
    ],
    editions: [
      { name: 'Corne Cherry（v2〜v4）', sockets: [s('mx-hotswap')] },
      { name: 'Corne Chocolate v4', sockets: [s('choc-v1v2-hotswap')], note: 'Choc V1 と V2 のどちらも挿さる' },
      { name: 'Corne Chocolate v2', sockets: [s('choc-v1-hotswap')], note: '旧版。Choc V1 だけ' },
    ],
    sources: [
      { label: 'foostan/crkbd（GitHub）', url: 'https://github.com/foostan/crkbd' },
      {
        label: 'Corne Chocolate v4 ビルドガイド',
        url: 'https://github.com/foostan/crkbd/blob/main/docs/corne-chocolate/v4/buildguide_jp.md',
      },
    ],
  },
  'keebio-iris': {
    tags: [
      t('split'), t('column-stagger'), t('number-row'), t('thumb-cluster'), t('cherry-mx'),
      t('choc-v1', 'Iris CE'), t('hotswap', 'rev6 以降'), t('backlight'), t('underglow'), t('encoder', 'オプション'),
    ],
    editions: [
      { name: 'Iris rev6〜rev8', sockets: [s('mx-hotswap')] },
      { name: 'Iris CE', sockets: [s('choc-v1-hotswap')], note: 'キーの数が少ないロープロファイルの別モデル' },
    ],
    sources: [
      { label: 'Iris rev8（Keebio）', url: 'https://keeb.io/products/iris-rev-8-keyboard-split-ergonomic-keyboard' },
      { label: 'Iris rev6〜8 ビルドガイド', url: 'https://docs.keeb.io/iris-rev6-build-guide' },
    ],
  },
  'olkb-preonic': {
    tags: [
      t('size-50'), t('unibody'), t('ortholinear'), t('number-row'), t('cherry-mx'), t('hotswap', 'rev3'),
      t('underglow', 'rev3: 裏に RGB LED 9 個'),
    ],
    editions: [{ name: 'Preonic rev3（OLKB・Drop）', sockets: [s('mx-hotswap')] }],
    sources: [{ label: 'Drop + OLKB Preonic', url: 'https://drop.com/buy/preonic-mechanical-keyboard' }],
  },
  'splitkb-kyria': {
    tags: [
      t('size-40'), t('split'), t('column-stagger'), t('thumb-cluster'), t('cherry-mx'), t('choc-v1'), t('hotswap'),
      t('oled', '128×64'), t('encoder', 'MX 版のみ'), t('backlight', 'オプション'), t('underglow'),
    ],
    editions: [
      { name: 'Kyria rev3（MX キット）', sockets: [s('mx-hotswap')] },
      { name: 'Kyria rev3（Choc キット）', sockets: [s('choc-v1-hotswap')], note: 'Choc 版ではロータリーエンコーダーを付けられない' },
    ],
    sources: [
      { label: 'Kyria rev3（splitkb.com）', url: 'https://splitkb.com/products/kyria-rev3' },
      {
        label: 'Kyria のホットスワップ（splitkb.com）',
        url: 'https://docs.splitkb.com/product-guides/kyria/frequently-asked-questions/hot-swap',
      },
    ],
  },
  'kata0510-lily58': {
    tags: [
      t('split'), t('column-stagger'), t('number-row'), t('thumb-cluster'), t('cherry-mx'), t('choc-v1'),
      t('hotswap', 'Lily58 Pro'), t('oled'), t('underglow'),
    ],
    editions: [
      { name: 'Lily58 Pro（MX 用ソケット）', sockets: [s('mx-hotswap')] },
      {
        name: 'Lily58 Pro（Choc 用ソケット）',
        sockets: [s('choc-v1-hotswap')],
        note: 'MX 用と Choc 用のソケットはどちらかを選んで付ける（同時には使えない）',
      },
    ],
    sources: [{ label: 'kata0510/Lily58（GitHub）', url: 'https://github.com/kata0510/Lily58' }],
  },
  'josefadamcik-sofle': {
    tags: [
      t('split'), t('column-stagger'), t('number-row'), t('thumb-cluster'), t('cherry-mx'), t('choc-v1', 'Sofle Choc'),
      t('hotswap'), t('oled'), t('encoder'), t('backlight', 'Sofle RGB'), t('underglow', 'Sofle RGB'),
    ],
    editions: [
      { name: 'Sofle v2 / Sofle RGB', sockets: [s('mx-hotswap')] },
      { name: 'Sofle Choc', sockets: [s('choc-v1-hotswap')] },
    ],
    sources: [
      { label: 'SofleKeyboard', url: 'https://josefadamcik.github.io/SofleKeyboard/' },
      { label: 'Sofle Choc ビルドガイド', url: 'https://josefadamcik.github.io/SofleKeyboard/build_guide_choc.html' },
    ],
  },
  'zsa-moonlander': {
    tags: [
      t('split'), t('column-stagger'), t('number-row'), t('thumb-cluster'), t('cherry-mx'), t('hotswap'), t('backlight'),
    ],
    editions: [{ name: 'Moonlander Mark I', sockets: [s('mx-hotswap', '3 ピン・5 ピンのどちらも挿せる')] }],
    sources: [{ label: 'Moonlander（ZSA）', url: 'https://www.zsa.io/moonlander' }],
  },
  'yowkees-keyball44': {
    tags: [
      t('size-40'), t('split'), t('column-stagger'), t('trackball', '34mm'), t('cherry-mx'),
      t('choc-v1', '親指キーのみ（オプション）'), t('hotswap'), t('oled'), t('backlight', 'オプション'),
    ],
    editions: [
      {
        name: 'Keyball44',
        sockets: [s('mx-hotswap'), s('choc-v1-hotswap', '親指の 5 キーだけ（ロープロファイル仕様）')],
      },
    ],
    sources: [
      { label: 'Keyball44 ビルドガイド（Yowkees）', url: 'https://github.com/Yowkees/keyball/blob/main/keyball44/doc/rev1/buildguide_en.md' },
    ],
  },
  'ferris-sweep': {
    tags: [t('size-30'), t('split'), t('column-stagger'), t('choc-v1'), t('hotswap', 'Sweep Bling LP など')],
    editions: [
      { name: 'Ferris Sweep（Sweep Bling LP）', sockets: [s('choc-v1-hotswap')], note: 'はんだ付けで組む版もある' },
    ],
    sources: [{ label: 'davidphilipbarr/Sweep（GitHub）', url: 'https://github.com/davidphilipbarr/Sweep' }],
  },
}

/**
 * 取り込んだキーボードのスペック。定義から分かること（分割か・キーの数・センサー）だけをタグにする。
 * ソケットは分からないので、エディションは持たない
 */
function derivedSpec(def: KeyboardDefinition): KeyboardSpec {
  const tags: SpecTag[] = [t(def.keys.some((k) => k.half === 'R') ? 'split' : 'unibody')]
  const kinds = new Set((def.sensors ?? []).map((sensor) => sensor.kind))
  if (kinds.has('ball')) tags.push(t('trackball'))
  if (kinds.has('encoder')) tags.push(t('encoder'))
  if (kinds.has('pad')) tags.push(t('scroll-pad'))
  return {
    tags,
    editions: [],
    note: `取り込んだキーボード（${def.keys.length} キー）です。スイッチの種類やソケットは定義に入っていないので、`
      + '下のソケットから選んで探してください。',
    sources: [],
    derived: true,
  }
}

/** キーボードのスペック。組み込みは調べた情報、それ以外は定義から推し量ったもの */
export function keyboardSpecOf(def: KeyboardDefinition): KeyboardSpec {
  return SPECS[def.id] ?? derivedSpec(def)
}

/** そのエディションのソケット（ID だけ） */
export function editionSockets(edition: KeyboardEdition): SocketId[] {
  return edition.sockets.map((ref) => ref.id)
}

/** そのキーボードのどれかのエディションに付いているソケット */
export function keyboardSockets(spec: KeyboardSpec): SocketId[] {
  return [...new Set(spec.editions.flatMap(editionSockets))]
}
