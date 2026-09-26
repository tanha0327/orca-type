import { preset } from './preset'

/* ================================================================
   Sofle（Josef Adamčík）— 数字段つき 58 キー + 押し込みつきロータリーエンコーダー 2 つの分割

   座標: ZMK app/dts/layouts/josefadamcik/sofle.dtsi
   初期キーマップ: ZMK app/boards/shields/sofle/sofle.keymap
   エンコーダーの押し込みは内側のキー（左は MUTE）。回転はそのすぐ上に描いている
   ================================================================ */

export const SOFLE = preset({
  id: 'josefadamcik-sofle',
  name: 'Sofle',
  maker: 'Josef Adamčík',
  firmware: 'zmk',
  qmkLayout: 'LAYOUT',
  hashtag: 'sofle',
  splitAt: 7,
  keys: [
    [0, 0.37], [1, 0.37], [2, 0.12], [3, 0], [4, 0.12], [5, 0.24], [9, 0.24], [10, 0.12], [11, 0], [12, 0.12], [13, 0.37], [14, 0.37],
    [0, 1.37], [1, 1.37], [2, 1.12], [3, 1], [4, 1.12], [5, 1.24], [9, 1.24], [10, 1.12], [11, 1], [12, 1.12], [13, 1.37], [14, 1.37],
    [0, 2.37], [1, 2.37], [2, 2.12], [3, 2], [4, 2.12], [5, 2.24], [9, 2.24], [10, 2.12], [11, 2], [12, 2.12], [13, 2.37], [14, 2.37],
    [0, 3.37], [1, 3.37], [2, 3.12], [3, 3], [4, 3.12], [5, 3.24], [6, 2.74], [8, 2.74], [9, 3.24], [10, 3.12], [11, 3], [12, 3.12], [13, 3.37], [14, 3.37],
    [1.75, 4.37], [2.75, 4.12], [3.75, 4.12], [4.9, 4.12, 1, 1, 12, 4.9, 4.12], [6, 3.83, 1, 1.5, 24, 6, 4.33], [8, 3.83, 1, 1.5, -24, 9, 4.33], [9.1, 4.12, 1, 1, -12, 10.1, 4.12], [10.25, 4.12], [11.25, 4.12], [12.25, 4.37],
  ],
  thumbs: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
  sensors: [
    { id: 'enc0', kind: 'encoder', name: '左エンコーダー', short: 'ENC L', half: 'L', x: 6.1, y: 1.55, w: 0.8, h: 0.8 },
    { id: 'enc1', kind: 'encoder', name: '右エンコーダー', short: 'ENC R', half: 'R', x: 8.1, y: 1.55, w: 0.8, h: 0.8 },
  ],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      // エンコーダーは「左回し 右回し」の順
      sensors: { enc0: 'C_VOL_DN C_VOL_UP', enc1: 'PG_DN PG_UP' },
      keys: `
        GRAVE  N1     N2     N3     N4     N5       N6     N7     N8     N9     N0     x
        ESC    Q      W      E      R      T        Y      U      I      O      P      BSPC
        TAB    A      S      D      F      G        H      J      K      L      SEMI   SQT
        LSHFT  Z      X      C      V      B      C_MUTE   x      N      M      COMMA  DOT    FSLH   RSHFT
        LGUI   LALT   LCTRL  FN_1   ENTER    SPACE  FN_2   RCTRL  RALT   RGUI
      `,
    },
    {
      name: 'LOWER', color: 'pink',
      // エンコーダーは「左回し 右回し」の順
      sensors: { enc0: 'C_VOL_DN C_VOL_UP', enc1: 'PG_DN PG_UP' },
      keys: `
        _     F1    F2    F3    F4    F5      F6    F7    F8    F9    F10   F11
        GRAVE N1    N2    N3    N4    N5      N6    N7    N8    N9    N0    F12
        _     EXCL  AT    HASH  DLLR  PRCNT   CARET AMPS  STAR  LPAR  RPAR  PIPE
        _     EQUAL MINUS PLUS  LBRC  RBRC  _       _     LBKT  RBKT  SEMI  COLON BSLH  _
        _     _     _     _     _       _     _     _     _     _
      `,
    },
    {
      name: 'RAISE', color: 'green',
      // エンコーダーは「左回し 右回し」の順
      sensors: { enc0: 'C_VOL_DN C_VOL_UP', enc1: 'PG_DN PG_UP' },
      keys: `
        BT_CLR   BT_SEL_0 BT_SEL_1 BT_SEL_2 BT_SEL_3 BT_SEL_4   _        _        _        _        _        _
        _        INS      PSCRN    K_APP    _        _          PG_UP    _        UP       _        _        _
        _        LALT     LCTRL    LSHFT    _        CAPS       PG_DN    LEFT     DOWN     RIGHT    DEL      BSPC
        _        x        x        x        x        _        _          _        _        _        _        _        _        _
        _        _        _        _        _          _        _        _        _        _
      `,
    },
    {
      name: 'ADJUST', color: 'purple',
      keys: `
        BT_CLR   BT_SEL_0 BT_SEL_1 BT_SEL_2 BT_SEL_3 BT_SEL_4   x        x        x        x        x        x
        x        x        x        x        x        x          x        x        x        x        x        x
        x        x        x        x        x        x          x        x        x        x        x        x
        x        x        x        x        x        x        RGB_TOG    x        x        x        x        x        x        x
        x        x        x        x        x          x        x        x        x        x
      `,
    },
  ],
  // レイヤーキーは L0 の割当からは手元のキーに対応づかないので、空いているキーに当てる
  capture: { NonConvert: 53, Lang2: 53, Convert: 56, Lang1: 56 },
  defaultKeymapName: 'Sofle 標準',
})
