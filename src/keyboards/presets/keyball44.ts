import { preset } from './preset.js'

/* ================================================================
   Keyball44（Yowkees）— 44 キーの分割に 34mm トラックボールを載せた、日本発のキーボード

   座標: Yowkees/keyball qmk_firmware/keyboards/keyball/keyball44/via.json（ボールは右手）
   初期キーマップ: Yowkees/keyball qmk_firmware/keyboards/keyball/keyball44/keymaps/default/keymap.c
   元のキーマップは日本語配列（JIS）の OS 向けに書かれているので、記号は実際に出る文字のキーコードに直してある。
   ボールの設定（CPI・スクロール）やオートマウスなど Keyball 独自のキーは未割当にしてある
   ================================================================ */

export const KEYBALL44 = preset({
  id: 'yowkees-keyball44',
  name: 'Keyball44',
  maker: 'Yowkees',
  firmware: 'qmk',
  qmkLayout: 'LAYOUT_right_ball',
  hashtag: 'keyball',
  splitAt: 8,
  keys: [
    [0, 0.6], [1, 0.6], [2, 0.25], [3, 0], [4, 0.125], [5, 0.25], [10.5, 0.25], [11.5, 0.125], [12.5, 0], [13.5, 0.25], [14.5, 0.6], [15.5, 0.6],
    [0, 1.6], [1, 1.6], [2, 1.25], [3, 1], [4, 1.125], [5, 1.25], [10.5, 1.25], [11.5, 1.125], [12.5, 1], [13.5, 1.25], [14.5, 1.6], [15.5, 1.6],
    [0, 2.6], [1, 2.6], [2, 2.25], [3, 2], [4, 2.125], [5, 2.25], [10.5, 2.25], [11.5, 2.125], [12.5, 2], [13.5, 2.25], [14.5, 2.6], [15.5, 2.6],
    [2, 3.25], [3, 3], [4.3, 3.5], [5.35, 3.5], [6.37, 3.71], [9.13, 3.7], [10.15, 3.52], [14.5, 3.6],
  ],
  thumbs: [36, 37, 38, 39, 40, 41, 42, 43],
  sensors: [
    { id: 'ball', kind: 'ball', name: '34mm トラックボール', short: 'BALL', half: 'R', x: 11.9, y: 3.25, w: 1.6, h: 1.6 },
  ],
  layerCount: 4,
  layers: [
    {
      name: 'BASE', color: 'gray',
      keys: `
        ESC         Q           W           E           R           T             Y           U           I           O           P           DEL
        TAB         A           S           D           F           G             H           J           K           L           SEMI        SQT
        LSHFT       Z           X           C           V           B             N           M           COMMA       DOT         FSLH        BSLH
        LALT        LGUI        LANG2@LCTRL SPACE@FN_1  LANG1@FN_3    BSPC        ENTER@FN_2  PSCRN
      `,
    },
    {
      name: 'FUNCTION', color: 'pink',
      keys: `
        x     F1    F2    F3    F4    F5      F6    F7    F8    F9    F10   F11
        x     _     _     UP    ENTER DEL     PG_UP MB1   UP    MB2   MB3   F12
        x     _     LEFT  DOWN  RIGHT BSPC    PG_DN LEFT  DOWN  RIGHT _     _
        _     _     _     _     _       _     _     _
      `,
    },
    {
      name: 'SYMBOL', color: 'green',
      keys: `
        _     STAR  N7    N8    N9    LPAR    RPAR  EXCL  AMPS  AT    DLLR  _
        _     PLUS  N4    N5    N6    LBKT    RBKT  MINUS TILDE HASH  COLON DQT
        _     EQUAL N1    N2    N3    LBRC    RBRC  UNDER CARET GRAVE QMARK PIPE
        N0    DOT   _     _     _       DEL   _     _
      `,
    },
    {
      name: 'SETTING', color: 'purple',
      keys: `
        RGB_TOG    x          x          x          _          _            x          x          x          x          x          x
        x          x          x          x          _          x            x          x          x          x          _          _
        x          x          x          x          _          x            x          x          x          x          _          x
        BOOTLOADER x          _          _          _            _          _          BOOTLOADER
      `,
    },
  ],
  defaultKeymapName: 'Keyball44 標準',
})
