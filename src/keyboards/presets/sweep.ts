import { preset } from './preset'

/* ================================================================
   Ferris Sweep — 34 キーの最小構成の分割。ホームロー修飾（押し続けると Shift などになる）で使う前提の配列

   座標: ZMK app/dts/layouts/cuddlykeyboards/ferris.dtsi
   初期キーマップ: ZMK app/boards/pierrechevalier83/ferris/ferris.keymap
   ================================================================ */

export const FERRIS_SWEEP = preset({
  id: 'ferris-sweep',
  name: 'Ferris Sweep',
  maker: 'Pierre Chevalier / David Barr',
  firmware: 'zmk',
  qmkLayout: 'LAYOUT_split_3x5_2',
  hashtag: 'ferrissweep',
  splitAt: 6,
  keys: [
    [0, 0.95], [1, 0.32], [2, 0], [3, 0.28], [4, 0.42], [7, 0.42], [8, 0.28], [9, 0], [10, 0.32], [11, 0.95],
    [0, 1.95], [1, 1.32], [2, 1], [3, 1.29], [4, 1.42], [7, 1.42], [8, 1.29], [9, 1], [10, 1.32], [11, 1.95],
    [0, 2.95], [1, 2.31], [2, 2], [3, 2.29], [4, 2.42], [7, 2.42], [8, 2.29], [9, 2], [10, 2.31], [11, 2.95],
    [3.3, 3.55, 1, 1, 15, 4.3, 4.55], [4.3, 3.55, 1, 1, 30, 4.3, 4.55], [6.7, 3.55, 1, 1, -30, 7.7, 4.55], [7.7, 3.55, 1, 1, -15, 7.7, 4.55],
  ],
  thumbs: [30, 31, 32, 33],
  layerCount: 5,
  layers: [
    {
      name: 'BASE', color: 'gray',
      keys: `
        Q          W          E          R          T            Y          U          I          O          P
        A@LGUI     S@LALT     D@LCTRL    F@LSHFT    G            H          J@RSHFT    K@RCTRL    L@LALT     SQT@LGUI
        Z          X          C          V          B            N          M          COMMA      DOT        FSLH
        TAB@FN_1   ENTER        SPACE@FN_3 BSPC@MO_4
      `,
    },
    {
      name: 'NAV', color: 'pink',
      keys: `
        _     _     _     _     _       _     _     _     _     _
        _     _     _     _     _       _     LEFT  DOWN  UP    RIGHT
        _     _     _     _     _       _     HOME  PG_DN PG_UP END
        _     _       ESC   DEL
      `,
    },
    {
      name: 'OTHER', color: 'green',
      keys: `
        _    _    _    _    _      _    _    _    _    _
        _    _    _    _    _      _    _    _    _    _
        _    _    _    _    _      _    HOME _    _    _
        _    _      _    _
      `,
    },
    {
      name: 'NUM', color: 'purple',
      keys: `
        LBKT  N7    N8    N9    RBKT    _     _     _     _     _
        SEMI  N4    N5    N6    EQUAL   _     _     _     _     _
        GRAVE N1    N2    N3    BSLH    _     _     _     _     _
        N0    MINUS   _     _
      `,
    },
    {
      name: 'SYM', color: 'cyan',
      keys: `
        LBRC  AMPS  STAR  LPAR  RBRC    _     _     _     _     _
        COLON DLLR  PRCNT CARET PLUS    _     _     _     _     _
        TILDE EXCL  AT    HASH  PIPE    _     _     _     _     _
        RPAR  UNDER   _     _
      `,
    },
  ],
  defaultKeymapName: 'Ferris Sweep 標準',
})
