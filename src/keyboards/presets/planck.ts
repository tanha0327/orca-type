import { preset } from './preset.js'

/* ================================================================
   Planck（OLKB）— 4 行 12 列の格子配列（オーソリニア）の 40% キーボード

   座標: ZMK app/dts/layouts/common/ortho_4x12/all1u.dtsi（全キー 1u の grid 配列）
   初期キーマップ: ZMK app/boards/olkb/planck/planck.keymap
   ================================================================ */

export const PLANCK = preset({
  id: 'olkb-planck',
  name: 'Planck',
  maker: 'OLKB',
  firmware: 'qmk',
  qmkLayout: 'LAYOUT_ortho_4x12',
  hashtag: 'planck',
  keys: [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],
  ],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      keys: `
        TAB   Q     W     E     R     T     Y     U     I     O     P     BSPC
        ESC   A     S     D     F     G     H     J     K     L     SEMI  SQT
        LSHFT Z     X     C     V     B     N     M     COMMA DOT   FSLH  ENTER
        _     LCTRL LALT  LGUI  FN_1  _     SPACE FN_2  LEFT  DOWN  UP    RIGHT
      `,
    },
    {
      name: 'LOWER', color: 'pink',
      keys: `
        TILDE    EXCL     AT       HASH     DLLR     PRCNT    CARET    AMPS     STAR     LPAR     RPAR     DEL
        DEL      F1       F2       F3       F4       F5       F6       UNDER    PLUS     LBRC     RBRC     PIPE
        _        F7       F8       F9       F10      F11      F12      HASH     PIPE     HOME     END      _
        _        _        _        _        _        _        _        _        C_NEXT   C_VOL_DN C_VOL_UP C_PP
      `,
    },
    {
      name: 'RAISE', color: 'green',
      keys: `
        GRAVE      N1         N2         N3         N4         N5         N6         N7         N8         N9         N0         BSPC
        DEL        F1         F2         F3         F4         F5         F6         MINUS      EQUAL      LBKT       RBKT       BSLH
        _          F7         F8         F9         F10        F11        F12        HASH       BSLH       PG_UP      PG_DN      _
        SYS_RESET  BOOTLOADER _          _          _          _          _          _          C_NEXT     C_VOL_DN   C_VOL_UP   C_PP
      `,
    },
    { name: 'ADJUST', color: 'purple' },
  ],
  // レイヤーキーは L0 の割当からは手元のキーに対応づかないので、空いているキーに当てる
  capture: { NonConvert: 40, Lang2: 40, Convert: 43, Lang1: 43 },
  defaultKeymapName: 'Planck 標準',
})
