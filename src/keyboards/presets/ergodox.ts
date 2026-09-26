import { preset } from './preset'

/* ================================================================
   ErgoDox EZ（ZSA）— 分割エルゴノミクスキーボードの草分け。親指クラスタは実物どおり傾けてある

   座標: keyboard-layout-editor の ErgoDox プリセット（キー順は QMK の LAYOUT_ergodox_pretty に合わせた）
   初期キーマップ: QMK keyboards/ergodox_ez/keymaps/default/keymap.c
   ================================================================ */

export const ERGODOX_EZ = preset({
  id: 'zsa-ergodox-ez',
  name: 'ErgoDox EZ',
  maker: 'ZSA',
  firmware: 'qmk',
  qmkLayout: 'LAYOUT_ergodox_pretty',
  hashtag: 'ergodox',
  splitAt: 9.75,
  keys: [
    [0, 0.375, 1.5], [1.5, 0.375], [2.5, 0.125], [3.5, 0], [4.5, 0.125], [5.5, 0.25], [6.5, 0.25], [12, 0.25], [13, 0.25], [14, 0.125], [15, 0], [16, 0.125], [17, 0.375], [18, 0.375, 1.5],
    [0, 1.375, 1.5], [1.5, 1.375], [2.5, 1.125], [3.5, 1], [4.5, 1.125], [5.5, 1.25], [6.5, 1.25, 1, 1.5], [12, 1.25, 1, 1.5], [13, 1.25], [14, 1.125], [15, 1], [16, 1.125], [17, 1.375], [18, 1.375, 1.5],
    [0, 2.375, 1.5], [1.5, 2.375], [2.5, 2.125], [3.5, 2], [4.5, 2.125], [5.5, 2.25], [13, 2.25], [14, 2.125], [15, 2], [16, 2.125], [17, 2.375], [18, 2.375, 1.5],
    [0, 3.375, 1.5], [1.5, 3.375], [2.5, 3.125], [3.5, 3], [4.5, 3.125], [5.5, 3.25], [6.5, 2.75, 1, 1.5], [12, 2.75, 1, 1.5], [13, 3.25], [14, 3.125], [15, 3], [16, 3.125], [17, 3.375], [18, 3.375, 1.5],
    [0.5, 4.375], [1.5, 4.375], [2.5, 4.125], [3.5, 4], [4.5, 4.125], [14, 4.125], [15, 4], [16, 4.125], [17, 4.375], [18, 4.375],
    [7.5, 3.25, 1, 1, 30, 6.5, 4.25], [8.5, 3.25, 1, 1, 30, 6.5, 4.25], [10, 3.25, 1, 1, -30, 13, 4.25], [11, 3.25, 1, 1, -30, 13, 4.25],
    [8.5, 4.25, 1, 1, 30, 6.5, 4.25], [10, 4.25, 1, 1, -30, 13, 4.25],
    [6.5, 4.25, 1, 2, 30, 6.5, 4.25], [7.5, 4.25, 1, 2, 30, 6.5, 4.25], [8.5, 5.25, 1, 1, 30, 6.5, 4.25], [10, 5.25, 1, 1, -30, 13, 4.25], [11, 4.25, 1, 2, -30, 13, 4.25], [12, 4.25, 1, 2, -30, 13, 4.25],
  ],
  thumbs: [64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      keys: `
        EQUAL      N1         N2         N3         N4         N5         LEFT         RIGHT      N6         N7         N8         N9         N0         MINUS
        DEL        Q          W          E          R          T          TG_1         TG_1       Y          U          I          O          P          BSLH
        BSPC       A          S          D          F          G            H          J          K          L          SEMI@FN_2  SQT@LGUI
        LSHFT      Z@LCTRL    X          C          V          B          NONE@HYPER   NONE@MEH   N          M          COMMA      DOT        FSLH@LCTRL RSHFT
        GRAVE@FN_1 SQT        x          LEFT       RIGHT        UP         DOWN       LBKT       RBKT       TG_1@FN_1
        K_APP@LALT LGUI         LALT       ESC@LCTRL
        HOME         PG_UP
        SPACE      BSPC       END          PG_DN      TAB        ENTER
      `,
    },
    {
      name: 'SYMBOL', color: 'pink',
      keys: `
        x       F1      F2      F3      F4      F5      _         _       F6      F7      F8      F9      F10     F11
        _       EXCL    AT      LBRC    RBRC    PIPE    _         _       UP      N7      N8      N9      STAR    F12
        _       HASH    DLLR    LPAR    RPAR    GRAVE     DOWN    N4      N5      N6      PLUS    _
        _       PRCNT   CARET   LBKT    RBKT    TILDE   _         _       AMPS    N1      N2      N3      BSLH    _
        x       _       _       _       _         _       DOT     N0      EQUAL   _
        x       _         RGB_TOG x
        _         _
        x       x       _         _       x       x
      `,
    },
    {
      name: 'MEDIA', color: 'green',
      keys: `
        _        _        _        _        _        _        _          _        _        _        _        _        _        _
        _        _        _        MS_UP    _        _        _          _        _        _        _        _        _        _
        _        _        MS_LEFT  MS_DOWN  MS_RIGHT _          _        _        _        _        _        C_PP
        _        _        _        _        _        _        _          _        _        _        C_PREV   C_NEXT   _        _
        _        _        _        MB1      MB2        C_VOL_UP C_VOL_DN C_MUTE   _        _
        _        _          _        _
        _          _
        _        _        _          _        _        x
      `,
    },
  ],
  // レイヤーキーは L0 の割当からは手元のキーに対応づかないので、空いているキーに当てる
  capture: { NonConvert: 20, Lang2: 20, Convert: 21, Lang1: 21, AltRight: 63 },
  defaultKeymapName: 'ErgoDox EZ 標準',
})
