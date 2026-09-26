import { preset } from './preset'

/* ================================================================
   Iris（Keebio）— 数字段つき 4 行 6 列 + 親指キーの 56 キー分割

   座標: QMK keyboards/keebio/iris/rev7/keyboard.json（LAYOUT）
   初期キーマップ: QMK keyboards/keebio/iris/keymaps/default/keymap.json
   LOWER と RAISE を同時に押すと ADJUST になる（トライレイヤー）が、ここでは ADJUST は白紙にしてある
   ================================================================ */

export const IRIS = preset({
  id: 'keebio-iris',
  name: 'Iris',
  maker: 'Keebio',
  firmware: 'qmk',
  qmkLayout: 'LAYOUT',
  splitAt: 7,
  keys: [
    [0, 0.375], [1, 0.375], [2, 0.125], [3, 0], [4, 0.125], [5, 0.25], [9, 0.25], [10, 0.125], [11, 0], [12, 0.125], [13, 0.375], [14, 0.375],
    [0, 1.375], [1, 1.375], [2, 1.125], [3, 1], [4, 1.125], [5, 1.25], [9, 1.25], [10, 1.125], [11, 1], [12, 1.125], [13, 1.375], [14, 1.375],
    [0, 2.375], [1, 2.375], [2, 2.125], [3, 2], [4, 2.125], [5, 2.25], [9, 2.25], [10, 2.125], [11, 2], [12, 2.125], [13, 2.375], [14, 2.375],
    [0, 3.375], [1, 3.375], [2, 3.125], [3, 3], [4, 3.125], [5, 3.25], [6.15, 3.75], [7.85, 3.75], [9, 3.25], [10, 3.125], [11, 3], [12, 3.125], [13, 3.375], [14, 3.375],
    [3.5, 4.25], [4.5, 4.375], [5.6, 4.75], [8.4, 4.75], [9.5, 4.375], [10.5, 4.25],
  ],
  thumbs: [50, 51, 52, 53, 54, 55],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      keys: `
        ESC   N1    N2    N3    N4    N5      N6    N7    N8    N9    N0    BSPC
        TAB   Q     W     E     R     T       Y     U     I     O     P     DEL
        LCTRL A     S     D     F     G       H     J     K     L     SEMI  SQT
        LSHFT Z     X     C     V     B     HOME    END   N     M     COMMA DOT   FSLH  RSHFT
        LGUI  FN_1  ENTER   SPACE FN_2  RALT
      `,
    },
    {
      name: 'LOWER', color: 'pink',
      keys: `
        TILDE      EXCL       AT         HASH       DLLR       PRCNT        CARET      AMPS       STAR       LPAR       RPAR       PG_UP
        GRAVE      _          UP         _          BOOTLOADER _            _          KP_N7      KP_N8      KP_N9      KP_N0      PG_DN
        DEL        LEFT       DOWN       RIGHT      _          LBKT         RBKT       KP_N4      KP_N5      KP_N6      PLUS       PIPE
        x          x          _          _          _          LBRC       LPAR         RPAR       RBRC       KP_N1      KP_N2      KP_N3      MINUS      _
        _          _          DEL          DEL        _          KP_N0
      `,
    },
    {
      name: 'RAISE', color: 'green',
      keys: `
        F12        F1         F2         F3         F4         F5           F6         F7         F8         F9         F10        F11
        RGB_TOG    EXCL       AT         HASH       DLLR       PRCNT        CARET      AMPS       STAR       LPAR       RPAR       BOOTLOADER
        x          C_PREV     C_NEXT     C_VOL_UP   PG_UP      UNDER        EQUAL      HOME       x          x          x          BSLH
        C_MUTE     C_STOP     C_PP       C_VOL_DN   PG_DN      MINUS      LPAR         _          PLUS       END        x          x          x          x
        _          _          _            _          _          _
      `,
    },
    { name: 'ADJUST', color: 'purple' },
  ],
  // レイヤーキーは L0 の割当からは手元のキーに対応づかないので、空いているキーに当てる
  capture: { NonConvert: 51, Lang2: 51, Convert: 54, Lang1: 54 },
  defaultKeymapName: 'Iris 標準',
})
