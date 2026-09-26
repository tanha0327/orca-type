import { preset } from './preset'

/* ================================================================
   Kyria rev3（splitkb.com）— 強いカラムスタッガーと扇形の親指クラスタの 50 キー分割

   座標: ZMK app/boards/shields/kyria/kyria-layouts.dtsi（6 Column）
   初期キーマップ: ZMK app/boards/shields/kyria/kyria_rev3.keymap
   エンコーダーは左右に 1 つずつ。位置は親指クラスタの上の空きに置いた目安
   ================================================================ */

export const KYRIA = preset({
  id: 'splitkb-kyria',
  name: 'Kyria',
  maker: 'splitkb.com',
  firmware: 'zmk',
  qmkLayout: 'LAYOUT_split_3x6_5',
  hashtag: 'kyria',
  splitAt: 8.5,
  keys: [
    [0, 0.75], [1, 0.75], [2, 0.25], [3, 0], [4, 0.25], [5, 0.37], [11, 0.37], [12, 0.25], [13, 0], [14, 0.25], [15, 0.75], [16, 0.75],
    [0, 1.75], [1, 1.75], [2, 1.25], [3, 1], [4, 1.25], [5, 1.37], [11, 1.37], [12, 1.25], [13, 1], [14, 1.25], [15, 1.75], [16, 1.75],
    [0, 2.75], [1, 2.75], [2, 2.25], [3, 2], [4, 2.25], [5, 2.37], [3.5, 2.25, 1, 1, 30, 4, 7.92], [3.5, 2.25, 1, 1, 45, 4, 7.92], [12.5, 2.25, 1, 1, -45, 13, 7.92], [12.5, 2.25, 1, 1, -30, 13, 7.92], [11, 2.37], [12, 2.25], [13, 2], [14, 2.25], [15, 2.75], [16, 2.75],
    [2.5, 3.25], [3.5, 3.25], [3.5, 3.25, 1, 1, 15, 4, 7.92], [3.5, 3.25, 1, 1, 30, 4, 7.92], [3.5, 3.25, 1, 1, 45, 4, 7.92], [12.5, 3.25, 1, 1, -45, 13, 7.92], [12.5, 3.25, 1, 1, -30, 13, 7.92], [12.5, 3.25, 1, 1, -15, 13, 7.92], [12.5, 3.25], [13.5, 3.25],
  ],
  thumbs: [30, 31, 32, 33, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
  sensors: [
    { id: 'enc0', kind: 'encoder', name: '左エンコーダー', short: 'ENC L', half: 'L', x: 6.2, y: 0.9, w: 0.9, h: 0.9 },
    { id: 'enc1', kind: 'encoder', name: '右エンコーダー', short: 'ENC R', half: 'R', x: 9.9, y: 0.9, w: 0.9, h: 0.9 },
  ],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      // エンコーダーは「左回し 右回し」の順
      sensors: { enc0: 'C_VOL_DN C_VOL_UP', enc1: 'PG_DN PG_UP' },
      keys: `
        ESC   Q     W     E     R     T       Y     U     I     O     P     BSLH
        TAB   A     S     D     F     G       H     J     K     L     SEMI  SQT
        LSHFT Z     X     C     V     B     LSHFT LSHFT   FN_1  LSHFT N     M     COMMA DOT   FSLH  RCTRL
        LGUI  DEL   ENTER SPACE ESC     ENTER SPACE TAB   BSPC  RALT
      `,
    },
    {
      name: 'FUNCTION', color: 'pink',
      // エンコーダーは「左回し 右回し」の順
      sensors: { enc0: 'C_VOL_DN C_VOL_UP', enc1: 'PG_DN PG_UP' },
      keys: `
        _        _        BT_CLR   BT_SEL_0 BT_SEL_1 BT_SEL_2   _        _        _        _        _        _
        _        _        _        BT_SEL_3 BT_SEL_4 _          _        _        _        _        _        _
        _        _        _        _        _        _        _        _          _        _        _        _        _        _        _        _
        _        _        _        _        _          _        _        _        _        _
      `,
    },
    { name: 'RAISE', color: 'green' },
    { name: 'ADJUST', color: 'purple' },
  ],
  // レイヤーキーは L0 の割当からは手元のキーに対応づかないので、空いているキーに当てる
  capture: { Convert: 32, Lang1: 32 },
  defaultKeymapName: 'Kyria 標準',
})
