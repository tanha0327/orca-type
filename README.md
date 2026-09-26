# ORCA MAP

**Keychron Orca echo** をはじめとする自作キーボードのキーマップを設計するための、非公式のコンセプト・エディタです。

実機に接続せず、手元の普通のキーボードの打鍵を編集中のキーボードの配列として読み替え、
「この組み合わせなら何が出るのか」「いまのは単押しか長押しか」を
**Picture-in-Picture の常時最前面ウィンドウ**に出しながら設計できます。

## できること

| | |
|---|---|
| **いろいろなキーボード** | 13 機種を組み込み済み（下記）。ほかの機種も QMK・VIA・KLE・ZMK の配列データを貼り付けて取り込める |
| **レイヤー** | 名前・色つきのレイヤーを最大 16 枚（Orca echo は 8 枚から）。`MO` / `TG` / `TO` / layer-tap に対応 |
| **MOD-TAP** | すべての割当に単押し・長押し・ダブルタップ。タッピングタームとフレーバー（長押し優先／バランス／単押し優先）も個別に指定可能 |
| **コンボ** | 同時押しの割当。参加キー・判定時間・有効レイヤーを編集でき、盤面クリックでキーを選べる |
| **ロータリーエンコーダー** | 左ホイールの右回し／左回し／押し込み。初期設定は **右回しで `→`、左回しで `←`** |
| **スワイプ** | 左右のスクロールパッドに上下左右スワイプ・タップ・ダブルタップ。初期設定は **上下で音量、左右で水平スクロール** |
| **トラックボール** | 19mm ボールの DPI・取り付け角度・反転・精密モード倍率・スクロール粒度 |
| **出力 HUD** | 現在レイヤー／組み合わせ→出力／単押し・長押しの判定とタッピングターム進行バー／コンボ発火／スワイプ／直近ログ／ミニキーマップ。PiP で常時最前面に出せる |
| **入出力** | localStorage への自動保存（キーボードごと）、JSON の書き出し・読み込み、ZMK `.keymap` 風 / QMK `keymap.c` 風のプレビュー |
| **打鍵音** | 打鍵に赤軸／茶軸／青軸のスイッチ音を Web Audio で合成して鳴らす。長押し確定・コンボ・ホイール・スワイプにも専用の音。HUD の ⚙ から選べる |
| **みんなの配列** | 投稿・いいね・コメント。各投稿の盤面で、あなたの配列と違うキーと全体の一致度を表示。今熱い／人気／新しい順／古い順／近い順で並び替え。配列の特徴から自動でフォルダ分けし（投稿時に選び直せる）、🍎 Mac / 🪟 Windows の OS タグでも絞り込める（投稿時に選ぶ。配列の JSON に入るので DB の変更は不要）。自分用のフォルダに保存して手動で並べ替えもできる。24 時間以内の投稿に NEW、いいね 10 以上は 🔥 を付けて新しい順の上にまとめる |

## 動かす

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 型チェック + 本番ビルド
npm run typecheck
```

「みんなの配列」を使うには `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を設定し、
`supabase/sql/` の SQL を番号順に Supabase の SQL Editor で実行してください
（フォルダ機能は `006_feed_folders.sql` が必要です）。

PiP（Document Picture-in-Picture API）は Chrome / Edge で動きます。
非対応のブラウザではボタンが無効になり、HUD はページ内に表示されます。

## 使い方

1. 盤面の上の「キーボードを変える」で、編集するキーボードを選ぶ（または配列データを取り込む）
2. 盤面のキーをクリックして、出てくるメニューで単押しと長押しを決める
3. ヘッダーの「入力キャプチャ ON」で打鍵の読み替えを開始する
4. HUD にいま何が出力されたかが出る（キーをダブルクリックすれば試し打ちも可）
5. 「PiP で常時表示」で HUD を別ウィンドウに逃がし、他のアプリを使いながら確認する

キャプチャ中はブラウザのショートカットを除くほとんどのキーがページに取り込まれます。
文字を入力したいときは OFF に戻してください。

## X のポストで本人確認

プロフィール編集の「本人確認（X のポスト）」で、確認コード入りのポストを X にしてその URL を貼ると、
「みんなの配列」の投稿・コメントに **✓ 𝕏 @ユーザー名** のバッジが付きます。
バッジを押すとその X アカウントのプロフィールが開くので、見た人が本人の投稿かどうかを確かめられます。
ポストが公開されている必要があるのは確認の瞬間だけで、確認が終わったら消してもバッジは残ります
（鍵アカウントのポストでは確認できません）。

有料の X API は使いません。DB の関数 `verify_x_post()` が X の公開 oEmbed（埋め込み用の窓口。鍵・料金不要）で
ポストを取りに行き、本文に確認コードが入っているかと投稿者の @ユーザー名 を確かめて `x_verifications` に記録します。
投稿者は X が返す情報から取るので、他人のポストで本人確認することはできません。

有効にするには `supabase/sql/005_x_verification.sql` を SQL Editor で実行するだけです
（Supabase・X のどちらにも追加の設定や開発者登録は要りません）。
oEmbed は X の都合で予告なく変わる・止まる可能性があるので、そのときは確認ができなくなります
（確認済みのバッジはそのまま残ります）。

## いろいろな自作キーボードに対応する

盤面の描画・打鍵の読み替え・書き出しは、どれも **キーボード定義**（`KeyboardDefinition`）という
1 つのデータから組み立てています。Orca echo もその定義の 1 つにすぎません。

### キーボード定義（`src/keyboards/types.ts`）

- **キー** … `x` / `y` / `w` / `h`（1u 単位）と回転 `r` / `rx` / `ry`。QMK の info.json・KLE・ZMK の
  physical layout と同じ座標系なので、分割・一体型・カラムスタッガー・回転した親指キー・幅の違うキーを
  そのまま表せます。**配列の順番がファームウェア上のキーの順番**（QMK の `LAYOUT` の引数順・ZMK の
  bindings の順）で、書き出しやコンボの `key-positions` はこの順に従います。
  マトリクス位置（`matrix`）も取り込み元にあれば保持しています。
- **センサー** … `encoder`（右回し・左回し）/ `pad`（上下スワイプ・タップ）/ `ball`（DPI などの設定のみ）。
  いくつあっても、レイヤーごとの割当は `layer.sensors[センサー ID][スロット]` に入ります。
- **ファームウェア** … `zmk` / `qmk`。書き出しの形式の初期値になります（どちらにも切り替え可能）。
- **既定のキーマップ・レイヤー数・読み替え表**（`capture`）… 読み替え表に書いていないキーは、
  ベースレイヤーの割当から自動で対応づけます（L0 で `A` を出すキー ← 手元の `A` キー）。

### 組み込みのキーボード

Orca echo のあとに、よく知られている順に並べています。目安は QMK 0.22（2023 年）に集まっていた
コミュニティのキーマップの数で、QMK の外で使われることが多い機種（Moonlander・Keyball44・Sweep）は
いまの人気を見てその後ろに置いています。

| | キーボード | 形 | 座標と初期キーマップの出どころ |
|---|---|---|---|
| 1 | Keychron Orca echo | 分割 49 キー・パッド 2・エンコーダー・トラックボール | 実機写真 |
| 2 | Planck | 4×12 格子 | ZMK |
| 3 | ErgoDox EZ | 分割 76 キー・傾いた親指クラスタ | KLE（座標）/ QMK（キーマップ） |
| 4 | 60% ANSI | 一体型 61 キー | QMK |
| 5 | Corne（6 列） | 分割 42 キー | ZMK |
| 6 | Iris | 分割 56 キー | QMK |
| 7 | Preonic | 5×12 格子 | ZMK |
| 8 | Kyria | 分割 50 キー・エンコーダー 2 | ZMK |
| 9 | Lily58 | 分割 58 キー | ZMK |
| 10 | Sofle | 分割 60 キー・エンコーダー 2 | ZMK |
| 11 | Moonlander Mark I | 分割 72 キー | QMK |
| 12 | Keyball44 | 分割 44 キー・トラックボール | Yowkees/keyball（JIS 前提の記号は実際に出る文字に直した） |
| 13 | Ferris Sweep | 分割 34 キー・ホームロー修飾 | ZMK |

RGB の効果切替や Keyball の CPI 調整のような機種独自のキーは、ORCA MAP のキーコードに無いので未割当にしています。

### 組み込みのキーボードを足す

`src/keyboards/presets/` に定義を 1 つ書き、`src/keyboards/registry.ts` の `BUILTIN_KEYBOARDS` に並べるだけです。
`preset()`（`presets/preset.ts`）を使うと、キーは `[x, y, 幅, 高さ, 回転, 回転の中心 x, 回転の中心 y]`、
キーマップはキーの順に空白で区切った割当（`_` 透過・`x` 未割当・`A@LSHFT` 長押しつき）で書けます。
各ファイルの冒頭に、写したもとの QMK / ZMK の定義の場所を書いてあります。
画面の「キーボードを変える」→「配列を取り込む」→「定義を JSON で保存」で、既存の配列データから
定義の下書きを作ることもできます。

### 配列データの取り込み（`src/keyboards/import/`）

「キーボードを変える」から、次のどれかを貼り付けるかファイルで読み込めます。

| 形式 | 例 |
|---|---|
| QMK | `keyboards/<name>/info.json`・`keyboard.json`（`layouts`。複数あれば選べる。エンコーダーの数も読む） |
| VIA / Vial | 定義 JSON（`layouts.keymap`。配列オプションは既定の選択肢、`e0` のエンコーダーにも対応） |
| KLE | keyboard-layout-editor の Raw data / JSON（印字からベースレイヤーの下書きを作る） |
| ZMK | physical layout（`&key_physical_attrs` を並べた `.dtsi`。複数あれば選べる） |

取り込んだ定義はキーマップに同梱して保存・共有するので、共有フィードで他の人が見ても同じ盤面が出ます。

### 保存データ

`Keymap` は `keyboard`（定義の ID）を持ち、組み込みに無いキーボードは `keyboardDef` に定義ごと入ります。
キーボードを切り替えても、前のキーボードのキーマップは `savedKeymaps` に残ります。
localStorage・JSON ファイル・共有フィードから来たキーマップは、どれも `src/data/normalize.ts` を通して
形を検証し、Orca echo 専用だった古い形（`encoder` / `padL` / `padR`）は今の形に移行します。

### これから

- VIA / Vial 対応キーボードへの WebHID での書き込み（`matrix` と `usb` の VID / PID はそのための保持）
- QMK の `keymap.json` / VIA のバックアップからのレイヤーの取り込み
- ISO Enter のような L 字のキー、トラックボールが複数ある機種の個別設定

## 構成

```
src/
  keyboards/  types.ts（キーボード定義の型）/ registry.ts（組み込みの一覧・キーマップの生成・読み替え）
              geometry.ts / orcaEcho.ts / corne.ts / ansi60.ts / presets/（ほかの組み込み機種）
              import/（QMK・VIA・KLE・ZMK の取り込み）
  data/       keycodes.ts / types.ts / normalize.ts（外から来たデータの検証と移行）
  engine/     resolve.ts（純粋な解決関数）/ KeyEngine.ts（状態機械）/ analyze.ts（フォルダ分け・一致度）/ zmk.ts / qmk.ts / useEngine.ts / useSwitchSound.ts
  lib/        supabase.ts / auth.ts / profile.ts / feed.ts / folders.ts / xVerification.ts（X のポストで本人確認）/ switchSound.ts（打鍵音）
  store/      keymapStore.ts（Zustand + persist）/ authStore.ts / profileStore.ts / feedStore.ts / folderStore.ts
  components/ Board / LayerBar / Inspector / Picker / Combos / Gestures / Export / Hud / PipHost / Feed / Profile / Auth
  styles/     theme.css（デザイントークンと共通クラス）
api/og.ts       共有された配列のカード画像（Vercel Edge Function、@vercel/og）
middleware.ts   共有リンク（/?k=<投稿ID>）の OGP をその投稿のものに差し替える（Vercel Routing Middleware）
server/         上の 2 つが使う共通処理（Supabase から 1 件取得・カードの組み立て・フォント）
```

X などに共有リンクを貼ると、`middleware.ts` が `og:image` を `/api/og?k=<投稿ID>` に向け、
その配列の盤面と特徴を並べたカードが出ます。どちらも Vercel 上でだけ動き（`npm run dev` では動かない）、
アプリと同じ環境変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を読みます。
カードのデザインを変えたら、`server/meta.ts` の `OG_CARD_VERSION` を上げてください（画像は URL ごとに長くキャッシュされるため）。

割当はキーもエンコーダーもパッドもコンボも `Binding`（`tap` / `hold` /
`tappingTermMs` / `flavor`）という 1 つの型に集約してあり、編集 UI もそれを共有しています。

## 注意

ORCA MAP は非公式のコンセプトサイトです。Keychron / GIZMART をはじめ、各キーボードの作者・メーカーとは関係ありません。
実機のファームウェアへの書き込みは行いません。
