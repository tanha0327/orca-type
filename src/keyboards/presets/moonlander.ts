import { preset } from './preset'

/* ================================================================
   Moonlander Mark I（ZSA）— ErgoDox の流れをくむ 72 キー分割。親指に赤い大きなキー

   座標: QMK keyboards/zsa/moonlander/keyboard.json（LAYOUT）
   初期キーマップ: QMK keyboards/zsa/moonlander/keymaps/default/keymap.c
   ================================================================ */

export const MOONLANDER = preset({
  id: 'zsa-moonlander',
  name: 'Moonlander Mark I',
  maker: 'ZSA',
  firmware: 'qmk',
  qmkLayout: 'LAYOUT',
  hashtag: 'moonlander',
  splitAt: 8.5,
  keys: [
    [0, 0.375], [1, 0.375], [2, 0.125], [3, 0], [4, 0.125], [5, 0.25], [6, 0.25], [10, 0.25], [11, 0.25], [12, 0.125], [13, 0], [14, 0.125], [15, 0.375], [16, 0.375],
    [0, 1.375], [1, 1.375], [2, 1.125], [3, 1], [4, 1.125], [5, 1.25], [6, 1.25], [10, 1.25], [11, 1.25], [12, 1.125], [13, 1], [14, 1.125], [15, 1.375], [16, 1.375],
    [0, 2.375], [1, 2.375], [2, 2.125], [3, 2], [4, 2.125], [5, 2.25], [6, 2.25], [10, 2.25], [11, 2.25], [12, 2.125], [13, 2], [14, 2.125], [15, 2.375], [16, 2.375],
    [0, 3.375], [1, 3.375], [2, 3.125], [3, 3], [4, 3.125], [5, 3.25], [11, 3.25], [12, 3.125], [13, 3], [14, 3.125], [15, 3.375], [16, 3.375],
    [0, 4.375], [1, 4.375], [2, 4.125], [3, 4], [4, 4.125], [5, 4.5, 2], [10, 4.5, 2], [12, 4.125], [13, 4], [14, 4.125], [15, 4.375], [16, 4.375],
    [5, 5.5, 1, 1.5], [6, 5.5, 1, 1.5], [7, 5.5, 1, 1.5], [9, 5.5, 1, 1.5], [10, 5.5, 1, 1.5], [11, 5.5, 1, 1.5],
  ],
  thumbs: [59, 60, 66, 67, 68, 69, 70, 71],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      keys: `
        EQUAL      N1         N2         N3         N4         N5         LEFT         RIGHT      N6         N7         N8         N9         N0         MINUS
        DEL        Q          W          E          R          T          TG_1         TG_1       Y          U          I          O          P          BSLH
        BSPC       A          S          D          F          G          HYPER        MEH        H          J          K          L          SEMI@FN_2  SQT@LGUI
        LSHFT      Z@LCTRL    X          C          V          B            N          M          COMMA      DOT        FSLH@RCTRL RSHFT
        GRAVE@FN_1 x          x          LEFT       RIGHT      K_APP@LALT   ESC@RCTRL  UP         DOWN       LBKT       RBKT       FN_1
        SPACE      BSPC       LGUI         LALT       TAB        ENTER
      `,
    },
    {
      name: 'SYMBOL', color: 'pink',
      keys: `
        x       F1      F2      F3      F4      F5      _         _       F6      F7      F8      F9      F10     F11
        _       EXCL    AT      LBRC    RBRC    PIPE    _         _       UP      N7      N8      N9      STAR    F12
        _       HASH    DLLR    LPAR    RPAR    GRAVE   _         _       DOWN    N4      N5      N6      PLUS    _
        _       PRCNT   CARET   LBKT    RBKT    TILDE     AMPS    N1      N2      N3      BSLH    _
        x       _       _       _       _       x         RGB_TOG _       DOT     N0      EQUAL   _
        x       x       x         x       _       _
      `,
    },
    {
      name: 'MEDIA', color: 'green',
      keys: `
        x          _          _          _          _          _          _            _          _          _          _          _          _          BOOTLOADER
        _          _          _          MS_UP      _          _          _            _          _          _          _          _          _          _
        _          _          MS_LEFT    MS_DOWN    MS_RIGHT   _          _            _          _          _          _          _          _          C_PP
        _          _          _          _          _          _            _          _          C_PREV     C_NEXT     _          _
        _          _          _          MB1        MB2        _            _          C_VOL_UP   C_VOL_DN   C_MUTE     _          _
        _          _          _            _          _          _
      `,
    },
  ],
  // レイヤーキーは L0 の割当からは手元のキーに対応づかないので、空いているキーに当てる
  capture: { NonConvert: 20, Lang2: 20, Convert: 21, Lang1: 21, AltRight: 65 },
  defaultKeymapName: 'Moonlander 標準',
})
