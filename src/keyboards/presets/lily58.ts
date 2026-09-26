import { preset } from './preset.js'

/* ================================================================
   Lily58（kata0510）— 数字段つき 58 キーの分割。日本発の定番

   座標: ZMK app/dts/layouts/kata0510/lily58.dtsi
   初期キーマップ: ZMK app/boards/shields/lily58/lily58.keymap
   ================================================================ */

export const LILY58 = preset({
  id: 'kata0510-lily58',
  name: 'Lily58',
  maker: 'kata0510',
  firmware: 'zmk',
  qmkLayout: 'LAYOUT',
  hashtag: 'Lily58',
  splitAt: 7.75,
  keys: [
    [0, 0.5], [1, 0.37], [2, 0.12], [3, 0], [4, 0.12], [5, 0.25], [10.5, 0.25], [11.5, 0.12], [12.5, 0], [13.5, 0.12], [14.5, 0.37], [15.5, 0.5],
    [0, 1.5], [1, 1.37], [2, 1.12], [3, 1], [4, 1.12], [5, 1.25], [10.5, 1.25], [11.5, 1.12], [12.5, 1], [13.5, 1.12], [14.5, 1.37], [15.5, 1.5],
    [0, 2.5], [1, 2.37], [2, 2.12], [3, 2], [4, 2.12], [5, 2.25], [10.5, 2.25], [11.5, 2.12], [12.5, 2], [13.5, 2.12], [14.5, 2.37], [15.5, 2.5],
    [0, 3.5], [1, 3.37], [2, 3.12], [3, 3], [4, 3.12], [5, 3.25], [6, 2.75], [9.5, 2.75], [10.5, 3.25], [11.5, 3.12], [12.5, 3], [13.5, 3.12], [14.5, 3.37], [15.5, 3.5],
    [2.5, 4.12], [3.5, 4.15], [4.5, 4.25], [5.75, 4, 1, 1.5, 30, 6.25, 4.75], [9.75, 4, 1, 1.5, -30, 10.25, 4.75], [11, 4.25], [12, 4.15], [13, 4.15],
  ],
  thumbs: [50, 51, 52, 53, 54, 55, 56, 57],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      keys: `
        ESC   N1    N2    N3    N4    N5      N6    N7    N8    N9    N0    GRAVE
        TAB   Q     W     E     R     T       Y     U     I     O     P     MINUS
        LCTRL A     S     D     F     G       H     J     K     L     SEMI  SQT
        LSHFT Z     X     C     V     B     LBKT    RBKT  N     M     COMMA DOT   FSLH  RSHFT
        LALT  LGUI  FN_1  SPACE   ENTER FN_2  BSPC  RGUI
      `,
    },
    {
      name: 'LOWER', color: 'pink',
      keys: `
        BT_CLR   BT_SEL_0 BT_SEL_1 BT_SEL_2 BT_SEL_3 BT_SEL_4   _        _        _        _        _        _
        F1       F2       F3       F4       F5       F6         F7       F8       F9       F10      F11      F12
        GRAVE    EXCL     AT       HASH     DLLR     PRCNT      CARET    AMPS     STAR     LPAR     RPAR     TILDE
        _        x        x        x        _        _        _          _        _        MINUS    PLUS     LBRC     RBRC     PIPE
        _        _        _        _          _        _        _        _
      `,
    },
    {
      name: 'RAISE', color: 'green',
      keys: `
        _     _     _     _     _     _       _     _     _     _     _     _
        GRAVE N1    N2    N3    N4    N5      N6    N7    N8    N9    N0    _
        F1    F2    F3    F4    F5    F6      _     LEFT  DOWN  UP    RIGHT _
        F7    F8    F9    F10   F11   F12   _       _     PLUS  MINUS EQUAL LBKT  RBKT  BSLH
        _     _     _     _       _     _     _     _
      `,
    },
    { name: 'ADJUST', color: 'purple' },
  ],
  // レイヤーキーは L0 の割当からは手元のキーに対応づかないので、空いているキーに当てる
  capture: { NonConvert: 52, Lang2: 52, Convert: 55, Lang1: 55 },
  defaultKeymapName: 'Lily58 標準',
})
