import type { Keymap, SwitchPick } from './types.js'

/* ================================================================
   キースイッチのカタログ

   「どのキーボードに、どのスイッチがハマるか」は、スイッチの足の形（マウント）と
   キーボード側の受け口（ソケット）の組み合わせで決まる。同じ足の形なら、メーカーが違っても同じソケットに挿さる。

   数値はメーカー公称の代表値（押下圧は動作点での荷重）。版やロットで多少ちがう。
   公表されていない値は持たない（画面では「—」になる）。
   ================================================================ */

export type SwitchType = 'linear' | 'tactile' | 'clicky'

export const SWITCH_TYPES: readonly SwitchType[] = ['linear', 'tactile', 'clicky']

export const SWITCH_TYPE_LABEL: Record<SwitchType, string> = {
  linear: 'リニア',
  tactile: 'タクタイル',
  clicky: 'クリッキー',
}

export const SWITCH_TYPE_HELP: Record<SwitchType, string> = {
  linear: '押し始めから底まで、引っかかりなくまっすぐ沈む。いわゆる赤軸・黄軸',
  tactile: '途中に「コクッ」とした山があり、押せたことが指でわかる。いわゆる茶軸',
  clicky: '山を越えるときに「カチッ」と音が鳴る。いわゆる青軸。音が出るので使う場所を選ぶ',
}

/** 種類ごとの軸の色（一覧の色見本）。個別の色が分からないスイッチに使う */
export const SWITCH_TYPE_STEM: Record<SwitchType, string> = {
  linear: '#d7372b',
  tactile: '#8a5a2e',
  clicky: '#2f73d6',
}

/* ---------------------------------------------------------------- 足の形（マウント） */

export type SwitchMount = 'mx' | 'choc-v1' | 'choc-v2' | 'gateron-lp' | 'keychron-lp' | 'lofree-lp' | 'unconfirmed-lp'

/** キーキャップを付ける軸の形 */
export type StemShape = 'mx' | 'choc'

export const STEM_LABEL: Record<StemShape, string> = {
  mx: 'MX 用（十字の軸）',
  choc: 'Choc V1 用（2 本足の軸）',
}

export interface MountDef {
  id: SwitchMount
  label: string
  /** 表の見出しなどに使う短い名前 */
  short: string
  /** 背の高さ。standard は一般的な高さ、low はロープロファイル（薄型） */
  profile: 'standard' | 'low'
  /** キーキャップの軸。null は分からない（そのときは keycap の説明を出す） */
  stem: StemShape | null
  /** 軸の形が分からないときの、キーキャップの説明。省略すると「まだ公表されていません」 */
  keycap?: string
  /** カタログのソケットの一覧に無い挿さり先や、挿さるソケットが分からないことの説明 */
  socketNote?: string
  /** 足の形を確かめられていない。どのソケットにも挿さる扱いにせず、対応表にも出さない（「挿さらない」とも言わない） */
  unconfirmed?: boolean
  desc: string
}

export const MOUNTS: readonly MountDef[] = [
  {
    id: 'mx',
    label: 'Cherry MX 互換',
    short: 'MX 互換',
    profile: 'standard',
    stem: 'mx',
    desc: 'Cherry MX と同じ足（2 本の金属ピンと真ん中の軸）を持つスイッチ。Gateron・Kailh BOX・Akko など、'
      + '世の中のスイッチの大半がこの形。3 ピン（プレート固定）と、樹脂の足が 2 本多い 5 ピン（基板固定）がある。',
  },
  {
    id: 'choc-v1',
    label: 'Kailh Choc V1',
    short: 'Choc V1',
    profile: 'low',
    stem: 'choc',
    desc: 'Kailh のロープロファイル（背の低い）スイッチ Choc の初代（PG1350）。押し切るまで 3.0mm と浅い。'
      + '軸は 2 本足の独自の形なので、キーキャップも Choc 用が必要。',
  },
  {
    id: 'choc-v2',
    label: 'Kailh Choc V2',
    short: 'Choc V2',
    profile: 'low',
    stem: 'mx',
    desc: 'Choc の 2 代目（PG1353）。背の低さはそのままで、軸が MX と同じ十字になり MX 用のキーキャップが付く。'
      + 'ピンの位置は V1 と同じだが、真ん中のポストが太い（V1 は約 3.4mm、V2 は約 5mm）。',
  },
  {
    id: 'gateron-lp',
    label: 'Gateron KS-33（ロープロファイル 2.0）',
    short: 'Gateron KS-33',
    profile: 'low',
    stem: 'mx',
    desc: 'Gateron のロープロファイルスイッチ。軸は十字で MX 用のキーキャップが付くが、'
      + '足の形は Choc とも MX とも違い、専用のソケット（KS-27 と共通）に挿す。',
  },
  {
    id: 'keychron-lp',
    label: 'Keychron ロープロファイル（Apex POM）',
    short: 'Keychron LP',
    profile: 'low',
    stem: null,
    desc: 'Keychron が Orca echo 向けに作ったロープロファイルスイッチ。Keychron の Nova Socket に挿す。',
  },
  {
    id: 'lofree-lp',
    label: 'Lofree 専用の形',
    short: 'Lofree 専用',
    profile: 'low',
    stem: null,
    keycap: 'Lofree のキーボードに付いているキーキャップをそのまま使う',
    socketNote: 'Lofree の Flow84・Flow100・Flow Lite84・Flow Lite100 だけに挿さる（ほかのキーボードの Choc V2 用ソケットには挿さらない）',
    desc: 'Lofree が自社のキーボード向けに作ったロープロファイルスイッチ（Specter・Hades）。ピンの位置は Choc V2 と同じだが、'
      + '真ん中の軸が太く、位置を決める足も無いので、ほかのキーボードの Choc V2 用ソケットには挿さらない。',
  },
  {
    id: 'unconfirmed-lp',
    label: '足の形は確認中',
    short: '足の形 確認中',
    profile: 'low',
    stem: null,
    keycap: '確かめられていません',
    socketNote: 'どのソケットに挿さるかは確かめられていません。買う前に販売ページで、対応するソケット（Choc V1 / V2 など）を確かめてください',
    unconfirmed: true,
    desc: '背の低いロープロファイルのスイッチのうち、調べた資料では足の形（どのソケットに挿さるか）を確かめられなかったもの。'
      + '確かめられるまでは、どのキーボードの「ハマるスイッチ」にも出さない。',
  },
]

const MOUNT_BY_ID = new Map(MOUNTS.map((m) => [m.id, m]))

export function getMount(id: SwitchMount): MountDef {
  return MOUNT_BY_ID.get(id)!
}

/** キーキャップの説明（「MX 用（十字の軸）」など） */
export function keycapLabel(mount: MountDef): string {
  return mount.stem ? STEM_LABEL[mount.stem] : mount.keycap ?? 'まだ公表されていません'
}

/* ---------------------------------------------------------------- 受け口（ソケット） */

export type SocketId =
  | 'mx-hotswap'
  | 'mx-solder'
  | 'choc-v1-hotswap'
  | 'choc-v1v2-hotswap'
  | 'choc-v1-solder'
  | 'gateron-lp-hotswap'
  | 'nova-socket'

export interface SocketFit {
  mount: SwitchMount
  /** 条件つきで挿さるときの、その条件 */
  note?: string
}

export interface SocketDef {
  id: SocketId
  label: string
  /** チップや表の見出しに使う短い名前 */
  short: string
  /** はんだ付けせずに差し替えられるか */
  hotswap: boolean
  fits: readonly SocketFit[]
  desc: string
  cautions: readonly string[]
}

export const SOCKETS: readonly SocketDef[] = [
  {
    id: 'mx-hotswap',
    label: 'MX 用ホットスワップソケット',
    short: 'MX ソケット',
    hotswap: true,
    fits: [{ mount: 'mx' }],
    desc: 'Kailh や Gateron が作っている、Cherry MX 互換スイッチ用のソケット。基板の裏に付いていて、'
      + 'スイッチの 2 本の金属ピンをはさんで電気をつなぐ。MX 互換の足なら、メーカーを問わず挿さる。',
    cautions: [
      '5 ピン（樹脂の足が 2 本多い）のスイッチは、基板に足の穴があるときだけ挿さる。無ければ樹脂の足を切れば挿せる',
      'ピンが曲がっていると挿さらず、無理に押すとピンもソケットも傷める。まっすぐ当てて押し込む',
      'ロープロファイルの Choc（V1 / V2）や Gateron KS-33 は、ピンの位置が違うので挿さらない',
      '安いキーボードには Outemu の専用ソケットを使ったものがあり、これはピンの細いスイッチ向けの別物。製品の説明で確かめる',
    ],
  },
  {
    id: 'mx-solder',
    label: 'MX（はんだ付け）',
    short: 'MX はんだ付け',
    hotswap: false,
    fits: [{ mount: 'mx' }],
    desc: 'ソケットを使わず、スイッチのピンを基板に直接はんだ付けする。MX 互換ならどれでも付くが、'
      + '取り替えるにははんだを外す作業が要る。',
    cautions: [
      '5 ピンのスイッチは、基板に樹脂の足の穴が無ければ足を切って付ける',
      'あとでスイッチを変えたくなりそうなら、ホットスワップの基板を選ぶほうが気軽',
    ],
  },
  {
    id: 'choc-v1-hotswap',
    label: 'Choc V1 用ホットスワップソケット',
    short: 'Choc V1 ソケット',
    hotswap: true,
    fits: [{ mount: 'choc-v1' }],
    desc: 'Kailh のロープロファイルスイッチ Choc（PG1350）用のソケット。V1 だけを想定した基板は、'
      + '真ん中のポストの穴が V1 に合わせて小さい。',
    cautions: [
      'Choc V2 は真ん中のポストが太いので、V1 専用の基板には入らない',
      'キーキャップは Choc V1 用が必要（MX 用のキーキャップは付かない）',
      'キーの間隔が 18×17mm（Choc スペーシング）の基板が多い。キーキャップの大きさが合うか確かめる',
    ],
  },
  {
    id: 'choc-v1v2-hotswap',
    label: 'Choc V1 / V2 両対応ホットスワップソケット',
    short: 'Choc V1/V2 ソケット',
    hotswap: true,
    fits: [{ mount: 'choc-v1' }, { mount: 'choc-v2' }],
    desc: 'ソケットは V1 と同じ Kailh の Choc 用で、真ん中の穴を V2 の太いポストに合わせて広げた基板。'
      + 'V1 と V2 のどちらも挿さる。',
    cautions: [
      'V2 のクリッキーは、クリックバーの逃げ穴が無い基板だと付かないことがある',
      'V1 と V2 でキーキャップが違う。V1 は Choc 用、V2 は MX 用（背の低いロープロファイル用がおすすめ）',
      '同じ基板に V1 と V2 を混ぜて挿すこともできる（キーキャップはそれぞれに合わせる）',
    ],
  },
  {
    id: 'choc-v1-solder',
    label: 'Choc V1（はんだ付け）',
    short: 'Choc V1 はんだ付け',
    hotswap: false,
    fits: [{ mount: 'choc-v1' }],
    desc: 'Choc V1 を基板に直接はんだ付けする。薄く作れるが、取り替えるにははんだを外す作業が要る。',
    cautions: ['キーキャップは Choc V1 用が必要'],
  },
  {
    id: 'gateron-lp-hotswap',
    label: 'Gateron ロープロファイル用ソケット',
    short: 'Gateron LP ソケット',
    hotswap: true,
    fits: [{ mount: 'gateron-lp' }],
    desc: 'Gateron のロープロファイルスイッチ（KS-33 / KS-27）用のソケット。足の形が Choc とも MX とも違う専用品。',
    cautions: [
      'Choc V1 / V2 や MX 互換のスイッチは挿さらない（KS-33 も Choc や MX の基板には付かない）',
      'KS-33 は十字の軸なので MX 用のキーキャップが付く（背の低いロープロファイル用がおすすめ）',
    ],
  },
  {
    id: 'nova-socket',
    label: 'Keychron Nova Socket',
    short: 'Nova Socket',
    hotswap: true,
    fits: [
      { mount: 'keychron-lp' },
      { mount: 'mx', note: '別売り予定の標準プロファイル用プレートに替えて使う' },
    ],
    desc: 'Keychron が Orca echo で使っている新しいソケット。ロープロファイルの薄さのまま、'
      + '背の高い一般的な MX 互換スイッチにも対応する。ピンの曲がりや変形も起きにくい作りという。',
    cautions: [
      '標準で付いてくるのは Keychron のロープロファイルスイッチ（Ninja / Samurai）',
      'MX 互換のスイッチは背が高いので、標準プロファイル用のプレート（別売り予定）に替える必要がある',
    ],
  },
]

const SOCKET_BY_ID = new Map(SOCKETS.map((s) => [s.id, s]))

export function getSocket(id: SocketId): SocketDef {
  return SOCKET_BY_ID.get(id)!
}

export function isSocketId(x: unknown): x is SocketId {
  return SOCKET_BY_ID.has(x as SocketId)
}

/** そのソケットにその足の形が挿さるか。挿さるなら条件（無ければ note なし）を返す */
export function socketFit(socket: SocketId, mount: SwitchMount): SocketFit | undefined {
  return getSocket(socket).fits.find((f) => f.mount === mount)
}

/** その足の形が挿さるソケット */
export function socketsForMount(mount: SwitchMount): SocketDef[] {
  return SOCKETS.filter((s) => s.fits.some((f) => f.mount === mount))
}

/* ---------------------------------------------------------------- スイッチ */

export interface KeySwitch {
  /** 保存データ・共有フィードから参照する ID。変えないこと */
  id: string
  name: string
  maker: string
  mount: SwitchMount
  type: SwitchType
  /** 音を抑える仕組み（ダンパー）入り */
  silent?: boolean
  /** 押下圧（動作点での荷重, gf） */
  forceGf?: number
  /** 動作点までの距離（プリトラベル, mm） */
  preTravel?: number
  /** 押し切るまでの距離（トータルトラベル, mm） */
  totalTravel?: number
  /** 軸の色（一覧の色見本・イラスト）。省略すると種類ごとの色（colorUnknown のものは灰色） */
  stemColor?: string
  /** ハウジング（外側のケース）の色。上下で違うものは上の色。イラストに使う。省略すると明るい色で描く */
  housingColor?: string
  /** 下のハウジングの色。上と違うときだけ書く（省略すると housingColor と同じ） */
  bottomHousingColor?: string
  /** 軸・ハウジングの色を資料で確かめられていない。イラストは灰色で描き、詳細でそう断る */
  colorUnknown?: boolean
  /** 打鍵音を聞けるページ（動画など）。省略すると YouTube で「名前 sound test」を検索する */
  soundUrl?: string
  /** soundUrl のページの題名（何種類かを聞き比べた動画なら、その動画の題名） */
  soundTitle?: string
  /** 打鍵音を YouTube で探すときの言葉。名前だけでは見つかりにくいものに使う */
  soundQuery?: string
  note?: string
}

/**
 * ロープロファイルスイッチ 27 種類のスペックと打鍵音を聞き比べた動画（YouTube）。
 * この動画で紹介されたスイッチは、打鍵音のリンクをこの動画にしている（どの場面かの指定はなし）
 */
const LOW_PROFILE_REVIEW = {
  soundUrl: 'https://www.youtube.com/watch?v=ShSSULVh0x0',
  soundTitle: '【ロープロファイルスイッチ徹底解説】27種類のスペック・打鍵音を紹介',
} as const

/*
 * 軸・ハウジングの色は、メーカー・販売店の説明と switches.mx のデータ（github.com/BWLR/switches.mx）で調べたもの。
 * 同じ名前でも版で色が違うスイッチは、いちばん基本の版の色にしている（コメントに書く）。
 * 透明・乳白色・スモークのハウジングは、後ろが透けて見えるよう半透明で描く
 */
/** 黒いナイロン（Cherry・Gateron・Kailh などの黒いハウジング。switches.mx の色） */
const BLACK = '#3a4045'
/** 白いナイロン */
const WHITE = '#f8f8f4'
/** 透明（クリア）の PC */
const CLEAR = 'rgba(214, 230, 238, 0.55)'
/** 乳白色（ミルキー） */
const MILKY = 'rgba(246, 244, 237, 0.92)'
/** スモーク（透けて見える黒） */
const SMOKY = 'rgba(58, 64, 69, 0.72)'
/** Kailh の Choc Pro シリーズの下のハウジング（灰色のナイロン） */
const PRO_GRAY = '#a9adb3'
/** Kailh の Deep Sea Silent Mini の下のハウジング（濃い青） */
const DEEP_SEA_BLUE = '#1d3b73'

export const KEYSWITCHES: readonly KeySwitch[] = [
  /* ---- Cherry MX 互換（一般的な高さ） ---- */
  // Cherry の標準の版は、上下とも黒いハウジング（RGB 版は透明）
  {
    id: 'cherry-mx-red', name: 'Cherry MX Red', maker: 'Cherry', mount: 'mx', type: 'linear',
    forceGf: 45, preTravel: 2.0, totalTravel: 4.0, stemColor: '#dc413a', housingColor: BLACK,
    note: '「赤軸」の元祖。軽めのリニアの基準になるスイッチ',
  },
  {
    id: 'cherry-mx-brown', name: 'Cherry MX Brown', maker: 'Cherry', mount: 'mx', type: 'tactile',
    forceGf: 55, preTravel: 2.0, totalTravel: 4.0, stemColor: '#674842', housingColor: BLACK,
    note: '「茶軸」の元祖。山は控えめで、リニアに近い軽さ',
  },
  {
    id: 'cherry-mx-blue', name: 'Cherry MX Blue', maker: 'Cherry', mount: 'mx', type: 'clicky',
    forceGf: 60, preTravel: 2.2, totalTravel: 4.0, stemColor: '#44a9ff', housingColor: BLACK,
    note: '「青軸」の元祖。はっきりしたクリック音',
  },
  {
    id: 'cherry-mx-black', name: 'Cherry MX Black', maker: 'Cherry', mount: 'mx', type: 'linear',
    forceGf: 60, preTravel: 2.0, totalTravel: 4.0, stemColor: BLACK, housingColor: BLACK,
    note: '重めのリニア。誤って押しにくい',
  },
  {
    // Cherry の表記では軸はピンク
    id: 'cherry-mx-silent-red', name: 'Cherry MX Silent Red', maker: 'Cherry', mount: 'mx', type: 'linear',
    silent: true, forceGf: 45, preTravel: 1.9, totalTravel: 3.7, stemColor: '#ec7575', housingColor: BLACK,
    note: '赤軸にダンパーを入れて、底打ちと戻りの音を抑えたもの',
  },
  {
    // 長く RGB 版（透明のハウジング）だけで売られていたので、その色。黒いハウジングの版もある
    id: 'cherry-mx-speed-silver', name: 'Cherry MX Speed Silver', maker: 'Cherry', mount: 'mx', type: 'linear',
    forceGf: 45, preTravel: 1.2, totalTravel: 3.4, stemColor: '#bcbcbc', housingColor: CLEAR,
    note: '動作点が浅く、少し押しただけで反応する',
  },
  {
    // 今の G Pro（3.0）の色。上が透明、下が白
    id: 'gateron-yellow', name: 'Gateron Yellow', maker: 'Gateron', mount: 'mx', type: 'linear',
    forceGf: 50, preTravel: 2.0, totalTravel: 4.0, stemColor: '#ffe07b', housingColor: CLEAR, bottomHousingColor: WHITE,
    note: '手ごろでなめらかな定番のリニア',
  },
  {
    id: 'gateron-milky-yellow-pro', name: 'Gateron Milky Yellow Pro', maker: 'Gateron', mount: 'mx', type: 'linear',
    forceGf: 50, preTravel: 2.0, totalTravel: 4.0, stemColor: '#ffe07b', housingColor: MILKY,
    note: '乳白色のハウジングの黄軸。工場で潤滑済み',
  },
  {
    id: 'gateron-oil-king', name: 'Gateron Oil King', maker: 'Gateron', mount: 'mx', type: 'linear',
    forceGf: 55, preTravel: 2.0, totalTravel: 4.0, stemColor: BLACK, housingColor: BLACK,
    note: '低めの落ち着いた打鍵音が人気のリニア',
  },
  {
    // G Pro（3.0）の色。軸の色は switches.mx の Gateron の茶軸
    id: 'gateron-brown', name: 'Gateron Brown', maker: 'Gateron', mount: 'mx', type: 'tactile',
    forceGf: 55, preTravel: 2.0, totalTravel: 4.0, stemColor: '#694824', housingColor: CLEAR, bottomHousingColor: WHITE,
  },
  {
    id: 'gateron-blue', name: 'Gateron Blue', maker: 'Gateron', mount: 'mx', type: 'clicky',
    forceGf: 60, preTravel: 2.3, totalTravel: 4.0, stemColor: '#2f6fd6', housingColor: CLEAR, bottomHousingColor: WHITE,
  },
  {
    // 最初の版（V1）の色。V2 は下が黒
    id: 'kailh-box-white', name: 'Kailh BOX White', maker: 'Kailh', mount: 'mx', type: 'clicky',
    forceGf: 50, preTravel: 1.8, totalTravel: 3.6, stemColor: '#ffffff', housingColor: CLEAR, bottomHousingColor: '#fffff2',
    note: 'クリックバー式の軽いクリッキー。軸のまわりが箱（BOX）で、ほこりや水に強い',
  },
  {
    id: 'kailh-box-red', name: 'Kailh BOX Red', maker: 'Kailh', mount: 'mx', type: 'linear',
    forceGf: 45, preTravel: 1.8, totalTravel: 3.6, stemColor: '#fa3000', housingColor: CLEAR, bottomHousingColor: '#fffff2',
  },
  {
    id: 'novelkeys-cream', name: 'NovelKeys Cream', maker: 'NovelKeys', mount: 'mx', type: 'linear',
    forceGf: 55, stemColor: '#faf1e1', housingColor: '#faf1e1',
    note: 'ハウジングも軸も POM。使い込むほどなめらかになると言われる',
  },
  {
    id: 'holy-panda', name: 'Holy Panda', maker: 'Drop', mount: 'mx', type: 'tactile',
    forceGf: 67, stemColor: '#efbd9c', housingColor: '#e8e8e4',
    note: '大きくはっきりした山が人気のタクタイル',
  },
  {
    // スモーク（透けた黒）のハウジングの版。透明のハウジングの版もあり、軸はどちらもティール
    id: 'durock-t1', name: 'Durock T1', maker: 'Durock', mount: 'mx', type: 'tactile',
    forceGf: 67, stemColor: '#298296', housingColor: SMOKY,
  },
  {
    // 最初の白いハウジングの版。黒いハウジングの版は Boba Black U4T という別の名前
    id: 'boba-u4t', name: 'Gazzew Boba U4T', maker: 'Gazzew', mount: 'mx', type: 'tactile',
    forceGf: 62, stemColor: '#e9aa00', housingColor: '#f4f2ee',
    note: '強い山と「トコッ」とした低い音で知られるタクタイル（68gf 版もある）',
  },

  /* ---- Kailh Choc V1（ロープロファイル） ---- */
  // 軸の色は Kailh の各色（switches.mx の Kailh の赤・茶・ピンク・白・ジェード）。
  // 標準の Choc は上が透明・下が黒、Pro シリーズ（Red Pro・Pink）は下が灰色
  {
    id: 'choc-v1-red', name: 'Kailh Choc V1 Red', maker: 'Kailh', mount: 'choc-v1', type: 'linear',
    forceGf: 50, preTravel: 1.5, totalTravel: 3.0, stemColor: '#fa3000', housingColor: CLEAR, bottomHousingColor: BLACK,
  },
  {
    // 下の灰色は、同じ Pro シリーズの Pink から（Red Pro 自体の資料では色まで確かめられていない）
    id: 'choc-v1-red-pro', name: 'Kailh Choc V1 Red Pro', maker: 'Kailh', mount: 'choc-v1', type: 'linear',
    forceGf: 35, preTravel: 1.5, totalTravel: 3.0, stemColor: '#fa3000', housingColor: CLEAR, bottomHousingColor: PRO_GRAY,
    note: 'Choc の定番を軽く・なめらかにしたもの。分割キーボードでよく選ばれる',
  },
  {
    // Kailh の呼び名は Pro Pink
    id: 'choc-v1-pink', name: 'Kailh Choc V1 Pink', maker: 'Kailh', mount: 'choc-v1', type: 'linear',
    forceGf: 20, preTravel: 1.5, totalTravel: 3.0, stemColor: '#ff6699', housingColor: CLEAR, bottomHousingColor: PRO_GRAY,
    note: 'とても軽い。触れただけで入力されることもある',
  },
  {
    id: 'choc-v1-brown', name: 'Kailh Choc V1 Brown', maker: 'Kailh', mount: 'choc-v1', type: 'tactile',
    forceGf: 50, preTravel: 1.5, totalTravel: 3.0, stemColor: '#7c3000', housingColor: CLEAR, bottomHousingColor: BLACK,
  },
  {
    // 上はアンバー（透ける琥珀色）
    id: 'choc-v1-sunset', name: 'Kailh Choc V1 Sunset', maker: 'Kailh', mount: 'choc-v1', type: 'tactile',
    forceGf: 40, preTravel: 1.5, totalTravel: 3.0, stemColor: '#f08a24',
    housingColor: 'rgba(222, 142, 40, 0.62)', bottomHousingColor: BLACK,
  },
  {
    id: 'choc-v1-white', name: 'Kailh Choc V1 White', maker: 'Kailh', mount: 'choc-v1', type: 'clicky',
    forceGf: 50, preTravel: 1.5, totalTravel: 3.0, stemColor: '#ffffff', housingColor: CLEAR, bottomHousingColor: BLACK,
  },
  {
    // ハウジングは標準の Choc と同じ作り（Jade 自体の資料では色まで確かめられていない）
    id: 'choc-v1-jade', name: 'Kailh Choc V1 Jade', maker: 'Kailh', mount: 'choc-v1', type: 'clicky',
    forceGf: 60, preTravel: 1.5, totalTravel: 3.0, stemColor: '#bbe0aa', housingColor: CLEAR, bottomHousingColor: BLACK,
    note: '太いクリックバーで、重く大きなクリック音',
  },

  /* ---- Kailh Choc V2（ロープロファイル・MX の十字軸） ---- */
  // 上が透明・下が黒
  {
    id: 'choc-v2-red', name: 'Kailh Choc V2 Red', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 50, preTravel: 1.3, totalTravel: 3.2, stemColor: '#fa3000', housingColor: CLEAR, bottomHousingColor: BLACK,
  },
  {
    id: 'choc-v2-brown', name: 'Kailh Choc V2 Brown', maker: 'Kailh', mount: 'choc-v2', type: 'tactile',
    forceGf: 55, totalTravel: 3.2, stemColor: '#7c3000', housingColor: CLEAR, bottomHousingColor: BLACK,
  },
  {
    // Choc V2 のクリッキーは Blue（White という Choc V2 は無い）。ID は投稿の JSON から参照されるので、前の名前のまま
    id: 'choc-v2-white', name: 'Kailh Choc V2 Blue', maker: 'Kailh', mount: 'choc-v2', type: 'clicky',
    forceGf: 50, totalTravel: 3.2, stemColor: '#2f73d6', housingColor: CLEAR, bottomHousingColor: BLACK,
  },

  /* ---- Choc V2 の形のロープロファイル（ここからは LOW_PROFILE_REVIEW の動画で紹介されたもの） ---- */
  // Lofree × Kailh の Shadow シリーズ（ハウジングも軸も POM）。暗い色の単色で、Ghost は深緑・Phantom は深紫・Wizard は濃紺
  {
    id: 'lofree-ghost', name: 'Lofree Ghost', maker: 'Lofree × Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 50, preTravel: 1.2, totalTravel: 2.8, stemColor: '#2f5d50', housingColor: '#2f5d50', ...LOW_PROFILE_REVIEW,
    note: 'Lofree と Kailh が作った、ハウジングも軸も POM のリニア（Shadow シリーズ）。Lofree Flow84 にも使われている',
  },
  {
    id: 'lofree-phantom', name: 'Lofree Phantom', maker: 'Lofree × Kailh', mount: 'choc-v2', type: 'tactile',
    forceGf: 45, preTravel: 1.6, totalTravel: 2.8, stemColor: '#46325e', housingColor: '#46325e', ...LOW_PROFILE_REVIEW,
    note: 'Ghost と同じ POM の Shadow シリーズのタクタイル',
  },
  {
    id: 'lofree-wizard', name: 'Lofree Wizard', maker: 'Lofree × Kailh', mount: 'choc-v2', type: 'clicky',
    forceGf: 50, preTravel: 1.2, totalTravel: 2.8, stemColor: '#26365e', housingColor: '#26365e', ...LOW_PROFILE_REVIEW,
    note: 'Ghost と同じ POM の Shadow シリーズのクリッキー',
  },
  // Lofree の Cloud シリーズ（Flow 2 のスイッチ。Choc V2 の標準の形なので、ほかの Choc V2 対応のキーボードにも挿さる）。
  // スイッチそのものの色は資料で確かめられていない（「本体の色に合わせてある」というレビューがあるだけ）
  {
    id: 'lofree-surfer', name: 'Lofree Surfer', maker: 'Lofree', mount: 'choc-v2', type: 'linear',
    forceGf: 40, totalTravel: 2.8, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: 'Lofree Flow 2 のスイッチ（Cloud シリーズ）のリニア。Choc V2 の標準の形で、ほかの Choc V2 対応のキーボードにも挿さる',
  },
  {
    id: 'lofree-void', name: 'Lofree Void', maker: 'Lofree', mount: 'choc-v2', type: 'linear', silent: true,
    forceGf: 40, totalTravel: 2.8, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: 'Lofree Flow 2 のスイッチ（Cloud シリーズ）の静音リニア',
  },
  {
    id: 'lofree-pulse', name: 'Lofree Pulse', maker: 'Lofree', mount: 'choc-v2', type: 'tactile',
    forceGf: 40, totalTravel: 2.8, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: 'Lofree Flow 2 のスイッチ（Cloud シリーズ）のタクタイル',
  },
  // Kailh の Elements シリーズ（ハウジングも軸も POM）。ハウジングは White Rain が白・Black Cloud が黒・Hide Mountain が灰色で、
  // 軸も同じ色の単色
  {
    id: 'kailh-white-rain', name: 'Kailh White Rain', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 50, stemColor: '#f4f4f0', housingColor: '#f4f4f0', ...LOW_PROFILE_REVIEW,
    note: 'ハウジングも軸も POM の Elements シリーズのリニア',
  },
  {
    id: 'kailh-black-cloud', name: 'Kailh Black Cloud', maker: 'Kailh', mount: 'choc-v2', type: 'tactile',
    forceGf: 45, stemColor: BLACK, housingColor: BLACK, ...LOW_PROFILE_REVIEW,
    note: 'ハウジングも軸も POM の Elements シリーズのタクタイル',
  },
  {
    id: 'kailh-hide-mountain', name: 'Kailh Hide Mountain', maker: 'Kailh', mount: 'choc-v2', type: 'clicky',
    forceGf: 50, stemColor: '#8e9196', housingColor: '#8e9196', ...LOW_PROFILE_REVIEW,
    note: 'ハウジングも軸も POM の Elements シリーズのクリッキー',
  },
  // Kailh の四季（Season）シリーズ Mini。上は透ける PC、下は POM（Spring・Winter）か PC（Summer・Autumn）。
  // Summer は透明なターコイズに淡い緑の軸、Winter は淡い青。Spring と Autumn は Mini の色の資料が見つからず、
  // 同じ四季シリーズの BOX 版の色（Spring は緑、Autumn は茶のハウジングにベージュの軸）にしている
  {
    id: 'kailh-spring-mini', name: 'Kailh Spring Mini', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 40, preTravel: 1.2, totalTravel: 2.8,
    stemColor: '#5aa84f', housingColor: 'rgba(110, 186, 98, 0.6)', bottomHousingColor: '#7cbf6e', ...LOW_PROFILE_REVIEW,
    note: '四季（Season）シリーズ Mini のリニア',
  },
  {
    id: 'kailh-summer-mini', name: 'Kailh Summer Mini', maker: 'Kailh', mount: 'choc-v2', type: 'clicky',
    forceGf: 50, preTravel: 1.2, totalTravel: 2.8,
    stemColor: '#a8e2b4', housingColor: 'rgba(56, 190, 190, 0.5)', ...LOW_PROFILE_REVIEW,
    note: '四季シリーズ Mini のクリッキー（Autumn Mini より重い）',
  },
  {
    id: 'kailh-autumn-mini', name: 'Kailh Autumn Mini', maker: 'Kailh', mount: 'choc-v2', type: 'clicky',
    forceGf: 40, preTravel: 1.2, totalTravel: 2.8,
    stemColor: '#e3cfae', housingColor: 'rgba(138, 86, 46, 0.62)', ...LOW_PROFILE_REVIEW,
    note: '四季シリーズ Mini の、軽めのクリッキー',
  },
  {
    id: 'kailh-winter-mini', name: 'Kailh Winter Mini', maker: 'Kailh', mount: 'choc-v2', type: 'tactile',
    forceGf: 38, stemColor: '#a4c9ea', housingColor: 'rgba(164, 204, 236, 0.62)', bottomHousingColor: '#b7d6ef', ...LOW_PROFILE_REVIEW,
    note: '四季シリーズ Mini の、軽めのタクタイル',
  },
  // Kailh の Deep Sea Silent Mini（2 つのシリコンのダンパーで音を抑えた静音）。上が透明・下が濃い青で、
  // 軸は Islet が白・Pink Island がピンク・Whale が茶
  {
    id: 'kailh-deep-sea-mini-islet', name: 'Kailh Deep Sea Mini Islet', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    silent: true, forceGf: 43, preTravel: 1.3, totalTravel: 2.8,
    stemColor: '#f4f4f0', housingColor: CLEAR, bottomHousingColor: DEEP_SEA_BLUE, ...LOW_PROFILE_REVIEW,
    note: 'Deep Sea Silent Mini の静音リニア。動画では「Islet（45g）」として紹介されている',
  },
  {
    id: 'kailh-deep-sea-mini-pink-island', name: 'Kailh Deep Sea Mini Pink Island', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    silent: true, forceGf: 35, preTravel: 1.3, totalTravel: 2.8,
    stemColor: '#f7a8c4', housingColor: CLEAR, bottomHousingColor: DEEP_SEA_BLUE, ...LOW_PROFILE_REVIEW,
    note: '軸がピンクの、軽い版の Islet（静音リニア）。動画では「Islet（35g）」として紹介されている',
  },
  {
    id: 'kailh-deep-sea-mini-whale', name: 'Kailh Deep Sea Mini Whale', maker: 'Kailh', mount: 'choc-v2', type: 'tactile',
    silent: true, forceGf: 45, preTravel: 1.3, totalTravel: 2.8,
    stemColor: '#7c3000', housingColor: CLEAR, bottomHousingColor: DEEP_SEA_BLUE, ...LOW_PROFILE_REVIEW,
    note: 'Deep Sea Silent Mini の静音タクタイル',
  },
  // Kailh のそのほかの Choc V2（レバーレスコントローラー向けに作られたものも、キーボードに挿さる）
  {
    // 全部 POM の青の単色
    id: 'kailh-wind-engine', name: 'Kailh Wind Engine', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 50, totalTravel: 3.2, stemColor: '#4a78c8', housingColor: '#4a78c8', ...LOW_PROFILE_REVIEW,
    note: 'ハウジングも軸も POM。レバーレスコントローラー向けに作られたリニア',
  },
  {
    // ハウジングは上下とも透明。軸の色は資料で確かめられていない（透明として描いている）
    id: 'kailh-crystal', name: 'Kailh Crystal', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 50, totalTravel: 3.2, stemColor: 'rgba(226, 238, 244, 0.85)', housingColor: CLEAR, ...LOW_PROFILE_REVIEW,
    note: '透明なポリカーボネートのハウジング。レバーレスコントローラー向けに作られたリニア',
  },
  {
    id: 'kailh-shadow-hunting', name: 'Kailh Shadow Hunting', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 50, stemColor: BLACK, housingColor: BLACK, ...LOW_PROFILE_REVIEW,
    note: 'レバーレスコントローラー向けのリニア。押し切りの深さは資料によって違うので載せていない',
  },
  {
    id: 'kailh-saker-mini', name: 'Kailh Saker Mini', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 37, preTravel: 0.8, totalTravel: 1.8, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: '押し切るまで 1.8mm と特に浅い、ゲーム向けのリニア',
  },
  {
    // どの部品も乳白色
    id: 'kailh-ice-cream-mini', name: 'Kailh Ice Cream Mini', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 40, preTravel: 1.2, totalTravel: 2.8, stemColor: '#f4f1ea', housingColor: '#f4f1ea', ...LOW_PROFILE_REVIEW,
    note: 'ハウジングも軸も POM のリニア',
  },
  {
    // ハウジングは Ice Cream Mini と同じ白で、軸だけがタロイモの薄紫
    id: 'kailh-taro-ice-cream-mini', name: 'Kailh Taro Ice Cream Mini', maker: 'Kailh', mount: 'choc-v2', type: 'linear',
    forceGf: 37, totalTravel: 2.8, stemColor: '#b9a1d8', housingColor: '#f4f1ea', ...LOW_PROFILE_REVIEW,
    note: 'ハウジングも軸も POM。Ice Cream Mini より少し軽いリニア',
  },

  /* ---- Gateron KS-33（ロープロファイル 2.0） ---- */
  // 最初の版の色。上が透明・下が白（あとから下が黒の版も出た）
  {
    id: 'gateron-ks33-red', name: 'Gateron KS-33 Red', maker: 'Gateron', mount: 'gateron-lp', type: 'linear',
    forceGf: 45, preTravel: 1.7, totalTravel: 3.0, stemColor: '#e0372d', housingColor: CLEAR, bottomHousingColor: WHITE,
  },
  {
    id: 'gateron-ks33-brown', name: 'Gateron KS-33 Brown', maker: 'Gateron', mount: 'gateron-lp', type: 'tactile',
    forceGf: 55, preTravel: 1.7, totalTravel: 3.0, stemColor: '#694824', housingColor: CLEAR, bottomHousingColor: WHITE,
  },
  {
    id: 'gateron-ks33-banana', name: 'Gateron KS-33 Banana', maker: 'Gateron', mount: 'gateron-lp', type: 'tactile',
    forceGf: 60, preTravel: 1.7, totalTravel: 3.0, stemColor: '#f5d547', housingColor: CLEAR, bottomHousingColor: WHITE,
  },
  {
    id: 'gateron-ks33-blue', name: 'Gateron KS-33 Blue', maker: 'Gateron', mount: 'gateron-lp', type: 'clicky',
    forceGf: 60, preTravel: 1.7, totalTravel: 3.0, stemColor: '#2f6fd6', housingColor: CLEAR, bottomHousingColor: WHITE,
  },

  /* ---- Keychron ロープロファイル（Orca echo） ---- */
  // 色はギズモード・ジャパンの投票で決まったもの（2026 年 8 月・パターン C）。Ninja はグレーに淡い青の軸、Samurai は黒にワインレッドの軸
  {
    id: 'keychron-apex-ninja', name: 'Keychron Ninja', maker: 'Keychron', mount: 'keychron-lp', type: 'linear',
    stemColor: '#a9cde8', housingColor: '#9a9ca2',
    soundQuery: 'Keychron Orca echo Ninja switch sound test',
    note: 'Orca echo の標準スイッチ（Apex POM ロープロファイル）の、なめらかに底まで沈むほう。押下圧などは公表待ち',
  },
  {
    id: 'keychron-apex-samurai', name: 'Keychron Samurai', maker: 'Keychron', mount: 'keychron-lp', type: 'tactile',
    stemColor: '#7b1f32', housingColor: BLACK,
    soundQuery: 'Keychron Orca echo Samurai switch sound test',
    note: 'Orca echo の標準スイッチ（Apex POM ロープロファイル）の、はっきりした手応えがあるほう。押下圧などは公表待ち',
  },

  /* ---- Lofree 専用（Flow84・Flow100・Flow Lite84・Flow Lite100 だけに挿さる） ---- */
  // 色は資料で確かめられていない
  {
    id: 'lofree-specter', name: 'Lofree Specter', maker: 'Lofree × Kailh', mount: 'lofree-lp', type: 'linear',
    forceGf: 40, totalTravel: 2.8, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: 'Lofree のキーボード専用のリニア。ほかのキーボードの Choc V2 用ソケットには挿さらない',
  },
  {
    id: 'lofree-hades', name: 'Lofree Hades', maker: 'Lofree', mount: 'lofree-lp', type: 'linear', silent: true,
    forceGf: 45, preTravel: 1.3, totalTravel: 2.8, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: 'Lofree のキーボード専用の静音リニア。ハウジングも軸も POM',
  },

  /* ---- 足の形（挿さるソケット）を確かめられていないもの ---- */
  // 色も資料で確かめられていない
  {
    id: 'kailh-panda-v1', name: 'Kailh Panda V1', maker: 'Kailh', mount: 'unconfirmed-lp', type: 'linear',
    forceGf: 30, preTravel: 1.2, totalTravel: 2.8, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: 'レバーレスコントローラー向けとして売られている軽いリニア。挿さるソケットは確かめられていない'
      + '（名前の「V1」が Choc V1 の形のことなのかも分からない）',
  },
  {
    id: 'kailh-panda-v2', name: 'Kailh Panda V2', maker: 'Kailh', mount: 'unconfirmed-lp', type: 'linear',
    forceGf: 40, preTravel: 0.8, totalTravel: 2.0, colorUnknown: true, ...LOW_PROFILE_REVIEW,
    note: 'Panda V1 より浅い（押し切るまで 2.0mm）リニア。挿さるソケットは確かめられていない'
      + '（名前の「V2」が Choc V2 の形のことなのかも分からない）',
  },
]

const SWITCH_BY_ID = new Map(KEYSWITCHES.map((s) => [s.id, s]))

export function getSwitch(id: string | undefined): KeySwitch | undefined {
  return id ? SWITCH_BY_ID.get(id) : undefined
}

/** 色を資料で確かめられていないスイッチ（colorUnknown）を描く灰色。種類ごとの色で描くと、実物の色と取り違えるので */
const UNKNOWN_STEM = '#9ca3af'
const UNKNOWN_HOUSING = '#dcdde0'

export function stemColorOf(sw: KeySwitch): string {
  if (sw.colorUnknown) return UNKNOWN_STEM
  return sw.stemColor ?? SWITCH_TYPE_STEM[sw.type]
}

/** イラストのハウジングの色（上・下）。書いていない色は undefined（イラストの既定の色で描く） */
export function housingColorsOf(sw: KeySwitch): { top?: string; bottom?: string } {
  if (sw.colorUnknown) return { top: UNKNOWN_HOUSING, bottom: UNKNOWN_HOUSING }
  return { top: sw.housingColor, bottom: sw.bottomHousingColor ?? sw.housingColor }
}

/**
 * 打鍵音を聞けるページ。個別のページ（soundUrl）が無いものは、YouTube の検索結果
 * （「名前 sound test」。動画の差し替えや削除で切れないよう、特定の動画ではなく検索にしている）
 */
export function switchSoundUrl(sw: KeySwitch): string {
  if (sw.soundUrl) return sw.soundUrl
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(switchSoundQuery(sw))}`
}

/** 打鍵音を YouTube で探すときの言葉 */
export function switchSoundQuery(sw: KeySwitch): string {
  return sw.soundQuery ?? `${sw.name} sound test`
}

/** 押下圧のだいたいの重さ（はじめての人向けの目安） */
export type ForceFeel = 'very-light' | 'light' | 'medium' | 'heavy'

export const FORCE_FEEL_LABEL: Record<ForceFeel, string> = {
  'very-light': 'とても軽い',
  light: '軽め',
  medium: 'ふつう',
  heavy: '重め',
}

/** 赤軸（45gf）を「軽め」、茶軸（55gf）を「ふつう」、黒軸・青軸（60gf）を「重め」とする目安 */
export function forceFeel(gf: number): ForceFeel {
  if (gf <= 30) return 'very-light'
  if (gf <= 45) return 'light'
  if (gf <= 55) return 'medium'
  return 'heavy'
}

/** 「45gf・2.0 / 4.0mm」のような、数値の一行の要約（分からない値は省く） */
export function switchSpecLine(sw: KeySwitch): string {
  const parts: string[] = []
  if (sw.forceGf !== undefined) parts.push(`${sw.forceGf}gf`)
  if (sw.totalTravel !== undefined) {
    parts.push(sw.preTravel !== undefined
      ? `${sw.preTravel.toFixed(1)} / ${sw.totalTravel.toFixed(1)}mm`
      : `${sw.totalTravel.toFixed(1)}mm`)
  }
  return parts.join('・')
}

/** そのソケットのどれかに挿さるスイッチ */
export function switchesForSockets(sockets: readonly SocketId[]): KeySwitch[] {
  return KEYSWITCHES.filter((sw) => sockets.some((s) => socketFit(s, sw.mount)))
}

/* ---------------------------------------------------------------- 配列に添えるスイッチ */

/** カタログのスイッチを、配列に添える形にする */
export function pickOf(sw: KeySwitch): SwitchPick {
  return { id: sw.id, name: sw.name }
}

/** 同じスイッチか。ID があれば ID で、無ければ名前（大文字小文字・空白の違いは無視）で比べる */
export function samePick(a: SwitchPick, b: SwitchPick): boolean {
  if (a.id || b.id) return a.id === b.id
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  return norm(a.name) === norm(b.name)
}

/** 添えられたスイッチの表示名。カタログにあるものはカタログの今の名前 */
export function pickLabel(pick: SwitchPick): string {
  return getSwitch(pick.id)?.name ?? pick.name
}

/**
 * 半角を 1、全角を 2 と数えた幅で切る（はみ出す分は … にする）。
 * 手で入力された長い名前でも、チップや共有カードの狭い欄からはみ出さないように使う
 * （画像保存の html2canvas は CSS の省略表示を正しく描けないので、文字の側で切る）
 */
export function clipByWidth(s: string, max: number): string {
  const widthOf = (ch: string) => (/[\u0020-\u007e\uff61-\uff9f]/.test(ch) ? 1 : 2)
  const chars = [...s]
  if (chars.reduce((w, ch) => w + widthOf(ch), 0) <= max) return s
  let width = 1 // 末尾の … の分
  let out = ''
  for (const ch of chars) {
    width += widthOf(ch)
    if (width > max) break
    out += ch
  }
  return `${out}…`
}

/** チップに出す名前の幅（全角 18 文字・半角 36 文字）。カタログの名前はどれもこれに収まる */
export const PICK_CHIP_WIDTH = 36

/** 配列に添えられたキースイッチ。無い配列は空 */
export function switchesOf(km: Keymap): SwitchPick[] {
  return km.settings?.switches ?? []
}

/** 配列のキースイッチを付け替える（空なら持たない形に戻す） */
export function withSwitches(km: Keymap, picks: readonly SwitchPick[]): Keymap {
  const { switches: _drop, ...settings } = km.settings
  return { ...km, settings: picks.length > 0 ? { ...settings, switches: [...picks] } : settings }
}
